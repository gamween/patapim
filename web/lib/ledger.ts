import { NETWORK } from './config'
import { exitNavPerShare, oraclePrice, type Json } from './finance'

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

/**
 * rippled VaultHelpers.cpp getVaultPhase: the Subscription boundary is exclusive (a close time equal
 * to SubscriptionDate is still Subscription), the Redemption boundary inclusive.
 */
export function phaseOf(vault: Json, clock: number): Phase {
  if (vault.VaultKind !== 1) return 'open-ended'
  if (clock <= vault.SubscriptionDate) return 'subscription'
  if (clock < vault.RedemptionDate) return 'investment'
  return 'redemption'
}

/**
 * What each phase allows, established transaction by transaction against the ledger and read in
 * rippled: VaultDeposit.cpp, VaultWithdraw.cpp and LoanSet.cpp preclaim.
 */
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

export type TokenInfo = { id: string; ticker: string; name?: string; scale: number; subclass?: string }
export type Collateral = { escrow: Json; token: TokenInfo; value: number; finishAfter?: number; cancelAfter?: number }
export type ReferencePrice = { base: string; quote: string; price: number; updated: number; account: string; documentID: number }

export type VaultMeta = {
  name?: string
  oracle?: { account: string; documentID: number }
  termDays?: number
  note?: string
}

export type VaultView = {
  vault: Json
  shares: Json | null
  broker: Json | null
  loans: Json[]
  clock: number
  phase: Phase
  asset: TokenInfo | null
  meta: VaultMeta
  price: ReferencePrice | null
  collateral: Record<string, Collateral[]>
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

/** MPTokenMetadata is hex JSON, XLS-89: long keys, or the compact aliases t, n, as. */
export function tokenInfo(issuance: Json | null): TokenInfo | null {
  if (!issuance) return null
  let m: Json = {}
  try {
    m = issuance.MPTokenMetadata ? JSON.parse(Buffer.from(issuance.MPTokenMetadata, 'hex').toString('utf8')) : {}
  } catch {
    m = {}
  }
  const id = String(issuance.mpt_issuance_id ?? '')
  return {
    id,
    ticker: m.ticker ?? m.t ?? `MPT ${id.slice(0, 8)}…`,
    name: m.name ?? m.n,
    scale: Number(issuance.AssetScale ?? 0),
    subclass: m.asset_subclass ?? m.as,
  }
}

/**
 * Everything a dashboard needs about a vault, from the validated ledger. The ledger offers no single
 * call: shares outstanding live on a separate MPT issuance, the broker under the vault owner, the
 * loans under the broker pseudo-account, the collateral under each borrower, and the reference
 * price on a Price Oracle the vault's Data points to.
 */
export async function readVault(id: string): Promise<VaultView> {
  // Ledger ids are hex; the ledger returns them upper case, so compare in upper case.
  const vaultId = id.toUpperCase()
  const calls: { why: string; request: Json }[] = []
  const track = (why: string, request: Json) => { calls.push({ why, request }); return request }
  const entry = async (why: string, params: Json) =>
    ((await rpc('ledger_entry', track(why, { command: 'ledger_entry', ledger_index: 'validated', ...params })).catch(() => ({ node: null }))).node ?? null) as Json | null

  const v = (await rpc('ledger_entry', track('the vault itself', { command: 'ledger_entry', index: vaultId, ledger_index: 'validated' }))).node as Json
  if (v.LedgerEntryType !== 'Vault') throw new Error(`ledger_entry: ${vaultId.slice(0, 8)}… is a ${v.LedgerEntryType}, not a Vault.`)

  const clock = await ledgerClock()
  calls.push({ why: 'the clock phases are judged against', request: { command: 'ledger', ledger_index: 'validated' } })

  const shares = v.ShareMPTID ? await entry('shares outstanding, the denominator of the share price', { mpt_issuance: v.ShareMPTID }) : null
  const asset: TokenInfo | null = v.Asset?.mpt_issuance_id
    ? tokenInfo(await entry('the vault asset: ticker and scale', { mpt_issuance: v.Asset.mpt_issuance_id }))
    : v.Asset?.currency
      ? { id: v.Asset.currency, ticker: v.Asset.currency, scale: v.Asset.currency === 'XRP' ? 6 : 0 }
      : null

  const ownerReq = track('the loan broker, which lives under the vault owner', {
    command: 'account_objects', account: v.Owner, type: 'loan_broker', ledger_index: 'validated', limit: 200,
  })
  const owned = (await rpc('account_objects', ownerReq)).account_objects as Json[]
  // One broker per vault, and an agent running two funds owns two: match on VaultID, never take
  // the first broker the owner happens to hold.
  const broker = owned.find((o) => o.LedgerEntryType === 'LoanBroker' && o.VaultID === vaultId) ?? null

  let loans: Json[] = []
  if (broker?.Account) {
    const req = track('the loans, which live under the broker pseudo-account', {
      command: 'account_objects', account: broker.Account, ledger_index: 'validated', limit: 200,
    })
    const brokerObjs = (await rpc('account_objects', req).catch(() => ({ account_objects: [] }))).account_objects as Json[]
    loans = brokerObjs.filter((o) => o.LedgerEntryType === 'Loan')
  }

  const meta = vaultData(v.Data)
  let price: ReferencePrice | null = null
  if (meta.oracle && asset) {
    const o = await entry('the reference price, on the Price Oracle the vault Data names', {
      oracle: { account: meta.oracle.account, oracle_document_id: meta.oracle.documentID },
    })
    const series = (o?.PriceDataSeries ?? []) as Json[]
    const pd = series.map((s) => s.PriceData).find((p) => p?.BaseAsset === asset.ticker)
    const value = oraclePrice(pd)
    if (pd && value !== null) {
      price = { base: pd.BaseAsset, quote: pd.QuoteAsset, price: value, updated: Number(o?.LastUpdateTime ?? 0), ...meta.oracle }
    }
  }

  // Collateral is not part of an XLS-66 loan. The borrower posts it in a token escrow payable to the
  // vault owner, so it is found under the borrower, filtered on that destination, in another asset.
  const collateral: Record<string, Collateral[]> = {}
  const tokens = new Map<string, TokenInfo | null>()
  for (const borrower of new Set(loans.map((l) => String(l.Borrower)))) {
    const req = track('the collateral escrows the borrower posted to the agent', {
      command: 'account_objects', account: borrower, type: 'escrow', ledger_index: 'validated', limit: 200,
    })
    const escrows = ((await rpc('account_objects', req).catch(() => ({ account_objects: [] }))).account_objects as Json[])
      .filter((e) => e.Destination === v.Owner && e.Amount?.mpt_issuance_id && e.Amount.mpt_issuance_id !== asset?.id)
    for (const e of escrows) {
      const tid = e.Amount.mpt_issuance_id as string
      if (!tokens.has(tid)) tokens.set(tid, tokenInfo(await entry('the collateral token: ticker and scale', { mpt_issuance: tid })))
      const token = tokens.get(tid)
      if (!token) continue
      ;(collateral[borrower] ??= []).push({
        escrow: e, token, value: Number(e.Amount.value) / 10 ** token.scale,
        finishAfter: e.FinishAfter, cancelAfter: e.CancelAfter,
      })
    }
  }

  // Absent means zero: the ledger omits these fields when they sit at their default,
  // although the specification and the reference pages both say they are always present.
  // Amounts are read with Number: exact below 2^53, which a demo security at AssetScale 0 never nears.
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
    vault: v, shares, broker, loans, clock, asset, meta, price, collateral,
    phase: phaseOf(v, clock),
    assetsTotal, assetsAvailable, lossUnrealized, nav, sharesOutstanding,
    pricePerShare: exitNavPerShare(assetsTotal, lossUnrealized, sharesOutstanding),
    // Utilisation, Aave's definition: borrowed over total. Under cash-basis accounting, which every
    // vault created under LendingProtocolV1_1 uses, AssetsTotal - AssetsAvailable is principal lent out.
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

/** The validated outcome of a transaction, or null while it is not yet in a validated ledger. */
export async function readTransaction(hash: string) {
  const r = await rpc('tx', { transaction: hash }).catch((e: Error) => {
    if (/txnNotFound|not found/i.test(e.message)) return null
    throw e
  })
  if (!r || !r.validated) return null
  const tx = (r.tx_json ?? r) as Json
  return {
    hash: String(r.hash ?? hash),
    type: String(tx.TransactionType),
    account: String(tx.Account),
    result: String(r.meta?.TransactionResult),
    ledger: Number(r.ledger_index),
  }
}

/**
 * Loan status. "paid off", "defaulted" and "impaired" mirror what the XRPL Explorer shows, so the two
 * agree. "past due" and "past grace" are ours, from the loan's own dates: a payment past its due date
 * can already be impaired (LoanManage.cpp, isPaymentLate), and once the grace period is over the
 * agent may declare default. That is the moment a lending agent earns its fee, so the dashboard names it.
 */
export const LSF_LOAN_DEFAULT = 0x00010000
export const LSF_LOAN_IMPAIRED = 0x00020000

export type LoanStatus = 'paid off' | 'defaulted' | 'impaired' | 'past grace' | 'past due' | 'current'

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
  if (loan.Flags & LSF_LOAN_DEFAULT) return 'defaulted'
  if (Number(loan.TotalValueOutstanding ?? 0) === 0) return 'paid off'
  if (loan.Flags & LSF_LOAN_IMPAIRED) return 'impaired'
  const due = Number(loan.NextPaymentDueDate ?? 0)
  const grace = Number(loan.GracePeriod ?? 0)
  if (due > 0 && clock > due + grace) return 'past grace'
  if (due > 0 && clock > due) return 'past due'
  return 'current'
}

/**
 * The vault's Data field: the fund's name, and `o`, "<oracle owner>/<OracleDocumentID>", the Price
 * Oracle its collateral is valued against. Older vaults carried `term_days` for a compressed demo.
 */
export function vaultData(hexData?: string): VaultMeta {
  if (!hexData) return {}
  try {
    const d = JSON.parse(Buffer.from(hexData, 'hex').toString('utf8')) as Json
    const [account, doc] = typeof d.o === 'string' ? d.o.split('/') : []
    return {
      name: d.n,
      oracle: account && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account) ? { account, documentID: Number(doc ?? 1) } : undefined,
      termDays: d.term_days,
      note: d.note,
    }
  } catch {
    return {}
  }
}

export const rippleToDate = (t: number) => new Date((t + 946684800) * 1000)
export const shortId = (s: string, n = 6) => (s ? `${s.slice(0, n)}…${s.slice(-4)}` : '')
