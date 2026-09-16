import type { WalletAdapter, WalletManager, XamanAdapter } from 'xrpl-connect'

/**
 * Which wallets can sign these funds' transactions, a VaultDeposit or VaultWithdraw carrying an MPT
 * amount, from what their shipped signing libraries can encode. Evidence: docs/feedback/FRICTION-LOG.md
 * F-019. `signs` is true where the wallet's code knows both, false where it cannot, null where the
 * wallet behind the connection is unknown. Only Xaman was tested live with this app.
 */
export const VAULT_SIGNING: Record<string, { signs: boolean | null; note: string }> = {
  xaman: {
    signs: true,
    note: 'Xaman signs vault transactions with MPT amounts, tested live with this app on XRPL Devnet. Switch Xaman to Devnet first.',
  },
  otsu: {
    signs: true,
    note: 'Otsu’s signing library knows vault transactions and MPT amounts; not yet tested live with this app. Otsu is installed from source.',
  },
  walletconnect: {
    signs: null,
    note: 'Depends on the wallet behind WalletConnect; none we checked documents XRPL Devnet.',
  },
  crossmark: {
    signs: false,
    note: 'Crossmark 0.2.19 has no encoding for vault transactions or MPT amounts: expect it to refuse to sign.',
  },
  gemwallet: {
    signs: false,
    note: 'GemWallet 3.8.2 signs with xrpl 3.1.0, which cannot encode a vault transaction: expect it to refuse to sign.',
  },
}

type SignedPayloadCheck = (
  this: unknown,
  tx: object,
  blob: string,
  account: string,
  multisign: boolean,
  signer: unknown,
  multisignAccount: unknown,
  network: object,
) => void

/**
 * xrpl-connect 1.0.0-rc.2 refuses every transaction a holder signs alone in Xaman. Its last check on the
 * signed payload wants `response.multisign_account` to be null, and live Xaman payloads do not carry null
 * there: "Xaman returned unexpected multi-signing account data", nothing reaches the ledger. For a single
 * signature this adapter passes null in its place, since the blob itself shows who signed and every other
 * check still runs on it: no Signers, the connected account, the network, a valid signature, the requested
 * fields. A multi-signed payload keeps the original check. tests/xaman-single-sign.spec.ts
 */
export function fixXamanSingleSign(Xaman: typeof XamanAdapter): typeof XamanAdapter {
  const Adapter = class extends Xaman {}
  const proto = Adapter.prototype as unknown as { validateSignedTransaction: SignedPayloadCheck }
  const check = proto.validateSignedTransaction
  proto.validateSignedTransaction = function (tx, blob, account, multisign, signer, multisignAccount, network) {
    check.call(this, tx, blob, account, multisign, signer, multisign ? multisignAccount : null, network)
  }
  return Adapter
}

let managerPromise: Promise<WalletManager> | null = null

/**
 * One WalletManager per tab on XRPL Devnet, created lazily in the browser so a React StrictMode double
 * effect never builds a second one. Xaman needs a browser API key and WalletConnect a project id: each
 * is offered only when its public key is set at build time. The wallets that need nothing are always
 * offered, and the modal lists the ones this browser actually has.
 */
export function getWalletManager(): Promise<WalletManager> {
  if (typeof window === 'undefined')
    return Promise.reject(new Error('The wallet manager runs in the browser only.'))
  managerPromise ??= import('xrpl-connect')
    .then(
    ({ WalletManager, XamanAdapter, WalletConnectAdapter, OtsuAdapter, CrossmarkAdapter, GemWalletAdapter }) => {
      const adapters: WalletAdapter[] = []
      const xaman = process.env.NEXT_PUBLIC_XAMAN_API_KEY
      if (xaman) {
        const Xaman = fixXamanSingleSign(XamanAdapter)
        adapters.push(new Xaman({ apiKey: xaman }))
      }
      adapters.push(new OtsuAdapter())
      const walletConnect = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      if (walletConnect)
        adapters.push(
          new WalletConnectAdapter({
            projectId: walletConnect,
            themeMode: 'dark',
            metadata: {
              name: 'patapim',
              description: 'Securities lending, native on the XRP Ledger',
              url: window.location.origin,
              icons: [`${window.location.origin}/icon.svg`],
            },
          }),
        )
      adapters.push(new CrossmarkAdapter(), new GemWalletAdapter())
      return new WalletManager({ network: 'devnet', adapters, autoConnect: true })
    },
    )
    .catch((e) => {
      // A failed chunk load must not stay cached for the life of the tab.
      managerPromise = null
      throw e
    })
  return managerPromise
}
