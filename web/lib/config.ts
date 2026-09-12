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

/** The vault provisioned by scripts/recall-spine.mjs, filled in after each demo run. */
export const DEMO_VAULT = '6B79B084F9EA00FB3B8B368D5710F50A871D488DE43095500B38C9FAD6D2C13C'
