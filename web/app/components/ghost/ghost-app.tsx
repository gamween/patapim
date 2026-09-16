'use client'

import './ghost.css'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { DEMO_VAULT, FUNDS } from '@/lib/config'
import type { LedgerCard, VaultSnapshot } from '@/lib/vault-ui'
import type { Experience, Phase } from './animation/Experience'
import { useVault } from './use-vault'
import SignPanel from './sign-panel'
import { WalletButton, WalletHolder, WalletProvider } from './wallet'

function Icon({ name }: { name: 'arrow' | 'close' }) {
  const paths = {
    arrow: 'M5 19 19 5M5 5h14v14',
    close: 'm5 5 14 14M5 19 19 5',
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`
const tone = (status: string) =>
  status === 'defaulted'
    ? 'red'
    : ['past due', 'past grace', 'impaired'].includes(status)
      ? 'amber'
      : 'green'
const timestamp = (date: string | null) =>
  date ? date.replace('T', ' ').replace('.000Z', ' UTC') : '—'

function Rules({ snapshot }: { snapshot: VaultSnapshot }) {
  return (
    <div className="live-rules">
      <div>
        <h3>Allowed in {snapshot.phase}</h3>
        {snapshot.rules.allowed.map((tx) => (
          <div className="rule-line" key={tx}>
            <span>{tx}</span>
            <span className="live-status green">ALLOWED</span>
          </div>
        ))}
      </div>
      <div>
        <h3>Refused in {snapshot.phase}</h3>
        {snapshot.rules.blocked.map(([tx, code]) => (
          <div className="rule-line" key={tx}>
            <span>{tx}</span>
            <span className="live-status red code">{code}</span>
          </div>
        ))}
        {!snapshot.rules.blocked.length && (
          <p>No phase restrictions for this vault.</p>
        )}
      </div>
      <p className="live-footnote">
        Phase permissions at ledger close time. Eligibility, available cover and
        other transaction checks still apply.
      </p>
    </div>
  )
}
function Loans({
  snapshot,
  query = '',
}: {
  snapshot: VaultSnapshot
  query?: string
}) {
  const loans = snapshot.loans.filter((loan) =>
    `${loan.borrower} ${loan.status} ${loan.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <div className="live-loans">
      {loans.length ? (
        loans.map((loan) => (
          <article className="loan-row" key={loan.id}>
            <div>
              <span className="mono muted">BORROWER</span>
              <a
                href={`${snapshot.explorer}/accounts/${loan.borrower}`}
                target="_blank"
                rel="noreferrer"
              >
                {short(loan.borrower)}
              </a>
              <span className={`live-status ${tone(loan.status)}`}>
                {loan.status}
              </span>
            </div>
            <dl>
              <div>
                <dt>Principal outstanding</dt>
                <dd>{loan.principal}</dd>
              </div>
              <div>
                <dt>Lending fee</dt>
                <dd>{loan.feeBps}</dd>
              </div>
              <div>
                <dt>Total owed at return</dt>
                <dd>{loan.owed}</dd>
              </div>
              <div>
                <dt>Interest to lenders</dt>
                <dd>{loan.interestToLenders}</dd>
              </div>
              <div>
                <dt>Returns (UTC)</dt>
                <dd>{timestamp(loan.due === '—' ? null : loan.due)}</dd>
              </div>
              <div>
                <dt>Grace period</dt>
                <dd>{loan.grace}</dd>
              </div>
              <div>
                <dt>Collateral</dt>
                <dd>{loan.collateral}</dd>
              </div>
              <div>
                <dt>Collateral margin</dt>
                <dd>{loan.margin}</dd>
              </div>
            </dl>
          </article>
        ))
      ) : (
        <p className="live-empty">
          {query
            ? 'No loans match this search.'
            : 'No loans returned in this ledger snapshot.'}
        </p>
      )}
    </div>
  )
}
function Details({
  card,
  snapshot,
}: {
  card: LedgerCard
  snapshot: VaultSnapshot
}) {
  return (
    <>
      <div className="detail-hero">
        <span className="mono muted">{card.category}</span>
        <h2>{card.title}</h2>
        <strong>{card.value}</strong>
        <p>{card.subtitle}</p>
      </div>
      {card.id === 'loans' ? (
        <Loans snapshot={snapshot} />
      ) : card.id === 'rules' ? (
        <Rules snapshot={snapshot} />
      ) : (
        <dl className="detail-values">
          {card.lines.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.id === 'phase' && (
        <div className="phase-track">
          {['subscription', 'investment', 'redemption'].map((phase, i) => (
            <div
              key={phase}
              aria-current={snapshot.phase === phase ? 'step' : undefined}
            >
              <span className="mono">0{i + 1}</span>
              {phase}
            </div>
          ))}
        </div>
      )}
      {card.note && <p className="live-footnote">{card.note}</p>}
      {card.id === 'provenance' && (
        <div className="rpc-details">
          {snapshot.calls.map((call, i) => (
            <details key={i}>
              <summary>
                {i + 1}. {call.why}
              </summary>
              <pre>{JSON.stringify(call.request, null, 2)}</pre>
            </details>
          ))}
          <a
            href={`${snapshot.explorer}/accounts/${snapshot.owner}`}
            target="_blank"
            rel="noreferrer"
          >
            Inspect vault owner on the explorer
          </a>
        </div>
      )}
      {card.id === 'position' && snapshot.position && (
        <p className="live-footnote">
          Holder {snapshot.position.holder}. Position value is the holder’s
          fraction of outstanding shares multiplied by net assets.
        </p>
      )}
    </>
  )
}

export default function GhostApp({
  vaultId = DEMO_VAULT,
  holder,
  landing = false,
}: {
  vaultId?: string
  holder?: string
  landing?: boolean
}) {
  const router = useRouter()
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Experience | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [section, setSection] = useState<'vault' | 'loans' | 'rules' | 'sign'>('vault')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const [query, setQuery] = useState('')
  const [switching, setSwitching] = useState(false)
  // An account whose key was loaded in the Sign tab: its position is read without leaving the page.
  const [signer, setSigner] = useState<string | undefined>(undefined)
  const dialog = useRef<HTMLDialogElement>(null)
  const switchDialog = useRef<HTMLDialogElement>(null)
  const { snapshot, pending, error, refresh } = useVault(vaultId, holder ?? signer)
  const snapshotRef = useRef(snapshot)
  const revealed = phase === 'revealed' || phase === 'ready'
  const selected = snapshot?.cards.find((card) => card.id === selectedId)
  const gridVisible = landing && !fallback
  const appHref = `/vault/${vaultId}${holder ? `?holder=${encodeURIComponent(holder)}` : ''}`
  const cards =
    snapshot?.cards.filter((card) =>
      `${card.title} ${card.category} ${card.subtitle}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? []

  useEffect(() => {
    snapshotRef.current = snapshot
    scene.current?.setCards(snapshot?.cards ?? [])
  }, [snapshot])
  useEffect(() => {
    if (!landing) {
      setPhase('ready')
      return
    }
    if (!canvas.current || fallback) return
    let cancelled = false
    setPhase('loading')
    setProgress(0)
    const fail = (e: unknown) => {
      if (cancelled) return
      console.warn('Showing the landing without WebGL:', e)
      setFallback(true)
      setPhase('ready')
    }
    import('./animation/Experience')
      .then(({ Experience }) => {
        if (cancelled || !canvas.current) return
        try {
          scene.current = new Experience(canvas.current, {
            progress: (n) => setProgress((old) => Math.max(old, n)),
            phase: setPhase,
            select: (card) => {
              if (card.id !== 'loading') router.push(appHref)
            },
            error: fail,
          })
          scene.current.setCards(snapshotRef.current?.cards ?? [])
        } catch (e) {
          fail(e)
        }
      })
      .catch(fail)
    return () => {
      cancelled = true
      scene.current?.dispose()
      scene.current = null
    }
  }, [landing, fallback, router, appHref])
  useEffect(() => {
    scene.current?.setActive(
      !revealed || (gridVisible && !selectedId && !switching),
    )
  }, [revealed, gridVisible, selectedId, switching])
  useEffect(() => {
    if (selectedId && selected) dialog.current?.showModal()
    else dialog.current?.close()
  }, [selectedId, selected])
  useEffect(() => {
    if (switching) switchDialog.current?.showModal()
    else switchDialog.current?.close()
  }, [switching])
  function openSection(next: typeof section) {
    setSection(next)
    setQuery('')
  }
  function openVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const id = String(data.get('vault')).trim()
    const account = String(data.get('holder')).trim()
    setSwitching(false)
    router.push(
      `/vault/${encodeURIComponent(id)}${account ? `?holder=${encodeURIComponent(account)}` : ''}`,
    )
  }

  return (
    <WalletProvider enabled={!landing}>
    <WalletHolder onAccount={setSigner} />
    <main
      className={`ghost-root app live-app ${revealed ? 'is-revealed' : ''} ${landing ? 'landing-page' : 'vault-page'}`}
      data-phase={phase}
      data-ledger-state={error ? 'error' : snapshot ? 'ready' : 'loading'}
    >
      <a className="skip-link" href={landing ? appHref : '#ledger-content'}>
        {landing ? 'Skip to app' : 'Skip to vault data'}
      </a>
      {landing && (
        <canvas
          ref={canvas}
          className={`experience ${revealed && !gridVisible ? 'is-hidden' : ''}`}
          aria-label="Live vault preview. Drag to explore, or use Open app for accessible vault details."
          tabIndex={revealed && gridVisible ? 0 : -1}
        />
      )}
      {(phase === 'loading' || phase === 'separating') && (
        <div
          className={`loader ${phase === 'separating' ? 'depart' : ''}`}
          role="status"
          aria-label={`Loading ${Math.round(progress)} percent`}
        >
          <div className="loader-type">
            <h1>
              <span>PATAPIM</span>
            </h1>
            <p>
              <span>ASSETS IN MOTION</span>
            </p>
          </div>
          <div className="progress-track">
            <div style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
        </div>
      )}
      {!revealed && (
        <button
          className="skip-intro mono"
          onClick={() => {
            scene.current?.skip()
            setPhase('ready')
          }}
        >
          SKIP INTRO <Icon name="arrow" />
        </button>
      )}
      <header
        className="header chrome"
        inert={!revealed}
        aria-hidden={!revealed}
      >
        <a className="brand" href="/" aria-label="Patapim home">
          <img src="/reference/site/ghost.svg" alt="" width="45" height="74" />
          <span>patapim</span>
        </a>
        {landing ? (
          <>
            <p className="landing-statement mono">
              SECURITIES LENDING.
              <br />
              NATIVE ON THE XRP LEDGER.
            </p>
            <a className="open-app" href={appHref}>
              Open app <Icon name="arrow" />
            </a>
          </>
        ) : (
          <>
            <button
              className="vault-selector mono"
              onClick={() => setSwitching(true)}
              aria-label="Choose vault and holder"
            >
              {snapshot?.network ?? 'XRPL DEVNET'}
              <br />
              VAULT {short(vaultId)}
              <br />
              <span className="muted">CHANGE VAULT / HOLDER</span>
            </button>
            <div className="clock mono">
              <span>
                <i />
                {error
                  ? 'STALE SNAPSHOT'
                  : pending
                    ? 'READING LEDGER'
                    : 'VALIDATED LEDGER'}
              </span>
              <time>{snapshot?.ledgerTime.slice(11, 19) ?? '—'}</time>
              <span className="muted">
                {snapshot?.phase.toUpperCase() ?? 'CONNECTING'}
              </span>
              <span className="muted">UTC</span>
            </div>
            <button
              className="explore pill"
              onClick={refresh}
              disabled={pending}
            >
              {pending ? 'Refreshing…' : 'Refresh ledger'}
              <Icon name="arrow" />
            </button>
            <WalletButton />
          </>
        )}
      </header>
      {revealed && error && (
        <div className="ledger-alert" role="alert">
          <strong>
            {snapshot
              ? 'Refresh failed. Showing the last successful ledger snapshot.'
              : 'Vault data unavailable.'}
          </strong>
          <span>{error}</span>
          <button onClick={refresh}>Retry ledger</button>
          {!landing && (
            <button onClick={() => setSwitching(true)}>Choose vault</button>
          )}
        </div>
      )}
      {revealed && !snapshot && !error && (
        <div className="ledger-loading" role="status">
          Reading the live vault…
        </div>
      )}
      {revealed && landing && (
        <section
          className="landing-copy"
          aria-label="Securities lending on the XRP Ledger"
        >
          <h1>
            Good assets.
            <br />
            Put to work.
          </h1>
          <p>
            Lend securities through a fixed-term vault.
            <br />
            The lending agent puts its own capital on the line.
          </p>
        </section>
      )}

      {revealed && !landing && (
        <section
          id="ledger-content"
          className="archive live-archive"
          aria-label="Live vault data"
        >
          <nav className="app-navigation" aria-label="Vault navigation">
            {(['vault', 'loans', 'rules', 'sign'] as const).map((next) => (
              <button
                key={next}
                aria-current={section === next ? 'page' : undefined}
                onClick={() => openSection(next)}
              >
                {next.charAt(0).toUpperCase() + next.slice(1)}
              </button>
            ))}
          </nav>
          <div className="archive-heading">
            <div>
              <span className="eyebrow mono">
                {snapshot?.network ?? 'XRPL DEVNET'} / {short(vaultId)}
              </span>
              <h1>
                {section === 'loans'
                  ? 'Loan book'
                  : section === 'rules'
                    ? 'Ledger rules'
                    : section === 'sign'
                      ? 'Sign'
                      : (snapshot?.name ?? 'Fund')}
                <span>
                  {section === 'loans'
                    ? (snapshot?.loans.length ?? '—')
                    : (snapshot?.phase ?? 'connecting')}
                </span>
              </h1>
            </div>
            {(section === 'vault' || section === 'loans') && (
              <label className="search mono">
                <span>
                  SEARCH{' '}
                  {section === 'loans'
                    ? 'BORROWERS OR STATUS'
                    : 'VAULT METRICS'}
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    section === 'loans'
                      ? 'Borrower, loan, status…'
                      : 'Capital, phase, cover…'
                  }
                />
              </label>
            )}
          </div>
          {snapshot &&
            (section === 'loans' ? (
              <Loans snapshot={snapshot} query={query} />
            ) : section === 'sign' ? (
              <SignPanel
                snapshot={snapshot}
                onSettled={(address) => {
                  setSigner(address)
                  refresh()
                }}
              />
            ) : section === 'rules' ? (
              <Rules snapshot={snapshot} />
            ) : (
              <div className="ledger-list">
                {cards.map((card, i) => (
                  <button
                    className="ledger-row"
                    key={card.id}
                    onClick={() => setSelectedId(card.id)}
                  >
                    <span className="row-number mono">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="row-title">
                      {card.title}
                      <small>{card.subtitle}</small>
                    </span>
                    <strong className="ledger-value">{card.value}</strong>
                    <Icon name="arrow" />
                  </button>
                ))}
                {!cards.length && (
                  <p className="live-empty">No metrics match this search.</p>
                )}
              </div>
            ))}
        </section>
      )}
      <dialog
        ref={dialog}
        className="project-dialog ledger-dialog"
        onCancel={() => setSelectedId(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedId(null)
        }}
      >
        {selected && snapshot && (
          <article>
            <div className="dialog-bar mono">
              <span>LIVE VAULT / {short(snapshot.id)}</span>
              <button
                className="close-button"
                autoFocus
                onClick={() => setSelectedId(null)}
                aria-label="Close details"
              >
                <Icon name="close" />
              </button>
            </div>
            {error && (
              <p className="live-footnote">
                Last successful snapshot — refresh currently unavailable.
              </p>
            )}
            <Details card={selected} snapshot={snapshot} />
            <p className="live-footnote">
              Ledger close {timestamp(snapshot.ledgerTime)} · Updates every 10
              seconds while visible.
            </p>
          </article>
        )}
      </dialog>
      <dialog
        ref={switchDialog}
        className="project-dialog vault-dialog"
        onCancel={() => setSwitching(false)}
      >
        <form onSubmit={openVault}>
          <div className="dialog-bar mono">
            <span>OPEN A VAULT / XRPL DEVNET</span>
            <button
              type="button"
              className="close-button"
              onClick={() => setSwitching(false)}
              aria-label="Close vault selector"
            >
              <Icon name="close" />
            </button>
          </div>
          <h2>
            Your vault.
            <br />
            Your ledger data.
          </h2>
          <div className="fund-shortcuts" role="group" aria-label="Funds run by the demo lending agent">
            {FUNDS.map((fund) => (
              <button
                key={fund.id}
                type="button"
                className="pill"
                aria-current={fund.id === vaultId.toUpperCase() ? 'true' : undefined}
                onClick={() => {
                  setSwitching(false)
                  router.push(`/vault/${fund.id}`)
                }}
              >
                {fund.label} · {fund.detail} <Icon name="arrow" />
              </button>
            ))}
          </div>
          <label>
            Vault ID
            <input
              name="vault"
              required
              pattern="[A-Fa-f0-9]{64}"
              defaultValue={vaultId}
              spellCheck={false}
            />
          </label>
          <label>
            Holder address <span className="muted">(optional)</span>
            <input
              name="holder"
              defaultValue={holder ?? ''}
              pattern="r[1-9A-HJ-NP-Za-km-z]{24,34}"
              placeholder="r…"
              spellCheck={false}
            />
          </label>
          <button className="pill" type="submit">
            Read vault <Icon name="arrow" />
          </button>
        </form>
      </dialog>
    </main>
    </WalletProvider>
  )
}
