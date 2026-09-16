// Shared helpers for the XLS-65/66 scripts.
// NOTE: signCounterparty() deliberately does NOT use xrpl.js signLoanSetByCounterparty().
// In xrpl.js@5.2.0-beta.0 that helper signs the counterparty signature with the ordinary
// transaction encoder, which rippled rejects ("Counterparty: Invalid signature").
// See docs/feedback/FRICTION-LOG.md item F-001.
import { Client, Wallet } from 'xrpl'
import { encodeForSigningCounterparty, encode, decode } from 'ripple-binary-codec'
import { sign } from 'ripple-keypairs'

export const NETS = {
  t1: {
    name: 'TRACK 1 - custom hackathon devnet (Lending Protocol V1, open-ended); event-scoped, decommissioned after 13 September 2026',
    wss: 'wss://lending-hackathon.dev.ripplex.io:51233',
    faucet: 'https://lending-hackathon-faucet.dev.ripplex.io/accounts',
    tx: 'https://custom.xrpl.org/lending-hackathon.dev.ripplex.io:51233/transactions/',
  },
  t2: {
    name: 'TRACK 2 - public XRPL devnet (Lending Protocol V1.1, closed-ended)',
    wss: 'wss://s.devnet.rippletest.net:51233/',
    faucet: 'https://faucet.devnet.rippletest.net/accounts',
    tx: 'https://devnet.xrpl.org/transactions/',
  },
}

export const RIPPLE_EPOCH = 946684800
export const nowRipple = () => Math.floor(Date.now() / 1000) - RIPPLE_EPOCH
export const hex = (s) => Buffer.from(s, 'utf8').toString('hex').toUpperCase()
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Vault phases are judged against the parent ledger close time, never the clock of the machine
// submitting. Deriving the dates from one clock and waiting on another is how you end up
// submitting into the phase you thought you had left, which cost us a full run.
export const ledgerNow = async (client) => (await client.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger.close_time

// MPTokenIssuanceCreate flags, LoanManage flags, LoanPay full-payment flag.
export const MPT = { CanLock: 0x2, RequireAuth: 0x4, CanEscrow: 0x8, CanTrade: 0x10, CanTransfer: 0x20, CanClawback: 0x40 }
export const LoanManageFlags = { tfLoanDefault: 0x00010000, tfLoanImpair: 0x00020000 }
export const tfLoanFullPayment = 0x00020000

export async function fund(net, label) {
  const res = await fetch(net.faucet, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  const j = await res.json()
  // Two hackathon faucets, two response shapes: {seed} on the public devnet,
  // {account:{secret}} on the custom one. See FRICTION-LOG item F-003.
  const seed = j.seed ?? j.account?.secret ?? j.account?.seed
  if (!seed) throw new Error(`unexpected faucet payload for ${label}: ${JSON.stringify(j).slice(0, 200)}`)
  const w = Wallet.fromSeed(seed)
  console.log(`  funded ${label.padEnd(9)} ${w.classicAddress}`)
  return w
}

export function createdId(meta, type) {
  for (const n of meta?.AffectedNodes ?? []) {
    if (n.CreatedNode?.LedgerEntryType === type) return n.CreatedNode.LedgerIndex
  }
  return null
}

export async function submit(client, wallet, tx, label, expect = 'tesSUCCESS') {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.submitAndWait(signed.tx_blob)
    const code = r.result.meta.TransactionResult
    const mark = code === expect ? 'OK  ' : 'DIFF'
    console.log(`  ${mark} ${label.padEnd(34)} ${code.padEnd(24)} ${r.result.hash}`)
    return { ok: code === 'tesSUCCESS', code, meta: r.result.meta, hash: r.result.hash }
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(34)} ${String(e.message).slice(0, 160)}`)
    return { ok: false, code: 'THROWN', error: String(e.message) }
  }
}

// Multi-party LoanSet: first party signs, counterparty adds CounterpartySignature.
export function signCounterparty(tx, counterpartyWallet) {
  const withSig = {
    ...tx,
    CounterpartySignature: {
      SigningPubKey: counterpartyWallet.publicKey,
      TxnSignature: sign(encodeForSigningCounterparty(tx), counterpartyWallet.privateKey),
    },
  }
  return { tx: withSig, tx_blob: encode(withSig) }
}

export async function submitLoanSet(client, firstParty, counterparty, tx, label, expect = 'tesSUCCESS') {
  try {
    const prepared = await client.autofill(tx)
    const signed = firstParty.sign(prepared)
    // wallet.sign() returns { tx_blob, hash } only: decode the blob to get the signed fields back.
    const { tx_blob } = signCounterparty(decode(signed.tx_blob), counterparty)
    const r = await client.submitAndWait(tx_blob)
    const code = r.result.meta.TransactionResult
    const mark = code === expect ? 'OK  ' : 'DIFF'
    console.log(`  ${mark} ${label.padEnd(34)} ${code.padEnd(24)} ${r.result.hash}`)
    return { ok: code === 'tesSUCCESS', code, meta: r.result.meta, hash: r.result.hash }
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(34)} ${String(e.message).slice(0, 160)}`)
    return { ok: false, code: 'THROWN', error: String(e.message) }
  }
}

export async function connect(key) {
  const net = NETS[key]
  const client = new Client(net.wss)
  await client.connect()
  const info = await client.request({ command: 'server_info' })
  console.log(`\n=== ${net.name}`)
  console.log(`  rippled ${info.result.info.build_version}  network_id ${info.result.info.network_id}  xrpl.js ${(await import('xrpl/package.json', { with: { type: 'json' } })).default.version}`)
  return { client, net }
}
