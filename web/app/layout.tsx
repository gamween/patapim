import type { Metadata } from 'next'
import { NETWORK, LIBRARY, REPO } from '@/lib/config'
import './globals.css'

export const metadata: Metadata = {
  title: 'Recall, securities lending native on the XRP Ledger',
  description:
    'Eligible holders lend tokenised securities from a fixed-term vault through a lending agent, with the ledger enforcing the indemnity. Built on XLS-65 and XLS-66.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page">
          <nav className="nav">
            <a href="/" className="brand">
              Recall <small>by patapim</small>
            </a>
            <div className="nav-links">
              <a href="/#how">How it works</a>
              <a href="/#mapping">On the ledger</a>
              <a href={`${REPO}/blob/main/DEVELOPER-REPORT.md`}>Developer report</a>
              <a href={REPO}>GitHub</a>
            </div>
          </nav>
          {children}
          <footer>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                Team patapim · XRPL Lending Protocol Hackathon, Paris, 12-13 September 2026
              </span>
              <span className="mono">
                {NETWORK.name} · {LIBRARY}
              </span>
            </div>
            <p style={{ marginTop: 10, maxWidth: '70ch' }}>
              Demonstration on XRPL Devnet with a fictitious security. Funds and institutions named on
              this page are market context, not partners.
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
