'use client'

import { DEMO_VAULT } from '@/lib/config'
import './ghost.css'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Experience, Phase, Project } from './animation/Experience'
import projects from './projects.json'

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
function Preview({ project }: { project: Project }) {
  const a = project.atlas
  return (
    <div
      role="img"
      aria-label={project.title}
      className="atlas-preview"
      style={
        {
          '--atlas': `url(/reference/atlases/media-rgb-atlas-${a.index}.jpg)`,
          '--alpha': `url(/reference/atlases/media-alpha-atlas-${a.index}.jpg)`,
          '--position': `${a.cellX * 20}% ${a.cellY * 20}%`,
        } as CSSProperties
      }
    />
  )
}
function Clock() {
  const [date, setDate] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setDate(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="clock mono">
      <span>
        <i /> PARIS, FR
      </span>
      <time>
        {date.toLocaleTimeString('fr-FR', {
          timeZone: 'Europe/Paris',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </time>
      <span className="muted">LOCAL TIME</span>
      <span className="muted">48°51′ N</span>
    </div>
  )
}

export default function GhostApp() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Experience | null>(null)
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [about, setAbout] = useState(false)
  const [selected, setSelected] = useState<Project | null>(null)
  const [fallback, setFallback] = useState(false)
  const [sound, setSound] = useState(false)
  const [motion, setMotion] = useState(
    !matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const revealed = phase === 'revealed' || phase === 'ready'
  const loading = phase === 'loading' || phase === 'separating'

  useEffect(() => {
    if (!canvas.current || fallback) return
    let cancelled = false
    setPhase('loading')
    setProgress(0)
    const fail = (e: unknown) => {
      if (cancelled) return
      console.warn('Using accessible gallery fallback:', e)
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
            select: setSelected,
            error: fail,
          })
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
  }, [run, fallback])

  useEffect(() => {
    scene.current?.setActive(
      !revealed || (view === 'grid' && !about && !selected),
    )
  }, [view, about, selected, revealed])
  useEffect(() => {
    scene.current?.setMotion(motion)
  }, [motion, phase])
  useEffect(() => {
    if (!sound || phase !== 'intro') return
    const load = new Audio('/reference/site/assets/sounds/load.mp3')
    const whoosh = new Audio('/reference/site/assets/sounds/whoosh.mp3')
    load.volume = 0.35
    whoosh.volume = 0.3
    void load.play().catch(() => {})
    const id = setTimeout(() => {
      void whoosh.play().catch(() => {})
    }, 2500)
    return () => {
      clearTimeout(id)
      load.pause()
      whoosh.pause()
    }
  }, [sound, phase])
  useEffect(() => {
    if (selected) dialog.current?.showModal()
    else dialog.current?.close()
  }, [selected])
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbout(false)
        setSelected(null)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  function replay() {
    setAbout(false)
    setSelected(null)
    setView('grid')
    setFallback(false)
    setPhase('loading')
    setRun((n) => n + 1)
  }
  const filtered = projects.filter((p) =>
    `${p.title} ${p.client} ${p.zone} ${p.features.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <main
      className={`ghost-root app ${revealed ? 'is-revealed' : ''} ${about ? 'about-open' : ''}`}
      data-phase={phase}
    >
      <a
        className="skip-link"
        href="#archive"
        onClick={() => {
          scene.current?.skip()
          setView('list')
        }}
      >
        Skip to references
      </a>
      <canvas
        ref={canvas}
        className={`experience ${view === 'list' || about || fallback ? 'is-hidden' : ''}`}
        aria-label="Interactive visual reference gallery. Drag to explore or use the arrow keys. Use list view to open each reference with the keyboard."
        tabIndex={revealed && view === 'grid' && !about ? 0 : -1}
      />

      {loading && (
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
          onClick={() => scene.current?.skip()}
        >
          SKIP INTRO <span>↗</span>
        </button>
      )}

      {!revealed && (
        <nav className="intro-links" aria-label="Direct access">
          <a href="/product">Product</a>
          <a href={`/vault/${DEMO_VAULT}`}>Live vault</a>
          <a href="/deck/index.html">Deck</a>
        </nav>
      )}
      <header
        className="header chrome"
        inert={!revealed}
        aria-hidden={!revealed}
      >
        <button
          className="brand"
          onClick={() => {
            setAbout(false)
            setView(fallback ? 'list' : 'grid')
          }}
          aria-label="Patapim, back to the gallery"
        >
          <img src="/reference/site/ghost.svg" alt="" width="45" height="74" />
          <span>patapim</span>
        </button>
        <button
          className={`sound mono ${sound ? 'is-on' : ''}`}
          onClick={() => setSound((s) => !s)}
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
        <p className="statement mono">
          SECURITIES LENDING.
          <br />
          NATIVE ON THE
          <br />
          XRP LEDGER.
        </p>
        <Clock />
        <a className="explore pill" href={`/vault/${DEMO_VAULT}`}>
          Live vault <Icon name="arrow" />
        </a>
      </header>

      {revealed && view === 'list' && !about && (
        <section
          id="archive"
          className="archive"
          aria-label="Visual references"
        >
          <div className="archive-heading">
            <div>
              <span className="eyebrow mono">
                PHANTOM VISUAL REFERENCES / 001
              </span>
              <h1>
                Reference collection<span>({projects.length})</span>
              </h1>
            </div>
            <label className="search mono">
              <span>SEARCH</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Project, client, discipline…"
                type="search"
              />
            </label>
          </div>
          {fallback && (
            <p className="fallback-note">
              List view is available because the 3D experience could not load.
              You can still explore Patapim and open the live vault.
            </p>
          )}
          <div className="project-list">
            {filtered.map((p, i) => (
              <button
                className="project-row"
                key={p.id}
                onClick={() => setSelected(p)}
              >
                <span className="row-number mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Preview project={p} />
                <span className="row-title">{p.title}</span>
                <span className="row-client mono">{p.client}</span>
                <span className="row-year mono">
                  {p.launchDate.slice(0, 4)}
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="no-results">No reference matches “{query}”.</p>
          )}
          <p className="reference-credit mono">
            VISUAL REFERENCES & PROJECTS BY{' '}
            <a
              href="https://www.phantom.land/"
              target="_blank"
              rel="noreferrer"
            >
              PHANTOM STUDIOS ↗
            </a>
          </p>
        </section>
      )}

      {about && (
        <section className="about" aria-label="About Patapim">
          <div className="about-top mono">
            <span>SECURITIES LENDING / 001</span>
            <span>NATIVE ON XRPL</span>
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
                Patapim is a fixed-term securities lending vault on the XRP
                Ledger. Explore the product, then inspect the real ledger data.
                This visual experience and its reference collection come from
                our frontend study of Phantom Studios.
              </p>
              <a className="pill" href="/product">
                Explore the product <Icon name="arrow" />
              </a>
              <button className="pill" onClick={replay}>
                Replay the experience <Icon name="replay" />
              </button>
            </div>
            <span className="mono about-index">
              PARIS, FRANCE
              <br />
              TEAM PATAPIM / 2026
              <br />
              <br />
              <a
                href="https://www.phantom.land/"
                target="_blank"
                rel="noreferrer"
              >
                REFERENCE: PHANTOM ↗
              </a>
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
            className={view === 'grid' && !about ? 'active' : ''}
            aria-label="Grid view"
            aria-pressed={view === 'grid' && !about}
            onClick={() => {
              if (!fallback) setView('grid')
              setAbout(false)
            }}
            disabled={fallback}
          >
            <Icon name="grid" />
          </button>
          <button
            className={view === 'list' && !about ? 'active' : ''}
            aria-label="List view"
            aria-pressed={view === 'list' && !about}
            onClick={() => {
              setView('list')
              setAbout(false)
            }}
          >
            <Icon name="list" />
          </button>
        </div>
        <div className="explore-hint mono">
          {about
            ? 'ASSETS IN MOTION'
            : view === 'grid'
              ? 'DRAG TO DISCOVER'
              : `${filtered.length} VISUAL REFERENCES`}
          <span>{view === 'grid' && !about ? '↔' : '↗'}</span>
        </div>
        <nav className="dock glass" aria-label="Main navigation">
          <button
            className={!about ? 'active' : ''}
            onClick={() => setAbout(false)}
          >
            Gallery
          </button>
          <button
            className={about ? 'active' : ''}
            onClick={() => setAbout(true)}
          >
            About
          </button>
          <a href="/product">Product</a>
          <a href="/deck/index.html">Deck</a>
          <button onClick={replay}>
            Replay <Icon name="replay" />
          </button>
        </nav>
        <div className="footer-right">
          <span className="mono">
            PHANTOM REFERENCES
            <br />
            <span className="muted">{projects.length} VISUAL STUDIES</span>
          </span>
          <button
            className="motion-toggle glass"
            onClick={() => setMotion((m) => !m)}
            aria-label={motion ? 'Pause animations' : 'Resume animations'}
            aria-pressed={!motion}
          >
            <Icon name={motion ? 'pause' : 'play'} />
          </button>
        </div>
      </footer>

      <dialog
        ref={dialog}
        className="project-dialog"
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null)
        }}
      >
        {selected && (
          <article>
            <div className="dialog-bar mono">
              <span>PHANTOM / {selected.zone}</span>
              <button
                className="close-button"
                autoFocus
                onClick={() => setSelected(null)}
                aria-label="Close reference"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="dialog-image">
              <Preview project={selected} />
            </div>
            <div className="dialog-copy">
              <span className="mono">
                {selected.client} / {selected.launchDate.slice(0, 4)}
              </span>
              <h2>{selected.title}</h2>
              <div className="tags">
                {selected.features.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
              <p>
                A project by Phantom Studios, included in our visual reference
                collection. The brands shown are not Patapim partners.
              </p>
              <a
                className="pill"
                href="https://www.phantom.land/"
                target="_blank"
                rel="noreferrer"
              >
                Visit the original studio <Icon name="arrow" />
              </a>
            </div>
          </article>
        )}
      </dialog>
    </main>
  )
}
