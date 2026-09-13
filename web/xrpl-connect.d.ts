import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from 'react'
import type {
  WalletConnectorCssVars,
  WalletConnectorElementInstance,
} from 'xrpl-connect'

// JSX typing for xrpl-connect's <xrpl-wallet-connector>. The element reads three attributes only:
// primary-wallet, wallets and show-unavailable (xrpl-connect@1.0.0-rc.2, xrpl-connect.mjs:5510-5516).
type XrplWalletConnectorProps = DetailedHTMLProps<
  HTMLAttributes<WalletConnectorElementInstance>,
  WalletConnectorElementInstance
> & {
  'primary-wallet'?: string
  wallets?: string
  'show-unavailable'?: boolean | ''
  style?: CSSProperties & WalletConnectorCssVars
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'xrpl-wallet-connector': XrplWalletConnectorProps
    }
  }
}
