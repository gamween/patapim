// slug: mpt-vault-asset, run 4. Last two questions, cached accounts.
// F: is lsfMPTCanClawback required for VaultClawback on an MPT-asset vault?
// G: can the vault owner also be the MPT issuer (self-issued security)?
import fs from 'node:fs'
import { Wallet } from 'xrpl'
import { connect, submit, createdId, hex, sleep } from '../lib/lending.mjs'
const CACHE = '/private/tmp/claude-501/-Users-fianso-Development-hackathons-patapim/8aa6c9a4-f1d0-41c5-ad64-3a3f5d140504/scratchpad/mpt-vault-asset-seeds.json'
const F = { tfMPTCanTrade: 0x10, tfMPTCanTransfer: 0x20, tfMPTCanClawback: 0x40 }
const J = (o) => JSON.stringify(o)
const le = async (c, r) => { try { return (await c.request({ ...r, ledger_index: 'validated' })).result.node } catch (e) { return { ERR: String(e.message).slice(0, 120) } } }

const main = async () => {
  const { client } = await connect('t1')
  const s = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const { issuer, agent, lender } = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Wallet.fromSeed(v)]))

  console.log('\n== F. MPT WITHOUT lsfMPTCanClawback as the vault asset')
  const nc = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000', Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade,
  }, 'MPTokenIssuanceCreate NOCLAW')
  const NOCLAW = nc.meta?.mpt_issuance_id
  console.log(`      NOCLAW = ${NOCLAW}`)
  await submit(client, lender, { TransactionType: 'MPTokenAuthorize', Account: lender.classicAddress, MPTokenIssuanceID: NOCLAW }, 'lender opts in NOCLAW')
  await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: lender.classicAddress, Amount: { mpt_issuance_id: NOCLAW, value: '500000' } }, 'Payment NOCLAW -> lender')
  const v = await submit(client, agent, { TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: NOCLAW } }, 'VaultCreate (NOCLAW asset)')
  const vid = createdId(v.meta, 'Vault')
  console.log(`      VaultID = ${vid}`)
  await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vid, Amount: { mpt_issuance_id: NOCLAW, value: '100000' } }, 'VaultDeposit (NOCLAW)')
  await submit(client, issuer, {
    TransactionType: 'VaultClawback', Account: issuer.classicAddress, VaultID: vid,
    Holder: lender.classicAddress, Amount: { mpt_issuance_id: NOCLAW, value: '1000' },
  }, 'VaultClawback (no CanClawback flag)', 'tecNO_PERMISSION')

  console.log('\n== G. vault owner IS the MPT issuer (self-issued security)')
  const si = await submit(client, agent, {
    TransactionType: 'MPTokenIssuanceCreate', Account: agent.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000', Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTCanClawback,
  }, 'MPTokenIssuanceCreate SELF (agent issues)')
  const SELF = si.meta?.mpt_issuance_id
  console.log(`      SELF = ${SELF}`)
  const v2 = await submit(client, agent, { TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: SELF } }, 'VaultCreate (self-issued MPT)')
  const vid2 = createdId(v2.meta, 'Vault')
  console.log(`      VaultID = ${vid2}`)
  if (vid2) {
    const n = await le(client, { command: 'ledger_entry', vault: vid2 })
    console.log('      pseudo = ' + n.Account)
    await submit(client, lender, { TransactionType: 'MPTokenAuthorize', Account: lender.classicAddress, MPTokenIssuanceID: SELF }, 'lender opts in SELF')
    await submit(client, agent, { TransactionType: 'Payment', Account: agent.classicAddress, Destination: lender.classicAddress, Amount: { mpt_issuance_id: SELF, value: '400000' } }, 'Payment SELF -> lender')
    await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vid2, Amount: { mpt_issuance_id: SELF, value: '200000' } }, 'VaultDeposit (self-issued MPT)')
    // issuer==owner: clawback with no Amount is ambiguous -> tecWRONG_ASSET (VaultClawback.cpp:113)
    await submit(client, agent, { TransactionType: 'VaultClawback', Account: agent.classicAddress, VaultID: vid2, Holder: lender.classicAddress }, 'VaultClawback no Amount, issuer==owner', 'tecWRONG_ASSET')
    await submit(client, agent, { TransactionType: 'VaultClawback', Account: agent.classicAddress, VaultID: vid2, Holder: lender.classicAddress, Amount: { mpt_issuance_id: SELF, value: '50000' } }, 'VaultClawback explicit Amount, issuer==owner')
    console.log('      vault: ' + J(await le(client, { command: 'ledger_entry', vault: vid2 })))
  }
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
