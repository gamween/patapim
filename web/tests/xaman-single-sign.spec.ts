import { test, expect } from '@playwright/test'
import { Wallet, decode, encode } from 'xrpl'
import { XamanAdapter } from 'xrpl-connect'
import { fixXamanSingleSign } from '../lib/wallet-manager'

// xrpl-connect runs these checks on the payload Xaman returns once the holder has signed, with these
// arguments (xrpl-connect.mjs:8836): the decoded blob, the blob, the connected account, multi-signed or
// not, response.account, response.multisign_account, the network. Here the blob is a VaultDeposit signed
// by a throwaway key, as Xaman signs it for a holder of Fund II.
const holder = Wallet.generate()
const request = {
  TransactionType: 'VaultDeposit',
  Account: holder.address,
  VaultID: 'B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530',
  Amount: { mpt_issuance_id: '00504E4C3295762322513439250B2F050A1B016CE5563126', value: '10' },
}
const signed = holder.sign({ ...request, Fee: '12', Sequence: 1, LastLedgerSequence: 100 } as Parameters<Wallet['sign']>[0]).tx_blob

type SignedChecks = {
  resolveXamanNetwork(network: object): object
  validateSignedTransaction(tx: object, blob: string, account: string, multisign: boolean, signer: string, multisignAccount: unknown, network: object): void
}

function checkSigned(Adapter: typeof XamanAdapter, multisignAccount: unknown, blob = signed) {
  const adapter = new Adapter({ apiKey: '00000000-0000-0000-0000-000000000000' }) as unknown as SignedChecks
  const devnet = adapter.resolveXamanNetwork({ id: 'devnet', name: 'Devnet', wss: 'wss://s.devnet.rippletest.net:51233', walletConnectId: 'xrpl:2' })
  adapter.validateSignedTransaction(decode(blob), blob, holder.address, false, holder.address, multisignAccount, devnet)
}

test('xrpl-connect alone refuses a single signature unless multisign_account is null', () => {
  expect(() => checkSigned(XamanAdapter, null)).not.toThrow()
  expect(() => checkSigned(XamanAdapter, '')).toThrow('unexpected multi-signing account data')
})

test('the app’s Xaman adapter accepts a single signature whatever multisign_account holds', () => {
  const Adapter = fixXamanSingleSign(XamanAdapter)
  for (const value of [null, '', undefined, holder.address])
    expect(() => checkSigned(Adapter, value)).not.toThrow()
})

test('the app’s Xaman adapter still refuses a blob whose signature does not match', () => {
  const tampered = encode({ ...decode(signed), Amount: { ...request.Amount, value: '11' } } as Parameters<typeof encode>[0])
  expect(() => checkSigned(fixXamanSingleSign(XamanAdapter), '', tampered)).toThrow('invalid transaction signature')
})
