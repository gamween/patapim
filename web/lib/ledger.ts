import { NETWORK } from './config'

type Json = Record<string, any>

/** One JSON-RPC call, server side only. Returns the `result` object or throws. */
export async function rpc(method: string, params: Json = {}): Promise<Json> {
  const res = await fetch(NETWORK.rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params: [params] }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`)
  const body = await res.json()
  if (body.result?.error) throw new Error(`${method}: ${body.result.error_message ?? body.result.error}`)
  return body.result
}

/**
 * The clock a closed-ended vault is judged against is the parent ledger close time,
 * not the wall clock of whoever is looking. Every phase decision on this page uses this.
 */
export async function ledgerClock(): Promise<number> {
  const r = await rpc('ledger', { ledger_index: 'validated' })
  return r.ledger.close_time as number
}

export type Phase = 'subscription' | 'investment' | 'redemption' | 'open-ended'

export function phaseOf(vault: Json, clock: number): Phase {
  if (vault.VaultKind !== 1) return 'open-ended'
  if (clock < vault.SubscriptionDate) return 'subscription'
  if (clock < vault.RedemptionDate) return 'investment'
  return 'redemption'
}

/** What each phase allows, established transaction by transaction against the ledger. */
export const PHASE_RULES: Record<Phase, { allowed: string[]; blocked: [string, string][] }> = {
  subscription: {
    allowed: ['VaultDeposit', 'VaultWithdraw'],
    blocked: [['LoanSet', 'tecTOO_SOON']],
  },
  investment: {
    allowed: ['LoanSet', 'LoanPay', 'LoanManage'],
    blocked: [['VaultDeposit', 'tecEXPIRED'], ['VaultWithdraw', 'tecTOO_SOON']],
  },
  redemption: {
    allowed: ['VaultWithdraw', 'LoanPay'],
    blocked: [['LoanSet', 'tecEXPIRED'], ['VaultDeposit', 'tecEXPIRED']],
  },
  'open-ended': { allowed: ['VaultDeposit', 'VaultWithdraw', 'LoanSet', 'LoanPay'], blocked: [] },
}

export type VaultView = {
  vault: Json
  shares: Json | null
  broker: Json | null
  loans: Json[]
  clock: number
  phase: Phase
  assetsTotal: number
  assetsAvailable: number
  lossUnrealized: number
  /** What the lenders actually own: the ledger uses this as the withdrawal denominator. */
  nav: number
  sharesOutstanding: number
  pricePerShare: number | null
  utilisation: number | null
  calls: { why: string; request: Json }[]
}

/**
 * Everything a dashboard needs about a vault. Four calls, because the ledger does not
 * offer one: shares outstanding live on a separate MPT issuance, and loans live under the
 * loan broker's pseudo-account rather than under the vault or its owner.
 */
export async function readVault(vaultId: string): Promise<VaultView> {
  const calls: { why: string; request: Json }[] = []
  const track = (why: string, request: Json) => { calls.push({ why, request }); return request }

  const vaultReq = track('the vault itself', { command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })
  const v = (await rpc('ledger_entry', vaultReq)).node as Json

  const clock = await ledgerClock()
  calls.push({ why: 'the clock phases are judged against', request: { command: 'ledger', ledger_index: 'validated' } })

  let shares: Json | null = null
  if (v.ShareMPTID) {
    const req = track('shares outstanding, the denominator of the share price', {
      command: 'ledger_entry', mpt_issuance: v.ShareMPTID, ledger_index: 'validated',
    })
    shares = (await rpc('ledger_entry', req).catch(() => ({ node: null }))).node ?? null
  }

  const ownerReq = track('the loan broker, which lives under the vault owner', {
    command: 'account_objects', account: v.Owner, ledger_index: 'validated', limit: 200,
  })
  const owned = (await rpc('account_objects', ownerReq)).account_objects as Json[]
  const broker = owned.find((o) => o.LedgerEntryType === 'LoanBroker') ?? null

  let loans: Json[] = []
  if (broker?.Account) {
    const req = track('the loans, which live under the broker pseudo-account', {
      command: 'account_objects', account: broker.Account, ledger_index: 'validated', limit: 200,
    })
    const brokerObjs = (await rpc('account_objects', req).catch(() => ({ account_objects: [] }))).account_objects as Json[]
    loans = brokerObjs.filter((o) => o.LedgerEntryType === 'Loan')
  }

  // Absent means zero: the ledger omits these fields when they sit at their default,
  // although the specification and the reference pages both say they are always present.
  const assetsTotal = Number(v.AssetsTotal ?? 0)
  const assetsAvailable = Number(v.AssetsAvailable ?? 0)
  const lossUnrealized = Number(v.LossUnrealized ?? 0)
  const sharesOutstanding = Number(shares?.OutstandingAmount ?? 0)

  // AssetsTotal alone overstates the position: an impaired loan is still counted there and only
  // shows up in LossUnrealized. The ledger itself withdraws against AssetsTotal - LossUnrealized,
  // so that is what a share is worth. We learned this by impairing a loan and watching AssetsTotal
  // not move.
  const nav = assetsTotal - lossUnrealized

  return {
    vault: v, shares, broker, loans, clock,
    phase: phaseOf(v, clock),
    assetsTotal, assetsAvailable, lossUnrealized, nav, sharesOutstanding,
    pricePerShare: sharesOutstanding > 0 ? nav / sharesOutstanding : null,
    utilisation: assetsTotal > 0 ? (assetsTotal - assetsAvailable) / assetsTotal : null,
    calls,
  }
}

export async function readPosition(shareMptId: string, account: string) {
  const r = await rpc('ledger_entry', {
    command: 'ledger_entry', mptoken: { mpt_issuance_id: shareMptId, account }, ledger_index: 'validated',
  }).catch(() => null)
  return r?.node ?? null
}

/**
 * Loan status. The first three cases mirror what the XRPL Explorer shows, so the two agree.
 * "overdue" is ours: the payment window plus its grace period has passed and the agent has not
 * yet acted. That is the moment a lending agent earns its fee, so the dashboard names it.
 */
export const LSF_LOAN_DEFAULT = 0x00010000
export const LSF_LOAN_IMPAIRED = 0x00020000

export type LoanStatus = 'paid off' | 'defaulted' | 'impaired' | 'overdue' | 'current'

export function loanStatus(loan: Json, clock: number): LoanStatus {
  // We deliberately diverge from the XRPL Explorer here, and only here. Its formatLoanStatus
  // returns "paid off" whenever the outstanding balance is zero, whatever the flags say, and that
  // is a deliberate choice: an explicit test asserts it, and both the Default tab filter and the
  // broker's defaulted-loan counter require TotalValueOutstanding > 0 to agree with it. From the
  // vault's side the loan is indeed settled.
  // A lender-facing view cannot afford that shortcut. After a default the borrower did not pay, the
  // first-loss cover did, and a loan book that reads "paid off" hides the counterparty that failed.
  // Default is terminal, so it wins. Impairment is reversible with tfLoanUnimpair, so a zero
  // balance after an impairment really is a repayment and keeps its "paid off".
  // eslint-disable-next-line no-bitwise
  if (loan.Flags & LSF_LOAN_DEFAULT) return 'defaulted'
  if (Number(loan.TotalValueOutstanding ?? 0) === 0) return 'paid off'
  // eslint-disable-next-line no-bitwise
  if (loan.Flags & LSF_LOAN_IMPAIRED) return 'impaired'
  const due = Number(loan.NextPaymentDueDate ?? 0)
  const grace = Number(loan.GracePeriod ?? 0)
  if (due > 0 && clock > due + grace) return 'overdue'
  return 'current'
}

/**
 * The vault's Data field carries the product metadata, including the real-world term the demo
 * compresses. The brief asks for that duration to be modelled somewhere; modelling it on chain
 * means the dashboard reads it rather than inventing it.
 */
export function vaultData(hexData?: string): { n?: string; term_days?: number; note?: string } {
  if (!hexData) return {}
  try {
    const text = Buffer.from(hexData, 'hex').toString('utf8')
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export const rippleToDate = (t: number) => new Date((t + 946684800) * 1000)
export const shortId = (s: string, n = 6) => (s ? `${s.slice(0, n)}…${s.slice(-4)}` : '')
