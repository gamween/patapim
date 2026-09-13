// Finding 1, reproduced offline in one second, no network, no faucet.
//
//   node scripts/experiments/counterparty-signature.mjs
//
// Signs one LoanSet as the counterparty twice: with xrpl.js's own signLoanSetByCounterparty, and
// with scripts/lib/lending.mjs signCounterparty(). Then verifies each signature against the bytes
// rippled hashes under fixCleanup3_4_0 (rippled #8162): encodeForSigningCounterparty, which is the
// CPT hash prefix. A signature that only verifies against encodeForSigning is the one the ledger
// rejects with "Counterparty: Invalid signature".
import { Wallet, signLoanSetByCounterparty } from 'xrpl'
import { decode, encodeForSigning, encodeForSigningCounterparty } from 'ripple-binary-codec'
import { verify } from 'ripple-keypairs'
import { signCounterparty } from '../lib/lending.mjs'

const version = (await import('xrpl/package.json', { with: { type: 'json' } })).default.version
const broker = Wallet.generate()
const borrower = Wallet.generate()

const tx = {
  TransactionType: 'LoanSet', Account: broker.classicAddress, Counterparty: borrower.classicAddress,
  LoanBrokerID: '794653A2DFABC2811C9E2748109AECB50384F9B9C9A39E7BACE7E47177F1DEA9',
  PrincipalRequested: '2000000', InterestRate: 250, PaymentInterval: 3600, PaymentTotal: 1,
  Fee: '24', Sequence: 1, LastLedgerSequence: 100, NetworkID: 2,
}
const firstParty = decode(broker.sign(tx).tx_blob)

const check = (label, signed) => {
  const cps = signed.CounterpartySignature
  // The signature covers the transaction without the CounterpartySignature field itself.
  const { CounterpartySignature: _omit, ...unsigned } = signed
  const asCounterparty = verify(encodeForSigningCounterparty(unsigned), cps.TxnSignature, cps.SigningPubKey)
  const asTransaction = verify(encodeForSigning(unsigned), cps.TxnSignature, cps.SigningPubKey)
  console.log(`  ${label.padEnd(44)} counterparty prefix ${String(asCounterparty).padEnd(5)}  transaction prefix ${asTransaction}`)
  return asCounterparty
}

console.log(`xrpl ${version}`)
let library
try {
  library = check('xrpl.js signLoanSetByCounterparty', decode(signLoanSetByCounterparty(borrower, firstParty).tx_blob))
} catch (e) {
  console.log(`  xrpl.js signLoanSetByCounterparty threw: ${e.message}`)
}
const ours = check('scripts/lib/lending.mjs signCounterparty', decode(signCounterparty(firstParty, borrower).tx_blob))
console.log(library ? '\nthe library signs with the counterparty prefix: this version is fixed' : '\nthe library signs with the ordinary transaction prefix: the ledger rejects it')
process.exit(ours ? 0 : 1)
