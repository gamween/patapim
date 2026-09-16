// Track 2 of the XRPL Lending Protocol hackathon: closed-ended vaults, Lending Protocol V1.1,
// public XRPL Devnet. Never point this file at the custom hackathon devnet: the two networks
// enforce different lending rules behind the same lending amendments.
export const NETWORK = {
  name: 'XRPL Devnet',
  rpc: 'https://s.devnet.rippletest.net:51234/',
  explorer: 'https://devnet.xrpl.org',
  networkId: 2,
} as const

export const LIBRARY = 'xrpl.js@5.2.0-beta.0'
export const REPO = 'https://github.com/gamween/patapim'
export const DEMO_ACCOUNTS_URL = `${REPO}/blob/main/docs/DEMO-ACCOUNTS.md`

/** The vault the landing page opens: Fund I, the term fund with the loan book. */
export const DEMO_VAULT = 'B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730'

/**
 * The two funds `node scripts/standing.mjs` provisioned, both run by the same lending agent. A
 * directory for the vault picker, nothing more: every figure the app shows is read from the ledger,
 * and any other vault id can be typed in.
 * During the hackathon they were provisioned in two different phases, so that the jury could see a
 * fund in term and a fund open for subscription at the same time; the app reads the live phase from
 * the ledger, so `detail` only names what each fund is.
 */
export const FUNDS = [
  {
    id: DEMO_VAULT,
    label: 'Fund I',
    detail: 'Term fund, one loan of 2,000,000 TBL',
  },
  {
    id: 'B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530',
    label: 'Fund II',
    detail: '91-day term, up to 20,000,000 TBL',
  },
] as const
