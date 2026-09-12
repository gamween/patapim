'use client'

import './ghost.css'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { DEMO_VAULT, REPO } from '@/lib/config'
import type { LedgerCard, VaultSnapshot } from '@/lib/vault-ui'
import type { Experience, Phase } from './animation/Experience'
import { useVault } from './use-vault'

function Icon({
  name,
}: {
  name: 'grid' | 'list' | 'arrow' | 'replay' | 'close' | 'pause' | 'play'
}) {
  const paths = {
    grid: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z',
    list: 'M4 5h16M4 12h16M4 19h16',
    arrow: 'M5 19 19 5M5 5h14v14',
    replay: 'M3 10a9 9 0 1 1 2 8M3 3v7h7',
    close: 'm5 5 14 14M5 19 19 5',
    pause: 'M8 4v16M16 4v16',
    play: 'm7 3 14 9-14 9z',
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
    : ['overdue', 'impaired'].includes(status)
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
            <span className="live-status red">{code}</span>
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
                <dt>Total owed</dt>
                <dd>{loan.owed}</dd>
              </div>
              <div>
                <dt>Payments left</dt>
                <dd>{loan.payments}</dd>
              </div>
              <div>
                <dt>Next payment (UTC)</dt>
                <dd>{timestamp(loan.due === '—' ? null : loan.due)}</dd>
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
        <>
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
          <dl className="detail-values">
            <div>
              <dt>Subscription closes</dt>
              <dd>{timestamp(snapshot.subscription)}</dd>
            </div>
            <div>
              <dt>Redemption opens</dt>
              <dd>{timestamp(snapshot.redemption)}</dd>
            </div>
            <div>
              <dt>Ledger close time</dt>
              <dd>{timestamp(snapshot.ledgerTime)}</dd>
            </div>
          </dl>
        </>
      )}
      {card.id === 'price' && (
        <p className="live-footnote">
          Net share price = (AssetsTotal − LossUnrealized) / OutstandingAmount.
          Missing share data is shown as unavailable.
        </p>
      )}
      {card.id === 'cover' && (
        <p className="live-footnote">
          The configured cover rate determines default absorption. The cover
          balance alone does not imply full indemnity.
        </p>
      )}
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
  skipIntro = false,
  initialSection = 'vault',
}: {
  vaultId?: string
  holder?: string
  skipIntro?: boolean
  initialSection?: 'vault' | 'about'
}) {
  const router = useRouter()
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Experience | null>(null)
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [section, setSection] = useState<'vault' | 'loans' | 'rules' | 'about'>(
    initialSection,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const [sound, setSound] = useState(false)
  const [motion, setMotion] = useState(
    !matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [query, setQuery] = useState('')
  const [switching, setSwitching] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const switchDialog = useRef<HTMLDialogElement>(null)
  const { snapshot, pending, error, refresh } = useVault(vaultId, holder)
  const snapshotRef = useRef(snapshot)
  const revealed = phase === 'revealed' || phase === 'ready'
  const about = section === 'about'
  const selected = snapshot?.cards.find((card) => card.id === selectedId)
  const gridVisible = section === 'vault' && view === 'grid' && !fallback
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
    if (!canvas.current || fallback) return
    let cancelled = false
    setPhase('loading')
    setProgress(0)
    const fail = (e: unknown) => {
      if (cancelled) return
      console.warn('Using the live list fallback:', e)
      setFallback(true)
      setView('list')
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
              if (card.id !== 'loading') setSelectedId(card.id)
            },
            error: fail,
          })
          scene.current.setCards(snapshotRef.current?.cards ?? [])
          if (skipIntro && run === 0) scene.current.skip()
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
  }, [run, fallback, skipIntro])
  useEffect(() => {
    scene.current?.setActive(
      !revealed || (gridVisible && !selectedId && !switching),
    )
  }, [revealed, gridVisible, selectedId, switching])
  useEffect(() => {
    scene.current?.setMotion(motion)
  }, [motion, phase])
  useEffect(() => {
    if (!sound || phase !== 'intro') return
    const load = new Audio('/reference/site/assets/sounds/load.mp3'),
      whoosh = new Audio('/reference/site/assets/sounds/whoosh.mp3')
    load.volume = 0.35
    whoosh.volume = 0.3
    void load.play().catch(() => {})
    const timer = setTimeout(() => {
      void whoosh.play().catch(() => {})
    }, 2500)
    return () => {
      clearTimeout(timer)
      load.pause()
      whoosh.pause()
    }
  }, [sound, phase])
  useEffect(() => {
    if (selectedId && selected) dialog.current?.showModal()
    else dialog.current?.close()
  }, [selectedId, selected])
  useEffect(() => {
    if (switching) switchDialog.current?.showModal()
    else switchDialog.current?.close()
  }, [switching])
  function replay() {
    setSelectedId(null)
    setSection('vault')
    setView('grid')
    setFallback(false)
    setPhase('loading')
    setRun((n) => n + 1)
  }
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
    <main
      className={`ghost-root app live-app ${revealed ? 'is-revealed' : ''} ${about ? 'about-open' : ''}`}
      data-phase={phase}
      data-ledger-state={error ? 'error' : snapshot ? 'ready' : 'loading'}
    >
      <a
        className="skip-link"
        href="#ledger-content"
        onClick={() => {
          scene.current?.skip()
          setPhase('ready')
          setView('list')
          setSection('vault')
        }}
      >
        Skip to vault data
      </a>
      <canvas
        ref={canvas}
        className={`experience ${revealed && !gridVisible ? 'is-hidden' : ''}`}
        aria-label="Live vault data in an interactive grid. Drag to explore; switch to list view for keyboard-accessible metrics."
        tabIndex={revealed && gridVisible ? 0 : -1}
      />
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
        <button
          className="brand"
          onClick={() => {
            setSection('vault')
            setView(fallback ? 'list' : 'grid')
          }}
          aria-label="Patapim, back to the vault"
        >
          <img src="/reference/site/ghost.svg" alt="" width="45" height="74" />
          <span>patapim</span>
        </button>
        <button
          className={`sound mono ${sound ? 'is-on' : ''}`}
          onClick={() => setSound((v) => !v)}
          aria-pressed={sound}
          aria-label={sound ? 'Mute intro sound' : 'Enable intro sound'}
        >
          <span className="sound-bars" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
          SOUND [{sound ? 'ON' : 'OFF'}]
        </button>
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
        <button className="explore pill" onClick={refresh} disabled={pending}>
          {pending ? 'Refreshing…' : 'Refresh ledger'}
          <Icon name="arrow" />
        </button>
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
          <button onClick={() => setSwitching(true)}>Choose vault</button>
        </div>
      )}
      {revealed && !snapshot && !error && (
        <div className="ledger-loading" role="status">
          Reading the live vault…
        </div>
      )}
      {revealed && gridVisible && snapshot && (
        <div className="grid-caption mono">
          <span>{snapshot.name}</span>
          <span>
            {snapshot.asset} / {snapshot.phase}
            {snapshot.nextSeconds !== null
              ? ` / NEXT PHASE IN ${snapshot.nextSeconds}s AT LEDGER CLOSE`
              : ''}
          </span>
        </div>
      )}

      {revealed && !gridVisible && !about && (
        <section
          id="ledger-content"
          className="archive live-archive"
          aria-label="Live vault data"
        >
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
                    : 'Your vault'}
                <span>
                  {section === 'loans'
                    ? (snapshot?.loans.length ?? '—')
                    : (snapshot?.phase ?? 'connecting')}
                </span>
              </h1>
            </div>
            {section !== 'rules' && (
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
          {fallback && (
            <p className="fallback-note">
              The live list is active because the 3D intro could not load.
              Ledger data remains available.
            </p>
          )}
          {snapshot &&
            (section === 'loans' ? (
              <Loans snapshot={snapshot} query={query} />
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
      {revealed && about && (
        <section className="about" aria-label="About Patapim">
          <div className="about-top mono">
            <span>SECURITIES LENDING / XRPL</span>
            <span>FIXED TERM. AGENT COVER.</span>
          </div>
          <h1>
            Good assets.
            <br />
            Put to <span>work.</span>
          </h1>
          <div className="about-bottom">
            <div className="orbit" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div>
              <p>
                Holders lend securities.
                <br />
                Borrowers get access.
                <br />
                Agents put up capital.
              </p>
              <p className="about-detail">
                Eligible holders subscribe to a fixed-term vault. The lending
                agent posts first-loss cover, co-signs loans and manages
                defaults. Repayments and fees return in the same security.
                Credentials, domains, MPTs, vaults, loan brokers and XRP escrow
                are native ledger building blocks.
              </p>
              <button className="pill" onClick={() => openSection('vault')}>
                Explore the live vault <Icon name="arrow" />
              </button>
              <a className="pill" href="/deck/index.html">
                Pitch deck <Icon name="arrow" />
              </a>
            </div>
            <span className="mono about-index">
              TEAM PATAPIM / 2026
              <br />
              XRPL LENDING HACKATHON
              <br />
              <br />
              <a
                href={`${REPO}/blob/main/DEVELOPER-REPORT.md`}
                target="_blank"
                rel="noreferrer"
              >
                DEVELOPER REPORT
              </a>
              <br />
              <br />
              Devnet demonstration
              <br />
              with a fictitious security.
            </span>
          </div>
        </section>
      )}
      <footer
        className="chrome footer"
        inert={!revealed}
        aria-hidden={!revealed}
      >
        <div className="view-switch glass" aria-label="Display mode">
          <button
            className={gridVisible ? 'active' : ''}
            aria-label="Grid view"
            aria-pressed={gridVisible}
            disabled={fallback}
            onClick={() => {
              setView('grid')
              openSection('vault')
            }}
          >
            <Icon name="grid" />
          </button>
          <button
            className={section === 'vault' && view === 'list' ? 'active' : ''}
            aria-label="List view"
            aria-pressed={section === 'vault' && view === 'list'}
            onClick={() => {
              setView('list')
              openSection('vault')
            }}
          >
            <Icon name="list" />
          </button>
        </div>
        <div className="explore-hint mono">
          {gridVisible
            ? 'DRAG TO EXPLORE YOUR VAULT'
            : snapshot
              ? `${snapshot.cards.length} LIVE DATA TILES`
              : 'CONNECTING TO THE LEDGER'}
        </div>
        <nav className="dock glass" aria-label="Main navigation">
          {(['vault', 'loans', 'rules', 'about'] as const).map((next) => (
            <button
              key={next}
              className={section === next ? 'active' : ''}
              onClick={() => openSection(next)}
            >
              {next.charAt(0).toUpperCase() + next.slice(1)}
            </button>
          ))}
          <button onClick={replay} aria-label="Replay">
            Replay <Icon name="replay" />
          </button>
        </nav>
        <div className="footer-right">
          <a className="mono" href="/deck/index.html">
            PITCH DECK
            <br />
            <span className="muted">9 SLIDES / PATAPIM</span>
          </a>
          <button
            className="motion-toggle glass"
            onClick={() => setMotion((v) => !v)}
            aria-label={motion ? 'Pause animations' : 'Resume animations'}
            aria-pressed={!motion}
          >
            <Icon name={motion ? 'pause' : 'play'} />
          </button>
        </div>
      </footer>
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
  )
}
