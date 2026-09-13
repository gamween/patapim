'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Wallet } from 'xrpl'
import { DEMO_ACCOUNTS_URL } from '@/lib/config'
import type { VaultSnapshot } from '@/lib/vault-ui'

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

export default function SignPanel({
  snapshot,
  onSettled,
}: {
  snapshot: VaultSnapshot
  onSettled: (address: string) => void
}) {
  const s = snapshot.signing
  // The key lives in this ref and nowhere else: not in state, not in storage, not in a request.
  const wallet = useRef<Wallet | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [action, setAction] = useState<'VaultDeposit' | 'VaultWithdraw'>(
    s.acceptsDeposits || !s.acceptsWithdrawals ? 'VaultDeposit' : 'VaultWithdraw',
  )
  const [amount, setAmount] = useState('1000')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const blocked = snapshot.rules.blocked.find(([tx]) => tx === action)
  const unit = action === 'VaultDeposit' ? s.assetTicker : 'shares'

  async function readAccount(addr: string) {
    const q = new URLSearchParams()
    if (s.assetMptId) q.set('asset', s.assetMptId)
    if (s.shareMptId) q.set('shares', s.shareMptId)
    const res = await fetch(`/api/account/${addr}?${q}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'The account could not be read.')
    setAccount(data)
    return data as Account
  }

  async function loadKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('seed') as HTMLInputElement
    setError(null)
    setOutcome(null)
    setBusy('Deriving the address')
    try {
      const { Wallet } = await import('xrpl')
      const w = Wallet.fromSeed(input.value.trim())
      wallet.current = w
      input.value = ''
      setAddress(w.classicAddress)
      setBusy('Reading the account')
      await readAccount(w.classicAddress)
      onSettled(w.classicAddress)
    } catch (e) {
      wallet.current = null
      setAddress(null)
      setAccount(null)
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

  function forget() {
    wallet.current = null
    setAddress(null)
    setAccount(null)
    setOutcome(null)
    setError(null)
  }

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const w = wallet.current
    if (!w) return
    setError(null)
    setOutcome(null)
    try {
      const whole = Number(amount)
      if (!Number.isFinite(whole) || whole <= 0) throw new Error('Enter a positive amount.')
      const mpt = action === 'VaultDeposit' ? s.assetMptId : s.shareMptId
      if (!mpt) throw new Error('This vault’s asset is not a multi-purpose token.')
      // MPT amounts are integers in the token's smallest unit; shares carry the asset's scale.
      const value = String(Math.round(whole * 10 ** s.assetScale))
      setBusy('Reading sequence and fee')
      const acct = await readAccount(w.classicAddress)
      const tx = {
        TransactionType: action,
        Account: w.classicAddress,
        VaultID: s.vaultId,
        Amount: { mpt_issuance_id: mpt, value },
        Fee: acct.fee,
        Sequence: acct.sequence,
        LastLedgerSequence: acct.lastLedgerSequence,
      }
      setBusy('Signing in this browser')
      // Types come from the mandated xrpl.js beta, which knows VaultDeposit and VaultWithdraw.
      const signed = w.sign(tx as Parameters<Wallet['sign']>[0])
      setBusy('Submitting the signed transaction')
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_blob: signed.tx_blob }),
      })
      const sent = await res.json()
      if (!res.ok) throw new Error(sent.error || 'The transaction could not be submitted.')
      const hash = sent.hash || signed.hash
      setOutcome({ type: action, hash, engine: sent.engineResult, result: null })
      // tem, tef and tel codes never reach a ledger: the preliminary result is the final one.
      if (/^(tem|tef|tel)/.test(sent.engineResult)) {
        setOutcome({ type: action, hash, engine: sent.engineResult, result: sent.engineResult })
        return
      }
      setBusy('Waiting for a validated ledger')
      for (let i = 0; i < 20; i++) {
        await sleep(2000)
        const r = await fetch(`/api/tx/${hash}`, { cache: 'no-store' })
        if (r.status === 200) {
          const tx = await r.json()
          setOutcome({ type: action, hash, engine: sent.engineResult, result: tx.result })
          await readAccount(w.classicAddress).catch(() => null)
          onSettled(w.classicAddress)
          return
        }
      }
      throw new Error('No validated result after 40 seconds. Check the hash on the explorer.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The transaction failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sign-panel">
      <div className="sign-intro">
        <p>
          Sign a real transaction against this fund, from this browser. Load
          one of the two published demo keys: the one with a credential is
          accepted, the one without is refused by the ledger.
        </p>
        <p className="live-footnote">
          The key stays in this tab. The page signs locally with{' '}
          <code>xrpl.js@5.2.0-beta.0</code> and sends only the signed
          transaction, which the server relays to XRPL Devnet. Devnet demo
          keys only: never paste a key that controls real funds. Browser
          wallets are not offered: the published Crossmark and GemWallet
          extensions contain no encoding for vault transactions or
          multi-purpose token amounts, so neither can sign this.
        </p>
        <a href={DEMO_ACCOUNTS_URL} target="_blank" rel="noreferrer">
          The two demo keys, docs/DEMO-ACCOUNTS.md
        </a>
      </div>

      {!address ? (
        <form className="sign-form" onSubmit={loadKey} autoComplete="off">
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
            Held in memory until you forget it or leave the page.
          </p>
          <button className="pill" type="submit" disabled={!!busy}>
            {busy ?? 'Load key'}
          </button>
        </form>
      ) : (
        <form className="sign-form" onSubmit={sign}>
          <dl className="detail-values">
            <div>
              <dt>Signing account</dt>
              <dd>
                <a
                  href={`${snapshot.explorer}/accounts/${address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {address.slice(0, 10)}…{address.slice(-4)}
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
                  {t === 'VaultDeposit' ? 'Subscribe' : 'Redeem'}{' '}
                  <code>{t}</code>
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
              {busy ?? `Sign ${action}`}
            </button>
            <button type="button" className="sign-forget" onClick={forget}>
              Forget key
            </button>
          </div>
        </form>
      )}

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
