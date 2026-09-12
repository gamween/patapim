import { NETWORK, LIBRARY, REPO, DEMO_VAULT } from '@/lib/config'

export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="page">
        <nav className="nav" aria-label="Main navigation">
          <a href="/" className="brand">
            patapim <small>securities lending on XRPL</small>
          </a>
          <div className="nav-links">
            <a href="/product#how">How it works</a>
            <a href="/product#mapping">On the ledger</a>
            <a href="/deck/index.html">Pitch deck</a>
            <a className="btn btn-primary" href={`/vault/${DEMO_VAULT}`}>
              Live vault
            </a>
          </div>
        </nav>
        <main id="main">{children}</main>
        <footer>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              <a href={REPO}>Team patapim</a> · XRPL Lending Protocol Hackathon,
              Paris, 12-13 September 2026
            </span>
            <span className="mono">
              {NETWORK.name} · {LIBRARY}
            </span>
          </div>
          <p style={{ marginTop: 10, maxWidth: '70ch' }}>
            Demonstration on XRPL Devnet with a fictitious security. Funds and
            institutions named on this page are market context, not partners.
          </p>
        </footer>
      </div>
    </>
  )
}
