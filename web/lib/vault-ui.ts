/** Serializable presentation contract; never connects to XRPL from the browser. */
export type LedgerCard = {
  id: string
  title: string
  value: string
  subtitle: string
  category: string
  tone?: 'green' | 'amber' | 'red'
  lines: [string, string][]
  meter?: number
  phaseIndex?: number
  note?: string
}
export type LoanRow = {
  id: string
  borrower: string
  principal: string
  owed: string
  interestToLenders: string
  feeBps: string
  payments: string
  due: string
  grace: string
  status: string
  collateral: string
  margin: string
}
export type VaultSnapshot = {
  id: string
  network: string
  networkId: number
  explorer: string
  name: string
  asset: string
  owner: string
  phase: string
  clock: number
  ledgerTime: string
  nextSeconds: number | null
  nextLabel: string | null
  subscription: string | null
  redemption: string | null
  termDays: number | null
  permissioned: boolean
  cards: LedgerCard[]
  loans: LoanRow[]
  rules: { allowed: string[]; blocked: [string, string][] }
  position: { holder: string; shares: string; value: string } | null
  /** Raw ledger values a signer needs to build VaultDeposit and VaultWithdraw. */
  signing: {
    vaultId: string
    assetMptId: string | null
    assetTicker: string
    assetScale: number
    shareMptId: string | null
    domainId: string | null
    acceptsDeposits: boolean
    acceptsWithdrawals: boolean
  }
  calls: { why: string; request: Record<string, unknown> }[]
}
