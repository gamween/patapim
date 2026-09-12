import type { Metadata } from 'next'
import { NETWORK, LIBRARY, REPO, DEMO_VAULT } from '@/lib/config'
import './globals.css'

export const metadata: Metadata = {
  title: 'patapim, securities lending native on the XRP Ledger',
  description:
    'Eligible holders lend tokenised securities from a fixed-term vault through a lending agent, with the ledger enforcing the indemnity. Built on XLS-65 and XLS-66.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="page">
          <nav className="nav" aria-label="Main navigation">
            <a href="/" className="brand">
              patapim <small>securities lending on XRPL</small>
            </a>
            <div className="nav-links">
              <a href="/#how">How it works</a>
              <a href="/#mapping">On the ledger</a>
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
                <a href={REPO}>Team patapim</a> · XRPL Lending Protocol
                Hackathon, Paris, 12-13 September 2026
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
      </body>
    </html>
  )
}
