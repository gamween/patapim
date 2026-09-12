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
  const sharesOutstanding = Number(shares?.OutstandingAmount ?? 0)

  return {
    vault: v, shares, broker, loans, clock,
    phase: phaseOf(v, clock),
    assetsTotal, assetsAvailable, sharesOutstanding,
    pricePerShare: sharesOutstanding > 0 ? assetsTotal / sharesOutstanding : null,
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

export const rippleToDate = (t: number) => new Date((t + 946684800) * 1000)
export const shortId = (s: string, n = 6) => (s ? `${s.slice(0, n)}…${s.slice(-4)}` : '')
