'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type {
  AccountInfo,
  WalletConnectorElementInstance,
  WalletManager,
} from 'xrpl-connect'
import { getWalletManager } from '@/lib/wallet-manager'

/**
 * Wallet connection through XRPL Commons' xrpl-connect: a WalletManager on XRPL Devnet and its
 * <xrpl-wallet-connector>, themed to the app. The wallet signs and returns the blob; the page submits
 * it through /api/submit and reads the validated result, the same path as the demo-key signer.
 */
export type WalletSigned = { tx_blob: string }
type Status = 'loading' | 'ready' | 'unavailable'
type WalletApi = {
  status: Status
  account: AccountInfo | null
  walletId: string | null
  walletName: string | null
  error: string | null
  open: () => void
  disconnect: () => void
  sign: (tx: Record<string, unknown>) => Promise<WalletSigned>
  register: (el: WalletConnectorElementInstance | null) => void
}

const WalletContext = createContext<WalletApi | null>(null)
export const useWallet = () => useContext(WalletContext)

export function WalletProvider({
  children,
  enabled = true,
}: {
  children: ReactNode
  /** The landing page has no wallet control: it never loads the wallet bundle. */
  enabled?: boolean
}) {
  const manager = useRef<WalletManager | null>(null)
  const connector = useRef<WalletConnectorElementInstance | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletName, setWalletName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let unsubscribe = () => {}
    getWalletManager()
      .then((m) => {
        if (cancelled) return
        const sync = () => {
          setAccount(m.account)
          setWalletId(m.wallet?.id ?? null)
          setWalletName(m.wallet?.name ?? null)
        }
        const onConnect = () => {
          sync()
          setError(null)
        }
        m.on('connect', onConnect)
        m.on('accountChanged', sync)
        m.on('networkChanged', sync)
        m.on('disconnect', sync)
        unsubscribe = () => {
          m.off('connect', onConnect)
          m.off('accountChanged', sync)
          m.off('networkChanged', sync)
          m.off('disconnect', sync)
        }
        manager.current = m
        connector.current?.setWalletManager(m)
        // autoConnect may have restored a session before these listeners existed.
        sync()
        setStatus('ready')
      })
      .catch((e) => {
        if (cancelled) return
        console.warn('Wallet connection unavailable:', e)
        setStatus('unavailable')
      })
    // Never disconnect here: WalletManager.disconnect() clears the stored session.
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [enabled])

  // The element reports connection failures as an `error` event rather than a rejected promise.
  const onError = useRef((e: Event) => {
    const detail = (e as CustomEvent).detail
    setError(
      detail?.error instanceof Error ? detail.error.message : 'The wallet could not connect.',
    )
  })
  const register = useCallback((el: WalletConnectorElementInstance | null) => {
    if (connector.current === el) return
    connector.current?.removeEventListener('error', onError.current)
    connector.current = el
    if (!el) return
    el.addEventListener('error', onError.current)
    if (manager.current) el.setWalletManager(manager.current)
  }, [])

  const open = useCallback(() => {
    void connector.current?.open()
  }, [])
  const disconnect = useCallback(() => {
    void manager.current?.disconnect()
  }, [])
  const sign = useCallback(async (tx: Record<string, unknown>) => {
    const m = manager.current
    if (!m?.connected) throw new Error('Connect a wallet first.')
    // A wallet can switch network after connecting, and xrpl-connect restores that network on reload.
    const net = m.account?.network
    if (net?.id !== 'devnet' && net?.walletConnectId !== 'xrpl:2')
      throw new Error(
        `${m.wallet?.name ?? 'The wallet'} is on ${net?.name ?? 'another network'}. Switch it to XRPL Devnet and reconnect.`,
      )
    const signed = await m.sign(tx as Parameters<WalletManager['sign']>[0])
    let blob = signed.tx_blob
    // The WalletConnect adapter returns the signed tx_json and no blob (xrpl-connect.mjs:31467-31473):
    // encode it again with the codec the app ships, which knows vault transactions.
    const json = signed.tx_json as Record<string, unknown> | undefined
    if (!blob && json?.TxnSignature) {
      const { encode } = await import('ripple-binary-codec')
      const { hash: _hash, ...fields } = json
      blob = encode(fields)
    }
    if (!blob) throw new Error(`${m.wallet?.name ?? 'The wallet'} returned no signed transaction.`)
    return { tx_blob: blob }
  }, [])

  const value = useMemo(
    () => ({ status, account, walletId, walletName, error, open, disconnect, sign, register }),
    [status, account, walletId, walletName, error, open, disconnect, sign, register],
  )
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

/** The header control: xrpl-connect's own connect button and account modal, themed in ghost.css. */
export function WalletButton() {
  const wallet = useWallet()
  if (!wallet || wallet.status === 'unavailable') return null
  return (
    <xrpl-wallet-connector
      ref={wallet.register}
      className="wallet-connector"
      aria-label="Connect an XRPL wallet"
      primary-wallet="xaman"
      // Wallets able to sign a vault transaction first. Installed wallets only: the modal does not
      // invite a visitor to install Crossmark or GemWallet, which cannot sign these funds' transactions.
      wallets="xaman,otsu,walletconnect,crossmark,gemwallet"
    />
  )
}

/** Hands the connected account to the page, which reads its position in the fund. */
export function WalletHolder({ onAccount }: { onAccount: (address: string | undefined) => void }) {
  const wallet = useWallet()
  const address = wallet?.account?.address
  useEffect(() => {
    onAccount(address)
  }, [address, onAccount])
  return null
}
