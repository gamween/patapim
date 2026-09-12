// slug: mpt-vault-asset
// Question: what can a Single Asset Vault hold as its Asset, and is the WHOLE
// XLS-66 lending spine denominated in a tokenised-security MPT?
// Network: TRACK 1 (lending-hackathon devnet). Open-ended vault, because the
// hackathon branch reverts PR #8076 so LoanBrokerSet accepts open-ended vaults
// there -> no wall-clock phases needed for the full spine.
import { connect, fund, submit, submitLoanSet, createdId, hex, sleep } from '../lib/lending.mjs'

const F = {
  tfMPTCanLock: 0x00000002,
  tfMPTRequireAuth: 0x00000004,
  tfMPTCanEscrow: 0x00000008,
  tfMPTCanTrade: 0x00000010,
  tfMPTCanTransfer: 0x00000020,
  tfMPTCanClawback: 0x00000040,
}

const log = []
const rec = (step, r, note = '') => { log.push({ step, code: r.code, hash: r.hash ?? null, note }); return r }
const J = (o) => JSON.stringify(o)

const mptId = (r) => r.meta?.mpt_issuance_id ?? null

async function readLE(client, req, label) {
  try {
    const r = await client.request({ ...req, ledger_index: 'validated' })
    return r.result.node
  } catch (e) { console.log(`      (ledger_entry ${label} failed: ${String(e.message).slice(0, 120)})`); return null }
}

async function mptsOf(client, acct) {
  try {
    const r = await client.request({ command: 'account_objects', account: acct, type: 'mptoken', ledger_index: 'validated' })
    return r.result.account_objects.map(o => ({ id: o.MPTokenIssuanceID, amt: o.MPTAmount ?? '0', flags: o.Flags ?? 0 }))
  } catch (e) { return [{ err: String(e.message).slice(0, 100) }] }
}

const main = async () => {
  const { client, net } = await connect('t1')

  console.log('\n-- funding 4 accounts')
  const issuer = await fund(net, 'issuer')
  const agent = await fund(net, 'agent')     // vault owner + LoanBroker owner
  const lender = await fund(net, 'lender')   // security holder -> vault depositor
  const mm = await fund(net, 'marketmkr')    // borrower
  await sleep(4000)

  // ============================================================ 1. the security MPT
  console.log('\n== 1. MPTokenIssuanceCreate: the tokenised security')
  const issTx = {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 2, MaximumAmount: '1000000000',
    Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTCanEscrow | F.tfMPTCanClawback | F.tfMPTCanLock,
    MPTokenMetadata: hex(JSON.stringify({ ticker: 'TBILL', name: 'patapim T-Bill' })),
  }
  const iss = rec('1 MPTokenIssuanceCreate SEC', await submit(client, issuer, issTx, 'MPTokenIssuanceCreate SEC'))
  const SEC = mptId(iss)
  console.log(`      mpt_issuance_id SEC = ${SEC}`)
  if (!SEC) { await client.disconnect(); return }

  for (const [w, n] of [[lender, 'lender'], [mm, 'marketmkr'], [agent, 'agent']]) {
    rec(`1.${n} MPTokenAuthorize`, await submit(client, w, {
      TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: SEC,
    }, `MPTokenAuthorize ${n}`))
    rec(`1.${n} Payment SEC`, await submit(client, issuer, {
      TransactionType: 'Payment', Account: issuer.classicAddress, Destination: w.classicAddress,
      Amount: { mpt_issuance_id: SEC, value: '10000000' },
    }, `Payment SEC -> ${n}`))
  }

  // ============================================================ 2. VaultCreate with MPT asset
  console.log('\n== 2. VaultCreate, Asset = { mpt_issuance_id }')
  const vcTx = {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: SEC },
    AssetsMaximum: '900000000',
    WithdrawalPolicy: 1,
    Data: hex('recall securities vault'),
  }
  console.log('      TX JSON: ' + J(vcTx))
  const vc = rec('2 VaultCreate (MPT asset)', await submit(client, agent, vcTx, 'VaultCreate (MPT asset)'))
  const vaultId = createdId(vc.meta, 'Vault')
  console.log(`      VaultID = ${vaultId}`)
  if (!vaultId) { console.log('ABORT: no vault'); await client.disconnect(); return }

  const vnode = await readLE(client, { command: 'ledger_entry', vault: vaultId }, 'vault')
  console.log('      Vault LE: ' + J(vnode))
  const SHARE = vnode?.ShareMPTID
  const PSEUDO = vnode?.Account
  console.log(`      ShareMPTID = ${SHARE}`)
  console.log(`      pseudo-account = ${PSEUDO}`)

  const shareIss = await readLE(client, { command: 'ledger_entry', mpt_issuance: SHARE }, 'share issuance')
  console.log('      SHARE MPTokenIssuance: ' + J(shareIss))
  console.log('      pseudo MPTokens right after VaultCreate: ' + J(await mptsOf(client, PSEUDO)))
  console.log('      agent  MPTokens right after VaultCreate: ' + J(await mptsOf(client, agent.classicAddress)))

  // ============================================================ 3. deposit the security
  console.log('\n== 3. VaultDeposit, Amount = { mpt_issuance_id, value }')
  const vdTx = {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SEC, value: '5000000' },
  }
  console.log('      TX JSON: ' + J(vdTx))
  rec('3 VaultDeposit 5000000 SEC', await submit(client, lender, vdTx, 'VaultDeposit (SEC)'))
  console.log('      lender MPTokens: ' + J(await mptsOf(client, lender.classicAddress)))
  console.log('      pseudo MPTokens: ' + J(await mptsOf(client, PSEUDO)))
  console.log('      Vault after deposit: ' + J(await readLE(client, { command: 'ledger_entry', vault: vaultId }, 'vault')))
  console.log('      SHARE issuance after deposit: ' + J(await readLE(client, { command: 'ledger_entry', mpt_issuance: SHARE }, 'share')))

  // fractional MPT deposit
  rec('3b VaultDeposit fractional', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SEC, value: '100.5' },
  }, 'VaultDeposit 100.5 SEC', 'tecPRECISION_LOSS'))

  // ============================================================ 4. LoanBroker on an MPT vault
  console.log('\n== 4. LoanBrokerSet on an MPT-denominated vault')
  const lb = rec('4 LoanBrokerSet', await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultId,
    ManagementFeeRate: 100, DebtMaximum: '4000000',
    CoverRateMinimum: 1000, CoverRateLiquidation: 1000,
    Data: hex('recall lending agent'),
  }, 'LoanBrokerSet (MPT vault)'))
  const brokerId = createdId(lb.meta, 'LoanBroker')
  console.log(`      LoanBrokerID = ${brokerId}`)
  const bnode = brokerId ? await readLE(client, { command: 'ledger_entry', index: brokerId }, 'broker') : null
  console.log('      LoanBroker LE: ' + J(bnode))
  const BPSEUDO = bnode?.Account
  console.log('      broker pseudo MPTokens (pre-cover): ' + J(await mptsOf(client, BPSEUDO)))

  // ============================================================ 5. first-loss cover in the security
  console.log('\n== 5. LoanBrokerCoverDeposit in the SECURITY')
  const cdTx = {
    TransactionType: 'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerId,
    Amount: { mpt_issuance_id: SEC, value: '1000000' },
  }
  console.log('      TX JSON: ' + J(cdTx))
  rec('5 LoanBrokerCoverDeposit SEC', await submit(client, agent, cdTx, 'LoanBrokerCoverDeposit (SEC)'))
  console.log('      broker pseudo MPTokens: ' + J(await mptsOf(client, BPSEUDO)))
  console.log('      LoanBroker LE: ' + J(await readLE(client, { command: 'ledger_entry', index: brokerId }, 'broker')))

  // ============================================================ 6. originate the loan in security units
  console.log('\n== 6. LoanSet, principal in security units (two signatures)')
  const loanTx = {
    TransactionType: 'LoanSet', Account: agent.classicAddress, Counterparty: mm.classicAddress,
    LoanBrokerID: brokerId, PrincipalRequested: '2000000', InterestRate: 5000,
    PaymentInterval: 300, PaymentTotal: 2, GracePeriod: 120,
    LoanOriginationFee: '1000', LateInterestRate: 1000, ClosePaymentPeriod: 60,
    Data: hex('recall securities loan'),
  }
  console.log('      TX JSON (pre-sign): ' + J(loanTx))
  const before = await mptsOf(client, mm.classicAddress)
  const ls = rec('6 LoanSet (SEC principal)', await submitLoanSet(client, agent, mm, loanTx, 'LoanSet (SEC principal)'))
  const loanId = ls.meta ? createdId(ls.meta, 'Loan') : null
  console.log(`      LoanID = ${loanId}`)
  if (loanId) console.log('      Loan LE: ' + J(await readLE(client, { command: 'ledger_entry', index: loanId }, 'loan')))
  console.log('      marketmaker MPTokens BEFORE: ' + J(before))
  console.log('      marketmaker MPTokens AFTER : ' + J(await mptsOf(client, mm.classicAddress)))
  console.log('      Vault after LoanSet: ' + J(await readLE(client, { command: 'ledger_entry', vault: vaultId }, 'vault')))

  // ============================================================ 7. repay in security units
  if (loanId) {
    console.log('\n== 7. LoanPay in the SECURITY')
    const lpTx = {
      TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: loanId,
      Amount: { mpt_issuance_id: SEC, value: '2200000' },
    }
    console.log('      TX JSON: ' + J(lpTx))
    rec('7 LoanPay SEC', await submit(client, mm, lpTx, 'LoanPay (SEC)'))
    console.log('      Loan after pay: ' + J(await readLE(client, { command: 'ledger_entry', index: loanId }, 'loan')))
    console.log('      Vault after pay: ' + J(await readLE(client, { command: 'ledger_entry', vault: vaultId }, 'vault')))
  }

  // ============================================================ 8. withdraw the security
  console.log('\n== 8. VaultWithdraw back into the security')
  const vwTx = {
    TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SEC, value: '1000000' },
  }
  console.log('      TX JSON: ' + J(vwTx))
  rec('8 VaultWithdraw SEC', await submit(client, lender, vwTx, 'VaultWithdraw (SEC)'))
  console.log('      lender MPTokens: ' + J(await mptsOf(client, lender.classicAddress)))

  // ============================================================ 9. negative controls
  console.log('\n== 9. negative controls')

  // 9a MPT without CanTransfer
  const noXfer = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 2, MaximumAmount: '1000000', Flags: F.tfMPTCanTrade,
  }, 'MPTokenIssuanceCreate NO-TRANSFER')
  const NOXFER = mptId(noXfer)
  rec('9a VaultCreate, MPT lacks CanTransfer', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: NOXFER },
  }, 'VaultCreate (no CanTransfer)', 'tecNO_AUTH'), 'expects tecNO_AUTH from canAddHolding')

  // 9b Scale + MPT
  try {
    rec('9b VaultCreate Scale+MPT', await submit(client, agent, {
      TransactionType: 'VaultCreate', Account: agent.classicAddress,
      Asset: { mpt_issuance_id: SEC }, Scale: 6,
    }, 'VaultCreate (Scale + MPT)', 'temMALFORMED'))
  } catch (e) { rec('9b VaultCreate Scale+MPT', { code: 'SDK_THROW' }, String(e.message).slice(0, 140)) }

  // 9c vault of vault shares
  rec('9c VaultCreate with SHARE MPT as asset', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: SHARE },
  }, 'VaultCreate (share MPT as asset)', 'tecWRONG_ASSET'))

  // 9d nonexistent MPT
  rec('9d VaultCreate, unknown mpt_issuance_id', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: '00000001' + '0'.repeat(40) },
  }, 'VaultCreate (unknown MPT)', 'tecOBJECT_NOT_FOUND'))

  // ============================================================ 10. require-auth MPT
  console.log('\n== 10. MPT with tfMPTRequireAuth as the vault asset')
  const gated = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 2, MaximumAmount: '1000000000',
    Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTRequireAuth | F.tfMPTCanClawback,
  }, 'MPTokenIssuanceCreate GATED')
  const GATED = mptId(gated)
  console.log(`      mpt_issuance_id GATED = ${GATED}`)
  rec('10a lender opts in (gated)', await submit(client, lender, {
    TransactionType: 'MPTokenAuthorize', Account: lender.classicAddress, MPTokenIssuanceID: GATED,
  }, 'MPTokenAuthorize lender (gated)'))
  rec('10b issuer authorizes lender', await submit(client, issuer, {
    TransactionType: 'MPTokenAuthorize', Account: issuer.classicAddress, MPTokenIssuanceID: GATED, Holder: lender.classicAddress,
  }, 'issuer authorizes lender'))
  rec('10c issuer pays gated MPT', await submit(client, issuer, {
    TransactionType: 'Payment', Account: issuer.classicAddress, Destination: lender.classicAddress,
    Amount: { mpt_issuance_id: GATED, value: '5000000' },
  }, 'Payment GATED -> lender'))
  const gv = rec('10d VaultCreate, gated MPT asset', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: GATED },
  }, 'VaultCreate (gated MPT)'))
  const gVault = createdId(gv.meta, 'Vault')
  console.log(`      gated VaultID = ${gVault}`)
  if (gVault) {
    const gnode = await readLE(client, { command: 'ledger_entry', vault: gVault }, 'gated vault')
    const gPseudo = gnode?.Account
    console.log('      gated pseudo MPTokens (flags 2 = lsfMPTAuthorized): ' + J(await mptsOf(client, gPseudo)))
    rec('10e VaultDeposit into gated vault, pseudo NOT authorized by issuer', await submit(client, lender, {
      TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: gVault,
      Amount: { mpt_issuance_id: GATED, value: '1000000' },
    }, 'VaultDeposit (gated MPT)'))
    console.log('      gated pseudo MPTokens after deposit: ' + J(await mptsOf(client, gPseudo)))
    // and can a NON-authorized holder deposit? mm never opted in to GATED
    rec('10f VaultDeposit by unauthorized account', await submit(client, mm, {
      TransactionType: 'VaultDeposit', Account: mm.classicAddress, VaultID: gVault,
      Amount: { mpt_issuance_id: GATED, value: '100' },
    }, 'VaultDeposit (gated, unauth holder)', 'tecNO_AUTH'))
  }

  // ============================================================ 11. IOU and XRP controls
  console.log('\n== 11. IOU + XRP vault asset controls')
  rec('11a VaultCreate XRP asset', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { currency: 'XRP' },
  }, 'VaultCreate (XRP asset)'))
  // IOU needs DefaultRipple on the issuer
  rec('11b issuer AccountSet asfDefaultRipple', await submit(client, issuer, {
    TransactionType: 'AccountSet', Account: issuer.classicAddress, SetFlag: 8,
  }, 'AccountSet DefaultRipple'))
  rec('11c VaultCreate IOU asset, Scale 4', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { currency: 'EUR', issuer: issuer.classicAddress }, Scale: 4,
  }, 'VaultCreate (IOU asset, Scale 4)'))

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(22)} ${r.step.padEnd(46)} ${r.hash ?? ''} ${r.note}`)
  console.log(`\nSEC    = ${SEC}\nVAULT  = ${vaultId}\nSHARE  = ${SHARE}\nPSEUDO = ${PSEUDO}\nBROKER = ${brokerId}\nGATED  = ${GATED}`)
  console.log(`accounts: issuer=${issuer.classicAddress} agent=${agent.classicAddress} lender=${lender.classicAddress} mm=${mm.classicAddress}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
