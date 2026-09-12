import { DEMO_VAULT, NETWORK, REPO } from '@/lib/config'

const STEPS = [
  [
    'Subscription',
    'Eligible holders deposit tokenised securities into a fixed-term vault. Credentials and a permissioned domain gate access to the lender pool.',
  ],
  [
    'Indemnity',
    'The lending agent posts first-loss capital in the same security. A 100% cover rate is the configuration used for the fully covered default demonstration.',
  ],
  [
    'Borrow',
    'A market maker escrows XRP as bilateral collateral. The agent checks borrower eligibility and counter-signs the loan: two signatures, one transaction.',
  ],
  [
    'Return',
    'The borrower returns the securities with the fee and recovers the collateral. Lenders earn the fee actually delivered, reflected in the value of their shares.',
  ],
  [
    'Default',
    'After the grace period, the agent declares default. In our fully covered run, the agent’s capital repays the vault in securities, restoring the lenders’ net share price.',
  ],
]
const MAPPING = [
  [
    'Lender pool',
    'Closed-ended Single Asset Vault',
    'XLS-65 · the security is the asset',
  ],
  ['Lending agent', 'LoanBroker', 'XLS-66 · manages the loan book'],
  ['Agent indemnity', 'First-loss cover', 'Posted and paid in the security'],
  [
    'Lender eligibility',
    'Credentials + Permissioned Domain',
    'Authorisation on the lender position',
  ],
  [
    'The security',
    'Multi-purpose token',
    'Issuer-controlled authorisation, lock and clawback',
  ],
  ['Settlement window', 'GracePeriod', 'Time before default can be declared'],
  ['Bilateral collateral', 'XRP Escrow', 'Released separately on return'],
  ['Origination', 'LoanSet', 'Agent and borrower signatures'],
]

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <div className="eyebrow">Securities lending · Native on XRPL</div>
          <h1 id="hero-title">
            Good assets.
            <br />
            Put to <span>work.</span>
          </h1>
          <p className="lede">
            A lending market for tokenised securities. Holders earn a fee.
            Borrowers get the securities they need. The lending agent puts its
            own capital behind the trade.
          </p>
          <div className="row hero-actions">
            {DEMO_VAULT && (
              <a className="btn btn-primary" href={`/vault/${DEMO_VAULT}`}>
                Open the live vault
              </a>
            )}
            <a className="btn" href="#how">
              Follow the trade
            </a>
          </div>
          <p className="hero-note">
            Built on {NETWORK.name} · Track 2 / Loaded
            <br />
            XRPL Lending Protocol Hackathon · Paris, 2026
          </p>
        </div>
        <figure className="trade">
          <figcaption>The trade / Securities, end to end</figcaption>
          <div className="trade-node">
            <strong>Eligible holders</strong>
            <span>
              Deposit securities
              <br />
              Receive vault shares
            </span>
          </div>
          <div className="trade-node vault">
            <strong>patapim vault</strong>
            <span>
              Fixed term
              <br />
              Permissioned access
            </span>
          </div>
          <div className="trade-node">
            <strong>Borrower</strong>
            <span>
              Borrow securities
              <br />
              Return them + a fee
            </span>
          </div>
          <div className="trade-cover">
            Backed by the lending agent
            <small>First-loss capital, denominated in the same security.</small>
          </div>
        </figure>
      </section>
      <div className="protocol-strip">
        <span>Native XRPL objects</span>
        <span>XLS-65 Vaults</span>
        <span>XLS-66 Lending</span>
        <span>MPTs + Credentials + Domains + Escrow</span>
      </div>

      <section className="section" id="why">
        <div className="section-heading">
          <div>
            <div className="eyebrow">01 / The opportunity</div>
            <h2>Tokenisation is just the beginning.</h2>
          </div>
          <p>
            Issuance gives a security a place on the ledger. Securities lending
            gives holders another way to use it.
          </p>
        </div>
        <div className="grid grid-3">
          <article className="card">
            <span className="problem-number">01 / HOLDERS</span>
            <h3>Make holding productive.</h3>
            <p>
              Lend the security you already own through an agent, for a fee,
              within a defined term.
            </p>
          </article>
          <article className="card">
            <span className="problem-number">02 / BORROWERS</span>
            <h3>Access the asset you need.</h3>
            <p>
              Borrow tokenised securities through a co-signed loan, with XRP
              held as bilateral collateral.
            </p>
          </article>
          <article className="card">
            <span className="problem-number">03 / AGENTS</span>
            <h3>Put capital behind trust.</h3>
            <p>
              Manage the loan book and post first-loss cover in the same asset.
              The configured rate determines what a default absorbs.
            </p>
          </article>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-heading">
          <div>
            <div className="eyebrow">02 / How it works</div>
            <h2>
              One trade.
              <br />
              Five moments that matter.
            </h2>
          </div>
          <p>
            The vault holds securities. The ledger enforces the calendar. The
            agent manages eligibility, collateral and default.
          </p>
        </div>
        <div className="steps">
          {STEPS.map(([title, copy]) => (
            <article className="step" key={title}>
              <div className="step-n" aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="proof">
          <div className="eyebrow">Verified default / 100% cover rate</div>
          <h3>The agent takes the loss.</h3>
          <div className="grid grid-3">
            <div>
              <strong>2,000,000</strong>
              <p>Securities repaid by the cover</p>
            </div>
            <div>
              <strong>5,000,000</strong>
              <p>Vault assets after default</p>
            </div>
            <div>
              <strong>1.00</strong>
              <p>Net price per share restored after default</p>
            </div>
          </div>
          <p style={{ marginTop: 'var(--space-3)' }}>
            Historical Devnet run. During impairment, net share price is 0.60;
            after the covered default, it returns to 1.00.{' '}
            <a
              href={`${NETWORK.explorer}/transactions/95AD6692375BFD184155472FA105571BA9C9A836B221BB36F11CAA4F699C81D4`}
            >
              Inspect the default transaction
            </a>
            .
          </p>
        </div>
      </section>

      <section className="section" id="mapping">
        <div className="section-heading">
          <div>
            <div className="eyebrow">03 / On the ledger</div>
            <h2>
              Native building blocks.
              <br />A complete lending trade.
            </h2>
          </div>
          <p>
            No deployed smart contract. Each part of the product maps to a
            native XRPL object or transaction.
          </p>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="XRPL object mapping, scroll horizontally on small screens"
        >
          <table>
            <thead>
              <tr>
                <th>Product role</th>
                <th>XRPL primitive</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map(([a, b, c]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td className="mono">{b}</td>
                  <td className="muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section closing">
        <div>
          <div className="eyebrow">04 / Built, tested, documented</div>
          <h2>See what the ledger says.</h2>
          <p className="lede">
            A live vault, transaction evidence, and a developer report with
            concrete fixes for the protocol and its tools.
          </p>
        </div>
        <div className="grid">
          <a className="btn btn-primary" href={`/vault/${DEMO_VAULT}`}>
            Explore the live vault
          </a>
          <a className="btn" href={`${REPO}/blob/main/DEVELOPER-REPORT.md`}>
            Read the developer report
          </a>
          <a className="btn" href="/deck/index.html">
            Open the pitch deck
          </a>
        </div>
      </section>
    </>
  )
}
