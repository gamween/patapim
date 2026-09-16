'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Wallet } from 'xrpl'
import { DEMO_ACCOUNTS_URL, LIBRARY } from '@/lib/config'
import { VAULT_SIGNING } from '@/lib/wallet-manager'
import type { VaultSnapshot } from '@/lib/vault-ui'
import { useWallet } from './wallet'

type Account = {
  address: string
  sequence: number
  lastLedgerSequence: number
  fee: string
  balanceDrops: string
  assetHeld: string | null
  sharesHeld: string | null
}
type Outcome = {
  type: string
  hash: string
  engine: string
  result: string | null
}
type Action = 'VaultDeposit' | 'VaultWithdraw'

/** What each result code means for a lender's own transaction, in the words of the rule that fired. */
const EXPLAIN: Record<string, (type: string) => string> = {
  tesSUCCESS: (t) =>
    t === 'VaultDeposit'
      ? 'Accepted. The fund minted shares to this account.'
      : 'Accepted. The shares were redeemed for the security.',
  tecNO_AUTH: () =>
    'Refused by the ledger: this account holds no credential accepted by the fund’s permissioned domain.',
  tecEXPIRED: () => 'Refused by the ledger: the subscription period is over.',
  tecTOO_SOON: () =>
    'Refused by the ledger: redemptions open only when the term ends.',
  tecINSUFFICIENT_FUNDS: () =>
    'Refused by the ledger: the account does not hold that amount, or the fund lacks the liquidity.',
  tecLIMIT_EXCEEDED: () =>
    'Refused by the ledger: the deposit would take the fund past its maximum size.',
  tecNO_PERMISSION: () =>
    'Refused by the ledger: this account may not perform this operation on this fund.',
  tecOBJECT_NOT_FOUND: () =>
    'Refused by the ledger: the account holds none of this asset or of these shares.',
  terNO_ACCOUNT: () => 'The account does not exist on XRPL Devnet.',
  tefPAST_SEQ: () => 'Superseded by another transaction from this account. Sign again.',
  tefMAX_LEDGER: () => 'Not included before its last ledger. Sign again.',
}
const explain = (code: string, type: string) =>
  EXPLAIN[code]?.(type) ?? 'See the result code on the explorer.'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const units = (value: string | null, scale: number) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: scale }).format(
        Number(value) / 10 ** scale,
      )
const short = (a: string) => `${a.slice(0, 10)}…${a.slice(-4)}`

export default function SignPanel({
  snapshot,
  onSettled,
}: {
  snapshot: VaultSnapshot
  onSettled: (address: string) => void
}) {
  const s = snapshot.signing
  const wallet = useWallet()
  // A demo key lives in this ref and nowhere else: not in state, not in storage, not in a request.
  const key = useRef<Wallet | null>(null)
  const [keyAddress, setKeyAddress] = useState<string | null>(null)
  const [useKey, setUseKey] = useState(false)
  const [account, setAccount] = useState<Account | null>(null)
  const [action, setAction] = useState<Action>(
    s.acceptsDeposits || !s.acceptsWithdrawals ? 'VaultDeposit' : 'VaultWithdraw',
  )
  const [amount, setAmount] = useState('1000')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Every sign run gets an id. Switching signer or mode invalidates a run still waiting on a wallet
  // or a ledger, so its late result never lands on the account now shown.
  const run = useRef(0)

  const walletAddress = wallet?.account?.address ?? null
  const mode: 'wallet' | 'key' | null = useKey
    ? keyAddress
      ? 'key'
      : null
    : walletAddress
      ? 'wallet'
      : null
  const address = mode === 'key' ? keyAddress : mode === 'wallet' ? walletAddress : null
  const capability = wallet?.walletId ? VAULT_SIGNING[wallet.walletId] : undefined
  const blocked = snapshot.rules.blocked.find(([tx]) => tx === action)
  const unit = action === 'VaultDeposit' ? s.assetTicker : 'shares'

  const fetchAccount = useCallback(
    async (addr: string) => {
      const q = new URLSearchParams()
      if (s.assetMptId) q.set('asset', s.assetMptId)
      if (s.shareMptId) q.set('shares', s.shareMptId)
      const res = await fetch(`/api/account/${addr}?${q}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'The account could not be read.')
      return data as Account
    },
    [s.assetMptId, s.shareMptId],
  )

  // Whichever account signs, show what it holds in this fund before it signs. A change of signer
  // also invalidates any run in flight and ignores an older account read that answers late.
  useEffect(() => {
    run.current++
    setBusy(null)
    setAccount(null)
    setError(null)
    if (!address) return
    let live = true
    fetchAccount(address)
      .then((a) => live && setAccount(a))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'The account could not be read.'))
    return () => {
      live = false
    }
  }, [address, mode, fetchAccount])

  async function loadKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('seed') as HTMLInputElement
    setError(null)
    setOutcome(null)
    setBusy('Deriving the address')
    try {
      const { Wallet } = await import('xrpl')
      const w = Wallet.fromSeed(input.value.trim())
      key.current = w
      input.value = ''
      setKeyAddress(w.classicAddress)
      onSettled(w.classicAddress)
    } catch (e) {
      key.current = null
      setKeyAddress(null)
      setError(
        e instanceof Error && /seed|decode|checksum|invalid/i.test(e.message)
          ? 'That is not a valid XRPL seed.'
          : e instanceof Error
            ? e.message
            : 'The key could not be loaded.',
      )
    } finally {
      setBusy(null)
    }
  }

  function forgetKey() {
    key.current = null
    setKeyAddress(null)
    setOutcome(null)
    setError(null)
  }

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!address || !mode) return
    const id = ++run.current
    const live = () => id === run.current
    setError(null)
    setOutcome(null)
    try {
      const whole = Number(amount)
      if (!Number.isFinite(whole) || whole <= 0) throw new Error('Enter a positive amount.')
      const mpt = action === 'VaultDeposit' ? s.assetMptId : s.shareMptId
      if (!mpt) throw new Error('This vault’s asset is not a multi-purpose token.')
      // MPT amounts are integers in the token's smallest unit; shares carry the asset's scale.
      const value = String(Math.round(whole * 10 ** s.assetScale))
      const tx: Record<string, unknown> = {
        TransactionType: action,
        Account: address,
        VaultID: s.vaultId,
        Amount: { mpt_issuance_id: mpt, value },
      }
      let blob: string
      if (mode === 'wallet') {
        // The wallet fills in sequence, fee and last ledger when the holder signs, so a signature
        // taken on a phone does not expire while the QR code is being scanned.
        if (!wallet) throw new Error('No wallet connection.')
        setBusy(`Waiting for ${wallet.walletName ?? 'the wallet'}`)
        blob = (await wallet.sign(tx)).tx_blob
        if (!live()) return
      } else {
        const w = key.current
        if (!w) throw new Error('Load a key first.')
        setBusy('Reading sequence and fee')
        const acct = await fetchAccount(address)
        if (!live()) return
        Object.assign(tx, {
          Fee: acct.fee,
          Sequence: acct.sequence,
          LastLedgerSequence: acct.lastLedgerSequence,
        })
        setBusy('Signing in this browser')
        // Types come from the mandated xrpl.js beta, which knows VaultDeposit and VaultWithdraw.
        blob = w.sign(tx as Parameters<Wallet['sign']>[0]).tx_blob
      }
      setBusy('Submitting the signed transaction')
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_blob: blob }),
      })
      const sent = await res.json()
      if (!live()) return
      if (!res.ok) throw new Error(sent.error || 'The transaction could not be submitted.')
      const hash = String(sent.hash)
      setOutcome({ type: action, hash, engine: sent.engineResult, result: null })
      // tem, tef and tel codes never reach a ledger: the preliminary result is the final one.
      if (/^(tem|tef|tel)/.test(sent.engineResult)) {
        setOutcome({ type: action, hash, engine: sent.engineResult, result: sent.engineResult })
        return
      }
      setBusy('Waiting for a validated ledger')
      for (let i = 0; i < 20; i++) {
        await sleep(2000)
        if (!live()) return
        const r = await fetch(`/api/tx/${hash}`, { cache: 'no-store' })
        if (r.status === 200) {
          const done = await r.json()
          if (!live()) return
          setOutcome({ type: action, hash, engine: sent.engineResult, result: done.result })
          const after = await fetchAccount(address).catch(() => null)
          if (!live()) return
          if (after) setAccount(after)
          onSettled(address)
          return
        }
      }
      throw new Error('No validated result after 40 seconds. Check the hash on the explorer.')
    } catch (e) {
      if (live()) setError(e instanceof Error ? e.message : 'The transaction failed.')
    } finally {
      if (live()) setBusy(null)
    }
  }

  return (
    <div className="sign-panel">
      <div className="sign-intro">
        <p>
          Sign a real transaction against this fund, on XRPL Devnet, from an
          account holding {s.assetTicker}. The ledger decides:
          {snapshot.permissioned
            ? ' only an account with a credential the fund’s domain accepts may subscribe.'
            : ' this fund has no eligibility gate.'}
        </p>
        <p className="live-footnote">
          {mode === 'key'
            ? `This page signs with ${LIBRARY} and the key never leaves the tab.`
            : 'Your wallet signs.'}{' '}
          Only the signed transaction reaches the server, which relays it to
          XRPL Devnet and reads the result from a validated ledger. Wallet
          connection by XRPL Commons’ xrpl-connect. Xaman and Otsu can sign a
          vault transaction with a multi-purpose token amount in their code;
          Crossmark and GemWallet cannot. With no such wallet, a Devnet demo
          key signs in this browser.
        </p>
        <a href={DEMO_ACCOUNTS_URL} target="_blank" rel="noreferrer">
          Demo accounts and what the ledger answers, docs/DEMO-ACCOUNTS.md
        </a>
      </div>

      <div className="sign-form">
        {!useKey ? (
          <>
            <dl className="detail-values">
              <div>
                <dt>Wallet</dt>
                <dd>
                  {wallet?.status === 'unavailable'
                    ? 'Unavailable in this browser'
                    : (wallet?.walletName ?? 'Not connected')}
                </dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>
                  {walletAddress ? (
                    <a
                      href={`${snapshot.explorer}/accounts/${walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {short(walletAddress)}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {walletAddress && (
                <>
                  <div>
                    <dt>{s.assetTicker} held</dt>
                    <dd>{units(account?.assetHeld ?? null, s.assetScale)}</dd>
                  </div>
                  <div>
                    <dt>Fund shares held</dt>
                    <dd>{units(account?.sharesHeld ?? null, s.assetScale)}</dd>
                  </div>
                </>
              )}
            </dl>
            {capability && walletAddress && (
              <p
                className={`live-footnote ${capability.signs === false ? 'amber' : ''}`}
              >
                {capability.note}
              </p>
            )}
            {wallet?.error && !walletAddress && (
              <p className="live-footnote red">{wallet.error}</p>
            )}
            <div className="sign-buttons">
              {!walletAddress ? (
                <button
                  type="button"
                  className="pill"
                  onClick={() => wallet?.open()}
                  disabled={!wallet || wallet.status !== 'ready'}
                >
                  {wallet?.status === 'loading' ? 'Loading wallets…' : 'Connect wallet'}
                </button>
              ) : (
                <button type="button" className="sign-forget" onClick={() => wallet?.disconnect()}>
                  Disconnect
                </button>
              )}
              <button type="button" className="sign-forget" onClick={() => { setUseKey(true); setOutcome(null); setError(null) }}>
                No wallet? Use a Devnet demo key
              </button>
            </div>
          </>
        ) : !keyAddress ? (
          <form onSubmit={loadKey} autoComplete="off">
            <label>
              Devnet demo key (family seed)
              <input
                name="seed"
                type="password"
                required
                spellCheck={false}
                autoComplete="off"
                placeholder="s…"
                aria-describedby="sign-key-note"
              />
            </label>
            <p id="sign-key-note" className="live-footnote">
              The key stays in this tab and signs locally with {LIBRARY}.
              Devnet demo keys only: never paste a key that controls real
              funds.
            </p>
            <div className="sign-buttons">
              <button className="pill" type="submit" disabled={!!busy}>
                {busy ?? 'Load key'}
              </button>
              <button type="button" className="sign-forget" onClick={() => setUseKey(false)}>
                Back to wallet
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="detail-values">
              <div>
                <dt>Signing account, demo key</dt>
                <dd>
                  <a
                    href={`${snapshot.explorer}/accounts/${keyAddress}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {short(keyAddress)}
                  </a>
                </dd>
              </div>
              <div>
                <dt>{s.assetTicker} held</dt>
                <dd>{units(account?.assetHeld ?? null, s.assetScale)}</dd>
              </div>
              <div>
                <dt>Fund shares held</dt>
                <dd>{units(account?.sharesHeld ?? null, s.assetScale)}</dd>
              </div>
            </dl>
            <div className="sign-buttons">
              <button type="button" className="sign-forget" onClick={forgetKey}>
                Forget key
              </button>
              <button type="button" className="sign-forget" onClick={() => { forgetKey(); setUseKey(false) }}>
                Back to wallet
              </button>
            </div>
          </>
        )}

        {mode && (
          <form onSubmit={sign}>
            <fieldset className="sign-actions">
              <legend>Transaction</legend>
              {(['VaultDeposit', 'VaultWithdraw'] as const).map((t) => (
                <label key={t}>
                  <input
                    type="radio"
                    name="action"
                    value={t}
                    checked={action === t}
                    onChange={() => setAction(t)}
                  />
                  <span>
                    {t === 'VaultDeposit' ? 'Subscribe' : 'Redeem'} <code>{t}</code>
                  </span>
                </label>
              ))}
            </fieldset>
            <label>
              Amount, in {unit}
              <input
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <p className="live-footnote" aria-live="polite">
              {blocked
                ? `In the ${snapshot.phase} phase the ledger refuses ${action} with ${blocked[1]}. Sign it to see the refusal on chain.`
                : action === 'VaultDeposit' && snapshot.permissioned
                  ? 'This fund is private: the ledger accepts the deposit only from an account holding a credential its domain accepts.'
                  : `${action} is open in the ${snapshot.phase} phase.`}
            </p>
            <div className="sign-buttons">
              <button className="pill" type="submit" disabled={!!busy}>
                {busy ??
                  (mode === 'wallet'
                    ? `Sign ${action} in ${wallet?.walletName ?? 'the wallet'}`
                    : `Sign ${action}`)}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <p className="sign-result red" role="alert">
          {error}
        </p>
      )}
      {outcome && (
        <div className="sign-result" role="status" aria-live="polite">
          <span
            className={`live-status code ${outcome.result === 'tesSUCCESS' ? 'green' : outcome.result ? 'red' : 'amber'}`}
          >
            {outcome.result ?? `${outcome.engine}, awaiting validation`}
          </span>
          <p>
            {outcome.result
              ? explain(outcome.result, outcome.type)
              : 'Submitted. Waiting for the result in a validated ledger.'}
          </p>
          <a
            href={`${snapshot.explorer}/transactions/${outcome.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {outcome.type} {outcome.hash.slice(0, 8)}… on the explorer
          </a>
        </div>
      )}
    </div>
  )
}
