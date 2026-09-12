// Track 2 of the XRPL Lending Protocol hackathon: closed-ended vaults, Lending Protocol V1.1,
// public XRPL Devnet. Never point this file at the custom hackathon devnet: the two networks
// enforce different lending rules behind an identical amendment list.
export const NETWORK = {
  name: 'XRPL Devnet',
  rpc: 'https://s.devnet.rippletest.net:51234/',
  explorer: 'https://devnet.xrpl.org',
  networkId: 2,
} as const

export const LIBRARY = 'xrpl.js@5.2.0-beta.0'
export const REPO = 'https://github.com/gamween/patapim'

/**
 * The vault the landing page advertises. `scripts/recall-spine.mjs` ends by redeeming the lender,
 * so the vault it leaves behind reads zero on every figure: never point this at a spine run.
 * Repoint it at whatever `node scripts/demo.mjs provision` creates, and check the page before the
 * pitch — a judge arriving from the hero button must land on a vault that holds something.
 */
export const DEMO_VAULT = 'FAB518C7FC616F2BEAE22537F94B53C33AF9138FC472FAF0043057B6C3020132'
