import LiveRefresh from '@/app/components/live-refresh'
import { NETWORK } from '@/lib/config'
import {
  readVault,
  readPosition,
  loanStatus,
  vaultData,
  PHASE_RULES,
  rippleToDate,
  shortId,
} from '@/lib/ledger'

export const dynamic = 'force-dynamic'

const n = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v)

const STATUS_TONE: Record<string, string> = {
  current: 'badge-positive',
  overdue: 'badge-warn',
  impaired: 'badge-warn',
  defaulted: 'badge-danger',
  'paid off': 'badge-accent',
}

const PHASE_TONE: Record<string, string> = {
  subscription: 'badge-accent',
  investment: 'badge-warn',
  redemption: 'badge-positive',
  'open-ended': 'badge-accent',
}

function countdown(seconds: number) {
  if (seconds <= 0) return 'now'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default async function VaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ holder?: string }>
}) {
  const { id } = await params
  const { holder } = await searchParams

  let view
  try {
    view = await readVault(id)
  } catch (e) {
    return (
      <section className="section error-state">
        <div className="eyebrow">Ledger connection</div>
        <h1>Vault unavailable</h1>
        <p className="lede">
          The ledger returned:{' '}
          <span className="mono">{String((e as Error).message)}</span>
        </p>
        <p className="lede">
          This page reads {NETWORK.name} only. A vault created on the custom
          hackathon devnet will not resolve here, and that is deliberate: the
          two networks enforce different lending rules.
        </p>
        <div className="row">
          <LiveRefresh />
          <a className="btn" href="/">
            Back to Patapim
          </a>
        </div>
      </section>
    )
  }

  const { vault, shares, broker, loans, clock, phase } = view
  const isClosed = vault.VaultKind === 1
  const nextBoundary = isClosed
    ? phase === 'subscription'
      ? vault.SubscriptionDate
      : phase === 'investment'
        ? vault.RedemptionDate
        : null
    : null
  const meta = vaultData(vault.Data)
  const compressedSeconds = isClosed
    ? vault.RedemptionDate - vault.SubscriptionDate
    : 0
  const position =
    holder && vault.ShareMPTID
      ? await readPosition(vault.ShareMPTID, holder)
      : null
  const positionShares = Number(position?.MPTAmount ?? 0)
  const rules = PHASE_RULES[phase]

  return (
    <>
      <section className="section dashboard-head">
        <div className="dashboard-topline">
          <div className="eyebrow">Live vault / {shortId(id, 8)}</div>
          <LiveRefresh />
        </div>
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <h1>
              {isClosed ? 'Fixed-term lending vault' : 'Open-ended vault'}
            </h1>
            <p className="muted" style={{ marginTop: 8 }}>
              Asset{' '}
              <span className="mono">
                {vault.Asset?.mpt_issuance_id
                  ? `MPT ${shortId(vault.Asset.mpt_issuance_id, 8)}`
                  : vault.Asset?.currency === 'XRP'
                    ? 'XRP'
                    : `${vault.Asset?.currency} / ${shortId(vault.Asset?.issuer ?? '')}`}
              </span>
              {vault.Flags === 65536 ? (
                <>
                  {' · '}
                  <span className="badge badge-accent">permissioned</span>
                </>
              ) : null}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              className={`badge ${PHASE_TONE[phase]}`}
              style={{ fontSize: 13 }}
            >
              {phase}
            </span>
            {nextBoundary ? (
              <p className="mono muted" style={{ marginTop: 8, fontSize: 12 }}>
                next phase in {countdown(nextBoundary - clock)}
                <br />
                at ledger close time
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="section dashboard-section dashboard-metrics"
        aria-label="Vault metrics"
      >
        <div className="grid metrics-grid">
          <div className="tile">
            <div className="label">Assets total</div>
            <div className="value">{n(view.assetsTotal)}</div>
            <div className="sub">AssetsTotal</div>
          </div>
          <div className="tile">
            <div className="label">Available liquidity</div>
            <div className="value">{n(view.assetsAvailable)}</div>
            <div className="sub">AssetsAvailable</div>
          </div>
          <div className="tile">
            <div className="label">Unrealised loss</div>
            <div
              className="value"
              style={
                view.lossUnrealized > 0 ? { color: 'var(--danger)' } : undefined
              }
            >
              {n(view.lossUnrealized)}
            </div>
            <div className="sub">LossUnrealized, impaired loans</div>
          </div>
          <div className="tile">
            <div className="label">Price per share</div>
            <div className="value">{n(view.pricePerShare, 6)}</div>
            <div className="sub">
              (AssetsTotal − LossUnrealized) / OutstandingAmount
            </div>
          </div>
          <div className="tile">
            <div className="label">Utilisation</div>
            <div className="value">
              {view.utilisation === null
                ? '—'
                : `${n(view.utilisation * 100, 1)}%`}
            </div>
            <div className="sub">lent out / total</div>
          </div>
        </div>

        {isClosed ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Vault timeline</h3>
            <div className="phase-timeline" aria-label="Vault phases">
              {(['subscription', 'investment', 'redemption'] as const).map(
                (step, i) => (
                  <div
                    className="phase-step"
                    key={step}
                    aria-current={phase === step ? 'step' : undefined}
                  >
                    <span className="mono">
                      0{i + 1} {phase === step ? '/ CURRENT' : ''}
                    </span>
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </div>
                ),
              )}
            </div>
            <div className="grid grid-3 term-grid" style={{ marginTop: 24 }}>
              <div>
                <div className="label muted" style={{ fontSize: 12 }}>
                  Subscription closes
                </div>
                <div className="mono">
                  {rippleToDate(vault.SubscriptionDate)
                    .toISOString()
                    .slice(0, 19)}
                  Z
                </div>
              </div>
              <div>
                <div className="label muted" style={{ fontSize: 12 }}>
                  Redemption opens
                </div>
                <div className="mono">
                  {rippleToDate(vault.RedemptionDate)
                    .toISOString()
                    .slice(0, 19)}
                  Z
                </div>
              </div>
              <div>
                <div className="label muted" style={{ fontSize: 12 }}>
                  Ledger clock
                </div>
                <div className="mono">
                  {rippleToDate(clock).toISOString().slice(0, 19)}Z
                </div>
              </div>
            </div>
            {meta.term_days ? (
              <p style={{ fontSize: 13, marginTop: 12 }}>
                <strong>{meta.term_days} day term</strong>, compressed to{' '}
                {Math.floor(compressedSeconds / 60)}m {compressedSeconds % 60}s
                for this demonstration. The vault carries that on chain in its{' '}
                <span className="mono">Data</span> field, so this page reads the
                modelled duration rather than asserting it.
              </p>
            ) : null}
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              Phases are judged against the parent ledger close time, never
              against the clock of the machine submitting. This page uses the
              ledger.
            </p>
          </div>
        ) : null}
      </section>

      <section className="section dashboard-section">
        <div className="eyebrow">Phase rules / {phase}</div>
        <h2 style={{ marginBottom: 24 }}>What the ledger accepts right now</h2>
        <p className="rules-intro">
          Phase permissions at the last ledger read. Eligibility, cover and
          other transaction checks still apply.
        </p>
        <div className="grid grid-2">
          <div className="card rule-allowed">
            <h3>Allowed in {phase}</h3>
            <div className="row" style={{ marginTop: 10 }}>
              {rules.allowed.map((t) => (
                <span className="badge badge-positive mono" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="card rule-blocked">
            <h3>Refused in {phase}</h3>
            {rules.blocked.length === 0 ? (
              <p>Nothing: an open-ended vault has no phase gate.</p>
            ) : (
              <div className="grid" style={{ marginTop: 10, gap: 8 }}>
                {rules.blocked.map(([tx, code]) => (
                  <div
                    className="row"
                    key={tx}
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span className="mono">{tx}</span>
                    <span className="badge badge-danger mono">{code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {broker ? (
        <section className="section dashboard-section">
          <div className="eyebrow">Lending agent</div>
          <div className="grid grid-4">
            <div className="tile">
              <div className="label">First-loss cover</div>
              <div className="value">
                {n(Number(broker.CoverAvailable ?? 0))}
              </div>
              <div className="sub">CoverAvailable</div>
            </div>
            <div className="tile">
              <div className="label">Debt outstanding</div>
              <div className="value">{n(Number(broker.DebtTotal ?? 0))}</div>
              <div className="sub">DebtTotal</div>
            </div>
            <div className="tile">
              <div className="label">Debt ceiling</div>
              <div className="value">{n(Number(broker.DebtMaximum ?? 0))}</div>
              <div className="sub">DebtMaximum</div>
            </div>
            <div className="tile">
              <div className="label">Cover rate</div>
              <div className="value">
                {n(Number(broker.CoverRateMinimum ?? 0) / 1000, 1)}%
              </div>
              <div className="sub">CoverRateMinimum, parts per 100000</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section dashboard-section">
        <div className="eyebrow">Loan book</div>
        {loans.length === 0 ? (
          <div className="empty-state">
            <h3>No loans in this snapshot.</h3>
            <p className="muted">
              Loans returned by the ledger appear here with their outstanding
              balance, payment date and status.
            </p>
          </div>
        ) : (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Loan book, scroll horizontally on small screens"
          >
            <table>
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th className="num">Principal outstanding</th>
                  <th className="num">Total owed</th>
                  <th className="num">Payments left</th>
                  <th>Next payment due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.index}>
                    <td className="mono">{shortId(l.Borrower, 8)}</td>
                    <td className="num">
                      {n(Number(l.PrincipalOutstanding ?? 0))}
                    </td>
                    <td className="num">
                      {n(Number(l.TotalValueOutstanding ?? 0))}
                    </td>
                    <td className="num">{l.PaymentRemaining ?? '—'}</td>
                    <td className="mono">
                      {l.NextPaymentDueDate
                        ? rippleToDate(l.NextPaymentDueDate)
                            .toISOString()
                            .slice(11, 19) + 'Z'
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${STATUS_TONE[loanStatus(l, clock)]}`}
                      >
                        {loanStatus(l, clock)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {holder ? (
        <section className="section dashboard-section">
          <div className="eyebrow">Position</div>
          <div className="grid grid-3">
            <div className="tile">
              <div className="label">Holder</div>
              <div className="value" style={{ fontSize: 15 }}>
                <span className="mono">{shortId(holder, 10)}</span>
              </div>
            </div>
            <div className="tile">
              <div className="label">Shares</div>
              <div className="value">{n(positionShares)}</div>
              <div className="sub">MPTAmount on the share issuance</div>
            </div>
            <div className="tile">
              <div className="label">Value in securities</div>
              <div className="value">
                {view.sharesOutstanding > 0
                  ? n((positionShares / view.sharesOutstanding) * view.nav)
                  : '—'}
              </div>
              <div className="sub">shares / outstanding × net assets</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section dashboard-section">
        <div className="eyebrow">Provenance</div>
        <h2>Every number above, and the call it came from</h2>
        <p className="lede">
          {view.calls.length} server-side ledger requests. The ledger exposes no
          single view of a vault: shares outstanding live on a separate token
          issuance, and the loans live under the loan broker’s pseudo-account
          rather than under the vault or its owner.
        </p>
        <details className="provenance">
          <summary>JSON-RPC requests behind this page</summary>
          <pre>
            {view.calls
              .map(
                (c, i) => `${i + 1}. ${c.why}\n   ${JSON.stringify(c.request)}`,
              )
              .join('\n\n')}
          </pre>
        </details>
        <p className="mono muted" style={{ marginTop: 14, fontSize: 12 }}>
          <a href={`${NETWORK.explorer}/accounts/${vault.Owner}`}>
            owner on the explorer
          </a>
          {shares ? ` · share issuance ${shortId(vault.ShareMPTID, 8)}` : ''}
        </p>
      </section>
    </>
  )
}
