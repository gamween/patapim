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
}
export type VaultSnapshot = {
  id: string
  network: string
  explorer: string
  name: string
  asset: string
  owner: string
  phase: string
  clock: number
  ledgerTime: string
  nextSeconds: number | null
  subscription: string | null
  redemption: string | null
  termDays: number | null
  permissioned: boolean
  cards: LedgerCard[]
  loans: {
    id: string
    borrower: string
    principal: string
    owed: string
    payments: string
    due: string
    status: string
  }[]
  rules: { allowed: string[]; blocked: [string, string][] }
  position: { holder: string; shares: string; value: string } | null
  calls: { why: string; request: Record<string, unknown> }[]
}
