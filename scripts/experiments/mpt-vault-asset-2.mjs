// slug: mpt-vault-asset, run 2.
// Completes the lending spine on an MPT-denominated vault (run 1 died on a bad
// field name in LoanSet) and adds the probes that need raw signing.
// Seeds are cached so this script can be re-run without touching the faucet.
import fs from 'node:fs'
import { Wallet } from 'xrpl'
import { encode, encodeForSigning } from 'ripple-binary-codec'
import { sign } from 'ripple-keypairs'
import { connect, fund, submit, submitLoanSet, createdId, hex, sleep } from '../lib/lending.mjs'

const CACHE = '/private/tmp/claude-501/-Users-fianso-Development-hackathons-patapim/8aa6c9a4-f1d0-41c5-ad64-3a3f5d140504/scratchpad/mpt-vault-asset-seeds.json'
const F = { tfMPTCanLock: 0x2, tfMPTRequireAuth: 0x4, tfMPTCanEscrow: 0x8, tfMPTCanTrade: 0x10, tfMPTCanTransfer: 0x20, tfMPTCanClawback: 0x40 }
const J = (o) => JSON.stringify(o)
const log = []
const rec = (s, r, n = '') => { log.push({ s, code: r.code, hash: r.hash ?? null, n }); return r }
const mptId = (r) => r.meta?.mpt_issuance_id ?? null

// Submit WITHOUT xrpl.js model validation, to see what rippled itself says.
async function rawSubmit(client, wallet, tx, label, expect = 'tesSUCCESS') {
  try {
    const p = await client.autofill(tx)
    p.SigningPubKey = wallet.publicKey
    p.TxnSignature = sign(encodeForSigning(p), wallet.privateKey)
    const r = await client.submitAndWait(encode(p))
    const code = r.result.meta.TransactionResult
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(38)} ${code.padEnd(22)} ${r.result.hash}`)
    return { ok: code === 'tesSUCCESS', code, meta: r.result.meta, hash: r.result.hash }
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(38)} ${String(e.message).slice(0, 170)}`)
    return { code: 'THROWN', error: String(e.message) }
  }
}

async function wallets(net) {
  if (fs.existsSync(CACHE)) {
    const s = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
    console.log('  reusing cached accounts')
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Wallet.fromSeed(v)]))
  }
  const out = {}
  for (const n of ['issuer', 'agent', 'lender', 'mm']) { out[n] = await fund(net, n); await sleep(1500) }
  fs.writeFileSync(CACHE, JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, w]) => [k, w.seed]))))
  return out
}

const le = async (client, req) => {
  try { return (await client.request({ ...req, ledger_index: 'validated' })).result.node } catch (e) { return { ERR: String(e.message).slice(0, 140) } }
}
const mpts = async (client, a) => {
  try {
    const r = await client.request({ command: 'account_objects', account: a, type: 'mptoken', ledger_index: 'validated' })
    return r.result.account_objects.map(o => ({ id: o.MPTokenIssuanceID, amt: o.MPTAmount ?? '0', flags: o.Flags ?? 0, index: o.index }))
  } catch (e) { return [{ ERR: String(e.message).slice(0, 100) }] }
}

const main = async () => {
  const { client, net } = await connect('t1')
  const { issuer, agent, lender, mm } = await wallets(net)
  console.log(`  issuer=${issuer.classicAddress} agent=${agent.classicAddress} lender=${lender.classicAddress} mm=${mm.classicAddress}`)
  await sleep(3000)

  // ---- the tokenised security
  console.log('\n== 1. tokenised security MPT')
  const iss = rec('1 MPTokenIssuanceCreate SEC', await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 2, MaximumAmount: '1000000000',
    Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTCanEscrow | F.tfMPTCanClawback | F.tfMPTCanLock,
  }, 'MPTokenIssuanceCreate SEC'))
  const SEC = mptId(iss)
  console.log(`      SEC = ${SEC}`)
  for (const [w, n] of [[lender, 'lender'], [mm, 'mm'], [agent, 'agent']]) {
    await submit(client, w, { TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: SEC }, `MPTokenAuthorize ${n}`)
    await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: w.classicAddress, Amount: { mpt_issuance_id: SEC, value: '10000000' } }, `Payment SEC -> ${n}`)
  }

  // ---- vault
  console.log('\n== 2. vault whose Asset is the security')
  const vc = rec('2 VaultCreate MPT asset', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, Data: hex('recall securities vault'),
  }, 'VaultCreate (MPT asset)'))
  const vaultId = createdId(vc.meta, 'Vault')
  const vnode = await le(client, { command: 'ledger_entry', vault: vaultId })
  const SHARE = vnode.ShareMPTID, PSEUDO = vnode.Account
  console.log(`      VaultID=${vaultId}\n      SHARE=${SHARE}  PSEUDO=${PSEUDO}`)
  const shareIss = await le(client, { command: 'ledger_entry', mpt_issuance: SHARE })
  console.log('      SHARE issuance: ' + J(shareIss))
  const pseudoMpts = await mpts(client, PSEUDO)
  console.log('      pseudo MPTokens: ' + J(pseudoMpts))
  console.log(`      ReferenceHolding == pseudo's MPToken index ? ${shareIss.ReferenceHolding === pseudoMpts[0]?.index}`)

  rec('3 VaultDeposit 6000000 SEC', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SEC, value: '6000000' },
  }, 'VaultDeposit (SEC)'))

  // ---- broker + cover
  console.log('\n== 4. LoanBroker + first-loss cover in the security')
  const lb = rec('4 LoanBrokerSet', await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultId,
    ManagementFeeRate: 100, DebtMaximum: '5000000', CoverRateMinimum: 1000, CoverRateLiquidation: 1000,
    Data: hex('recall lending agent'),
  }, 'LoanBrokerSet'))
  const brokerId = createdId(lb.meta, 'LoanBroker')
  console.log(`      BROKER=${brokerId}`)
  rec('5 LoanBrokerCoverDeposit SEC', await submit(client, agent, {
    TransactionType: 'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerId,
    Amount: { mpt_issuance_id: SEC, value: '1000000' },
  }, 'LoanBrokerCoverDeposit (SEC)'))

  // ---- the loan, denominated in the security
  console.log('\n== 6. LoanSet, principal in security units')
  const loanTx = {
    TransactionType: 'LoanSet', Account: agent.classicAddress, Counterparty: mm.classicAddress,
    LoanBrokerID: brokerId, PrincipalRequested: '2000000', InterestRate: 5000,
    PaymentInterval: 300, PaymentTotal: 2, GracePeriod: 120,
    LoanOriginationFee: '1000', LateInterestRate: 1000,
    Data: hex('recall securities loan'),
  }
  console.log('      TX JSON: ' + J(loanTx))
  const mmBefore = await mpts(client, mm.classicAddress)
  const ls = rec('6 LoanSet (SEC principal)', await submitLoanSet(client, agent, mm, loanTx, 'LoanSet (SEC principal)'))
  const loanId = ls.meta ? createdId(ls.meta, 'Loan') : null
  console.log(`      LoanID=${loanId}`)
  if (loanId) console.log('      Loan LE: ' + J(await le(client, { command: 'ledger_entry', index: loanId })))
  console.log('      mm SEC before: ' + J(mmBefore))
  console.log('      mm SEC after : ' + J(await mpts(client, mm.classicAddress)))
  console.log('      Vault: ' + J(await le(client, { command: 'ledger_entry', vault: vaultId })))
  console.log('      Broker: ' + J(await le(client, { command: 'ledger_entry', index: brokerId })))

  // fractional principal against an integral MPT
  rec('6b LoanSet fractional principal', await submitLoanSet(client, agent, mm,
    { ...loanTx, PrincipalRequested: '1000000.5' }, 'LoanSet Principal=1000000.5', 'tecPRECISION_LOSS'))

  // ---- repay
  if (loanId) {
    console.log('\n== 7. LoanPay in the security')
    rec('7 LoanPay 1100000 SEC', await submit(client, mm, {
      TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: loanId,
      Amount: { mpt_issuance_id: SEC, value: '1100000' },
    }, 'LoanPay (SEC)'))
    console.log('      Loan after pay: ' + J(await le(client, { command: 'ledger_entry', index: loanId })))
    rec('7b LoanPay wrong asset (XRP)', await submit(client, mm, {
      TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: loanId, Amount: '1000000',
    }, 'LoanPay in XRP', 'tecWRONG_ASSET'))
  }

  // ---- withdraw
  console.log('\n== 8. VaultWithdraw in the security')
  rec('8 VaultWithdraw 500000 SEC', await submit(client, lender, {
    TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SEC, value: '500000' },
  }, 'VaultWithdraw (SEC)'))
  console.log('      lender: ' + J(await mpts(client, lender.classicAddress)))
  console.log('      Vault: ' + J(await le(client, { command: 'ledger_entry', vault: vaultId })))

  // ---- raw-signed probes that xrpl.js refuses to build
  console.log('\n== 9. probes that bypass xrpl.js validation')
  rec('9a VaultCreate Scale + MPT (raw)', await rawSubmit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: SEC }, Scale: 6,
  }, 'VaultCreate Scale=6 + MPT', 'temMALFORMED'))

  // well-formed but nonexistent MPT issuance id: real issuer, absurd sequence
  const fakeSeq = 'FFFFFFFF'
  const issuerHex = (await import('ripple-address-codec')).decodeAccountID(issuer.classicAddress)
  const FAKE = fakeSeq + Buffer.from(issuerHex).toString('hex').toUpperCase()
  console.log(`      FAKE mpt_issuance_id = ${FAKE}`)
  rec('9b VaultCreate nonexistent MPT', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: FAKE },
  }, 'VaultCreate (nonexistent MPT)', 'tecOBJECT_NOT_FOUND'))

  // ---- do vault shares inherit the underlying MPT's auth gate?
  console.log('\n== 10. gated (require-auth) security -> does the SHARE inherit the gate?')
  const g = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 2, MaximumAmount: '1000000000',
    Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTRequireAuth | F.tfMPTCanClawback,
  }, 'MPTokenIssuanceCreate GATED')
  const GATED = mptId(g)
  console.log(`      GATED = ${GATED}`)
  await submit(client, lender, { TransactionType: 'MPTokenAuthorize', Account: lender.classicAddress, MPTokenIssuanceID: GATED }, 'lender opts in GATED')
  await submit(client, issuer, { TransactionType: 'MPTokenAuthorize', Account: issuer.classicAddress, MPTokenIssuanceID: GATED, Holder: lender.classicAddress }, 'issuer authorizes lender')
  await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: lender.classicAddress, Amount: { mpt_issuance_id: GATED, value: '5000000' } }, 'Payment GATED -> lender')
  const gv = rec('10a VaultCreate gated MPT', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: GATED },
  }, 'VaultCreate (gated MPT)'))
  const gVault = createdId(gv.meta, 'Vault')
  const gnode = await le(client, { command: 'ledger_entry', vault: gVault })
  const GSHARE = gnode.ShareMPTID
  console.log(`      gated VaultID=${gVault} GSHARE=${GSHARE} pseudo=${gnode.Account}`)
  console.log('      gated pseudo MPTokens: ' + J(await mpts(client, gnode.Account)))
  rec('10b VaultDeposit gated (pseudo never authorized)', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: gVault,
    Amount: { mpt_issuance_id: GATED, value: '2000000' },
  }, 'VaultDeposit (gated)'))
  // mm is NOT authorized on GATED. Can it even hold the SHARE MPT?
  rec('10c mm MPTokenAuthorize on GATED share', await submit(client, mm, {
    TransactionType: 'MPTokenAuthorize', Account: mm.classicAddress, MPTokenIssuanceID: GSHARE,
  }, 'mm opts in to gated SHARE', 'tecNO_AUTH'))
  rec('10d lender pays gated SHARE to mm', await submit(client, lender, {
    TransactionType: 'Payment', Account: lender.classicAddress, Destination: mm.classicAddress,
    Amount: { mpt_issuance_id: GSHARE, value: '100' },
  }, 'Payment gated SHARE -> mm', 'tecNO_AUTH'))
  // control: the UNGATED vault's share should be freely transferable
  rec('10e mm MPTokenAuthorize on ungated SHARE', await submit(client, mm, {
    TransactionType: 'MPTokenAuthorize', Account: mm.classicAddress, MPTokenIssuanceID: SHARE,
  }, 'mm opts in to ungated SHARE'))
  rec('10f lender pays ungated SHARE to mm', await submit(client, lender, {
    TransactionType: 'Payment', Account: lender.classicAddress, Destination: mm.classicAddress,
    Amount: { mpt_issuance_id: SHARE, value: '100' },
  }, 'Payment ungated SHARE -> mm'))

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(20)} ${r.s.padEnd(44)} ${r.hash ?? ''} ${r.n}`)
  console.log(`\nSEC=${SEC}\nVAULT=${vaultId}\nSHARE=${SHARE}\nPSEUDO=${PSEUDO}\nBROKER=${brokerId}\nLOAN=${loanId}\nGATED=${GATED}\nGVAULT=${gVault}\nGSHARE=${GSHARE}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
