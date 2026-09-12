import { DEMO_VAULT, NETWORK } from '@/lib/config'

const PROBLEM = [
  {
    h: 'Issuance is solved. Usage is not.',
    p: 'Tokenised treasuries and money market funds are landing on XRPL. A holder can hold them, and that is all. No lending fee, and nobody can borrow them to post as collateral.',
  },
  {
    h: 'Regulated assets have no lending market on chain.',
    p: 'In traditional finance, agency securities lending is what makes long-only portfolios work: the lender earns a fee, the borrower gets high quality collateral, an agent guarantees the return. On chain, for regulated securities, that market does not exist yet.',
  },
  {
    h: 'Every piece already shipped.',
    p: 'Vaults, loan brokers, first-loss cover, credentials, permissioned domains, multi-purpose tokens, escrow. What was missing is the product that assembles them for capital markets.',
  },
]

const STEPS = [
  {
    h: 'Subscription',
    p: 'Eligible holders, carrying an on-chain credential accepted by the agent’s permissioned domain, deposit the tokenised security into a fixed-term vault. The vault’s asset is the security itself, not cash.',
  },
  {
    h: 'Indemnity',
    p: 'The lending agent owns the vault and the loan broker, and posts first-loss cover denominated in the same security. The ledger refuses to originate any loan the cover cannot absorb.',
  },
  {
    h: 'Borrow',
    p: 'A market maker who needs high quality collateral signs a request and escrows XRP. The agent checks eligibility and concentration, then counter-signs. Two signatures, one transaction.',
  },
  {
    h: 'Return',
    p: 'At maturity the borrower returns the securities with the fee. The collateral is released. The lenders’ share price rises by the fee actually delivered, not by the fee scheduled.',
  },
  {
    h: 'Default',
    p: 'Past the grace period the agent declares default. The first-loss cover repays the vault in securities and the collateral rebuilds the cover, so the lenders’ position is made whole.',
  },
]

const MAPPING: [string, string, string][] = [
  ['Lender pool', 'Closed-ended Single Asset Vault', 'XLS-65, asset is the tokenised security'],
  ['Lending agent', 'LoanBroker', 'XLS-66, owns the vault and the loan book'],
  ['Agent indemnity', 'First-loss cover', 'posted and paid in the security itself'],
  ['Eligibility', 'Credentials plus Permissioned Domain', 'gate carried by the vault’s share issuance'],
  ['The security', 'Multi-purpose token', 'issuer keeps clawback, lock and authorisation'],
  ['Settlement delay', 'GracePeriod', 'on the loan, before default can be declared'],
  ['Collateral', 'Escrowed XRP', 'held bilaterally, released on return'],
  ['Loan of securities', 'LoanSet, two signatures', 'agent signs, borrower counter-signs'],
]

export default function Home() {
  return (
    <>
      <section className="section">
        <div className="eyebrow">XRPL Lending Protocol Hackathon · Paris · September 2026</div>
        <h1>
          Securities lending,
          <br />
          native on the XRP Ledger.
        </h1>
        <p className="lede">
          patapim lets holders of tokenised securities lend them through a lending agent, for a fee.
          If the borrower does not return them in time, the agent’s own capital repays the vault and
          the ledger’s default logic makes the lenders whole. No smart contract: only native XRPL
          objects.
        </p>
        <div className="row" style={{ marginTop: 28 }}>
          {DEMO_VAULT ? (
            <a className="btn btn-primary" href={`/vault/${DEMO_VAULT}`}>
              Open the live vault
            </a>
          ) : null}
          <a className="btn" href="#how">
            How it works
          </a>
          <span className="mono muted">Live on {NETWORK.name}</span>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">The problem</div>
        <div className="grid grid-3">
          {PROBLEM.map((c) => (
            <div className="card" key={c.h}>
              <h3>{c.h}</h3>
              <p>{c.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="how">
        <div className="eyebrow">How it works</div>
        <h2>Five steps, all of them on ledger</h2>
        <div className="steps" style={{ marginTop: 24 }}>
          {STEPS.map((s) => (
            <div className="step" key={s.h}>
              <div className="step-n" />
              <div>
                <h3>{s.h}</h3>
                <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                  {s.p}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="mapping">
        <div className="eyebrow">On the ledger</div>
        <h2>Every piece of the trade maps to a native object</h2>
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Securities lending</th>
                <th>XRPL object</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map(([a, b, c]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>
                    <span className="mono">{b}</span>
                  </td>
                  <td className="muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">What we ship</div>
        <h2>A prototype that is not mocked, and a report that is not vague</h2>
        <p className="lede">
          The full cycle runs against XRPL Devnet: issuance, eligibility, subscription, origination
          with two signatures, repayment, phase gating and redemption, every step with a transaction
          hash. Alongside it, a developer report written transaction by transaction on what the
          protocol, its SDKs and its documentation got in our way, each item with a proposed fix.
        </p>
      </section>
    </>
  )
}
