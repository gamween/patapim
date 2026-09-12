// Experiment: can a Single Asset Vault hold an MPT as its Asset?
// Assignment slug: mpt-vault-asset. Target: TRACK 2 public XRPL devnet (LendingProtocolV1_1).
//
// Answers, on chain:
//  1. VaultCreate with Asset = { mpt_issuance_id }           -> works?
//  2. VaultDeposit with Amount = { mpt_issuance_id, value }  -> works?
//  3. Which MPTokenIssuance flags are MANDATORY for (1)?
//  4. Does the vault pseudo-account need explicit MPT authorisation?
//  5. What are the vault shares when the asset is an MPT?
//  6. Scale + MPT asset, vault-of-vault-shares, closed-ended + MPT.
import { Client, Wallet } from 'xrpl'
import { connect, fund, submit, createdId, hex, sleep } from '../lib/lending.mjs'

const AMPLE = 500 // ledger close wait ms

// MPTokenIssuanceID = 4-byte big-endian Sequence || 20-byte issuer AccountID (rippled
// src/libxrpl/protocol/Indexes.cpp:205 makeMptID). Recent rippled also puts
// `mpt_issuance_id` straight into the tx metadata; we prefer that and fall back.
function mptIdFromMeta(meta) {
  if (meta?.mpt_issuance_id) return meta.mpt_issuance_id
  for (const n of meta?.AffectedNodes ?? []) {
    const c = n.CreatedNode
    if (c?.LedgerEntryType === 'MPTokenIssuance') {
      if (c.NewFields?.mpt_issuance_id) return c.NewFields.mpt_issuance_id
      return c.LedgerIndex // NOT the MPTID, but keep it for diagnostics
    }
  }
  return null
}

const F = {
  tfMPTCanLock: 0x00000002,
  tfMPTRequireAuth: 0x00000004,
  tfMPTCanEscrow: 0x00000008,
  tfMPTCanTrade: 0x00000010,
  tfMPTCanTransfer: 0x00000020,
  tfMPTCanClawback: 0x00000040,
}

const results = []
const rec = (name, r, note = '') => {
  results.push({ name, code: r.code, hash: r.hash ?? null, note })
  return r
}

async function issueMpt(client, issuer, flags, label, extra = {}) {
  const tx = {
    TransactionType: 'MPTokenIssuanceCreate',
    Account: issuer.classicAddress,
    AssetScale: 2,
    MaximumAmount: '100000000',
    Flags: flags,
    MPTokenMetadata: hex(JSON.stringify({ name: label })),
    ...extra,
  }
  const r = await submit(client, issuer, tx, `MPTokenIssuanceCreate ${label}`)
  const id = mptIdFromMeta(r.meta)
  console.log(`       mpt_issuance_id = ${id}`)
  return { r, id }
}

async function main() {
  const { client, net } = await connect('t2')

  console.log('\n-- funding accounts')
  const issuer = await fund(net, 'issuer')
  const owner = await fund(net, 'vaultowner')
  const depositor = await fund(net, 'depositor')
  await sleep(AMPLE)

  // ---------------------------------------------------------------- A: baseline
  console.log('\n== A. Fully-featured MPT (CanTransfer|CanTrade|CanEscrow|CanClawback|CanLock)')
  const flagsFull = F.tfMPTCanLock | F.tfMPTCanEscrow | F.tfMPTCanTrade | F.tfMPTCanTransfer | F.tfMPTCanClawback
  const { r: ra, id: SEC } = await issueMpt(client, issuer, flagsFull, 'RECALL-TBILL')
  rec('A1 MPTokenIssuanceCreate full flags', ra)
  if (!SEC) { console.log('no mpt id, abort'); await client.disconnect(); return }

  rec('A2 depositor MPTokenAuthorize', await submit(client, depositor, {
    TransactionType: 'MPTokenAuthorize', Account: depositor.classicAddress, MPTokenIssuanceID: SEC,
  }, 'MPTokenAuthorize depositor'))

  rec('A3 issuer pays MPT to depositor', await submit(client, issuer, {
    TransactionType: 'Payment', Account: issuer.classicAddress, Destination: depositor.classicAddress,
    Amount: { mpt_issuance_id: SEC, value: '500000' },
  }, 'Payment MPT -> depositor'))

  console.log('\n   -> VaultCreate with Asset = { mpt_issuance_id }')
  const vc = {
    TransactionType: 'VaultCreate', Account: owner.classicAddress,
    Asset: { mpt_issuance_id: SEC },
    AssetsMaximum: '1000000',
    WithdrawalPolicy: 1,
    Data: hex('recall-mpt-vault'),
  }
  console.log('      JSON: ' + JSON.stringify(vc))
  const rvc = rec('A4 VaultCreate MPT asset', await submit(client, owner, vc, 'VaultCreate (MPT asset)'))
  const vaultId = createdId(rvc.meta, 'Vault')
  console.log(`      VaultID = ${vaultId}`)

  let shareMPT = null, vaultPseudo = null
  if (vaultId) {
    const le = await client.request({ command: 'ledger_entry', vault: vaultId, ledger_index: 'validated' }).catch(async () => {
      return client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })
    })
    const node = le.result.node
    shareMPT = node.ShareMPTID; vaultPseudo = node.Account
    console.log('      Vault object: ' + JSON.stringify({
      Asset: node.Asset, ShareMPTID: node.ShareMPTID, Account: node.Account,
      Scale: node.Scale, AssetsTotal: node.AssetsTotal, VaultKind: node.VaultKind, LEVersion: node.LEVersion,
    }))
  }

  console.log('\n   -> VaultDeposit with Amount = { mpt_issuance_id, value }')
  const vd = {
    TransactionType: 'VaultDeposit', Account: depositor.classicAddress,
    VaultID: vaultId, Amount: { mpt_issuance_id: SEC, value: '100000' },
  }
  console.log('      JSON: ' + JSON.stringify(vd))
  rec('A5 VaultDeposit MPT', await submit(client, depositor, vd, 'VaultDeposit (MPT)'))

  // what did the depositor get as shares, and what does the vault pseudo hold?
  if (shareMPT) {
    const si = await client.request({ command: 'ledger_entry', mpt_issuance: shareMPT, ledger_index: 'validated' }).catch(e => ({ error: String(e.message) }))
    console.log('      SHARE MPTokenIssuance: ' + JSON.stringify(si.result?.node ?? si))
    const objs = await client.request({ command: 'account_objects', account: depositor.classicAddress, type: 'mptoken', ledger_index: 'validated' })
    console.log('      depositor MPTokens: ' + JSON.stringify(objs.result.account_objects.map(o => ({ id: o.MPTokenIssuanceID, amt: o.MPTAmount, flags: o.Flags }))))
  }
  if (vaultPseudo) {
    const objs = await client.request({ command: 'account_objects', account: vaultPseudo, ledger_index: 'validated' })
    console.log('      vault pseudo objects: ' + JSON.stringify(objs.result.account_objects.map(o => ({ t: o.LedgerEntryType, id: o.MPTokenIssuanceID, amt: o.MPTAmount, flags: o.Flags }))))
  }

  // ------------------------------------------------- B: MPT without CanTransfer
  console.log('\n== B. MPT WITHOUT tfMPTCanTransfer -> expect tecNO_AUTH at VaultCreate preclaim')
  const { id: NOXFER } = await issueMpt(client, issuer, F.tfMPTCanTrade, 'NO-TRANSFER')
  rec('B1 VaultCreate, MPT lacking CanTransfer', await submit(client, owner, {
    TransactionType: 'VaultCreate', Account: owner.classicAddress, Asset: { mpt_issuance_id: NOXFER },
  }, 'VaultCreate (no CanTransfer)', 'tecNO_AUTH'))

  // -------------------------------------------------------- C: Scale + MPT
  console.log('\n== C. Scale on an MPT-asset vault -> expect temMALFORMED (rippled) / SDK throw')
  try {
    rec('C1 VaultCreate Scale+MPT', await submit(client, owner, {
      TransactionType: 'VaultCreate', Account: owner.classicAddress,
      Asset: { mpt_issuance_id: SEC }, Scale: 6,
    }, 'VaultCreate (Scale + MPT)', 'temMALFORMED'))
  } catch (e) { rec('C1 VaultCreate Scale+MPT', { code: 'SDK_THROW' }, String(e.message).slice(0, 120)) }

  // ------------------------------------------- D: require-auth MPT as vault asset
  console.log('\n== D. MPT with tfMPTRequireAuth as the vault asset (does the pseudo need auth?)')
  const { id: RA } = await issueMpt(client, issuer, F.tfMPTCanTransfer | F.tfMPTRequireAuth | F.tfMPTCanTrade, 'GATED-SEC')
  rec('D1 depositor MPTokenAuthorize (gated)', await submit(client, depositor, {
    TransactionType: 'MPTokenAuthorize', Account: depositor.classicAddress, MPTokenIssuanceID: RA,
  }, 'MPTokenAuthorize depositor (gated)'))
  rec('D2 issuer authorizes depositor', await submit(client, issuer, {
    TransactionType: 'MPTokenAuthorize', Account: issuer.classicAddress, MPTokenIssuanceID: RA, Holder: depositor.classicAddress,
  }, 'issuer authorizes depositor'))
  rec('D3 issuer pays gated MPT', await submit(client, issuer, {
    TransactionType: 'Payment', Account: issuer.classicAddress, Destination: depositor.classicAddress,
    Amount: { mpt_issuance_id: RA, value: '200000' },
  }, 'Payment gated MPT -> depositor'))
  const rvc2 = rec('D4 VaultCreate, require-auth MPT', await submit(client, owner, {
    TransactionType: 'VaultCreate', Account: owner.classicAddress, Asset: { mpt_issuance_id: RA },
  }, 'VaultCreate (require-auth MPT)'))
  const vault2 = createdId(rvc2.meta, 'Vault')
  console.log(`      VaultID2 = ${vault2}`)
  if (vault2) {
    const le = await client.request({ command: 'ledger_entry', vault: vault2, ledger_index: 'validated' })
    const pseudo = le.result.node.Account
    const objs = await client.request({ command: 'account_objects', account: pseudo, type: 'mptoken', ledger_index: 'validated' })
    console.log('      vault2 pseudo MPTokens (flags 2 = lsfMPTAuthorized): ' + JSON.stringify(objs.result.account_objects.map(o => ({ id: o.MPTokenIssuanceID, flags: o.Flags ?? 0 }))))
    rec('D5 VaultDeposit into require-auth vault (pseudo NOT authorized by issuer)', await submit(client, depositor, {
      TransactionType: 'VaultDeposit', Account: depositor.classicAddress, VaultID: vault2,
      Amount: { mpt_issuance_id: RA, value: '50000' },
    }, 'VaultDeposit (require-auth MPT)'))
  }

  // ------------------------------------------- E: vault shares as a vault asset
  if (shareMPT) {
    console.log('\n== E. Vault of vault-shares -> expect tecWRONG_ASSET (pseudo-account issuer)')
    rec('E1 VaultCreate with share MPT as asset', await submit(client, owner, {
      TransactionType: 'VaultCreate', Account: owner.classicAddress, Asset: { mpt_issuance_id: shareMPT },
    }, 'VaultCreate (share MPT as asset)', 'tecWRONG_ASSET'))
  }

  // ------------------------------- F: closed-ended vault whose asset is an MPT
  console.log('\n== F. CLOSED-ENDED vault (VaultKind=1) whose asset is the security MPT')
  const RIPPLE_EPOCH = 946684800
  const now = Math.floor(Date.now() / 1000) - RIPPLE_EPOCH
  const rvc3 = rec('F1 VaultCreate closed-ended + MPT', await submit(client, owner, {
    TransactionType: 'VaultCreate', Account: owner.classicAddress,
    Asset: { mpt_issuance_id: SEC },
    VaultKind: 1, SubscriptionDate: now + 120, RedemptionDate: now + 120 + 300,
    Data: hex('recall-closed-mpt'),
  }, 'VaultCreate (closed-ended, MPT asset)'))
  const vault3 = createdId(rvc3.meta, 'Vault')
  console.log(`      VaultID3 = ${vault3}`)
  if (vault3) {
    rec('F2 VaultDeposit in subscription phase', await submit(client, depositor, {
      TransactionType: 'VaultDeposit', Account: depositor.classicAddress, VaultID: vault3,
      Amount: { mpt_issuance_id: SEC, value: '70000' },
    }, 'VaultDeposit (closed-ended MPT, subscription)'))
  }

  console.log('\n===== SUMMARY =====')
  for (const r of results) console.log(`${r.code.padEnd(22)} ${r.name}${r.hash ? '  ' + r.hash : ''}${r.note ? '  // ' + r.note : ''}`)
  console.log('\nSEC mpt_issuance_id      = ' + SEC)
  console.log('vault (open, MPT asset)  = ' + vaultId)
  console.log('share MPTID              = ' + shareMPT)
  console.log('vault pseudo account     = ' + vaultPseudo)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
