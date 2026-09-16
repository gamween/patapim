import { NETWORK } from './config'
import {
  readVault,
  readPosition,
  loanStatus,
  PHASE_RULES,
  rippleToDate,
  shortId,
  type Collateral,
} from './ledger'
import {
  coverAtDefault,
  collateralMargin,
  duration,
  exitNavPerShare,
  entryPricePerShare,
  firstLossCoverage,
  interestToLenders,
  netLendingReturnBps,
  tenthBpsToBps,
  tenthBpsToFraction,
  weightedLendingFeeBps,
} from './finance'
import type { LedgerCard, LoanRow, VaultSnapshot } from './vault-ui'

const number = (v: number | null, digits = 0) =>
  v === null || !Number.isFinite(v)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v)
const percent = (v: number | null, digits = 1) =>
  v === null || !Number.isFinite(v) ? '—' : `${number(v * 100, digits)}%`
const date = (v: number | undefined) =>
  v ? rippleToDate(v).toISOString() : null
const stamp = (v: number | undefined) =>
  v ? rippleToDate(v).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—'

/**
 * Cash collateral is valued at par against the oracle's quote currency only when its own metadata
 * says it is a stablecoin in that currency's family. Anything else is shown, never valued.
 */
function collateralValueInQuote(c: Collateral, quote: string | undefined) {
  if (!quote) return null
  const par = c.token.subclass === 'stablecoin' && c.token.ticker.toUpperCase().startsWith(quote.toUpperCase())
  return par ? c.value : null
}

/** Adapt the ledger reader into the cards, rows and signing fields the app renders. */
export async function presentVault(
  id: string,
  holder?: string,
): Promise<VaultSnapshot> {
  const view = await readVault(id)
  const { vault, broker, phase, clock, asset, price } = view
  const calls = [...view.calls]
  const ticker = asset?.ticker ?? 'units'
  const closed = vault.VaultKind === 1
  const boundary = closed
    ? phase === 'subscription'
      ? { at: vault.SubscriptionDate as number, label: 'investment period' }
      : phase === 'investment'
        ? { at: vault.RedemptionDate as number, label: 'redemption' }
        : null
    : null
  const termDays = closed
    ? Math.round((Number(vault.RedemptionDate) - Number(vault.SubscriptionDate)) / 86400)
    : null

  const loans: LoanRow[] = view.loans.map((l) => {
    const posted = view.collateral[String(l.Borrower)] ?? []
    const valued = posted.map((c) => collateralValueInQuote(c, price?.quote))
    const total = valued.every((v) => v !== null) && valued.length ? (valued as number[]).reduce((a, b) => a + b, 0) : null
    const principal = Number(l.PrincipalOutstanding ?? 0)
    return {
      id: String(l.index),
      borrower: String(l.Borrower ?? ''),
      principal: number(principal),
      owed: number(Number(l.TotalValueOutstanding ?? 0)),
      interestToLenders: number(interestToLenders(l)),
      feeBps: `${number(tenthBpsToBps(Number(l.InterestRate ?? 0)), 1)} bps p.a.`,
      payments: String(l.PaymentRemaining ?? '—'),
      due: date(l.NextPaymentDueDate) ?? '—',
      grace: duration(Number(l.GracePeriod ?? 0)),
      status: loanStatus(l, clock),
      collateral: posted.length
        ? posted.map((c) => `${number(c.value, c.token.scale)} ${c.token.ticker}`).join(' + ')
        : 'None on the ledger',
      margin: price && total !== null ? percent(collateralMargin(total, principal, price.price)) : '—',
    }
  })

  const feeBps = weightedLendingFeeBps(view.loans)
  const util = view.utilisation
  const mgmtRate = Number(broker?.ManagementFeeRate ?? 0)
  const agentShare = tenthBpsToFraction(mgmtRate)
  const lenderInterest = view.loans.reduce((a, l) => a + interestToLenders(l), 0)
  const principalOut = view.loans.reduce((a, l) => a + Number(l.PrincipalOutstanding ?? 0), 0)

  const cards: LedgerCard[] = [
    {
      id: 'assets',
      title: 'Fund assets',
      value: number(view.assetsTotal),
      subtitle: `${ticker}${asset?.name ? ` · ${asset.name}` : ''}`,
      category: 'FUND / ASSETS',
      tone: 'green',
      lines: [
        ['Available liquidity', number(view.assetsAvailable)],
        ['Lent out', number(view.assetsTotal - view.assetsAvailable)],
        ['Unrealised loss', number(view.lossUnrealized)],
      ],
    },
    {
      id: 'price',
      title: 'NAV per share',
      value: number(exitNavPerShare(view.assetsTotal, view.lossUnrealized, view.sharesOutstanding), 6),
      subtitle: `Exit price, in ${ticker} per share`,
      category: 'LENDER / VALUE',
      tone: 'green',
      lines: [
        ['Entry price (deposits)', number(entryPricePerShare(view.assetsTotal, view.sharesOutstanding), 6)],
        ['Shares outstanding', number(view.sharesOutstanding)],
        ['Unrealised loss deducted', number(view.lossUnrealized)],
      ],
      note: 'Exit NAV per share = (AssetsTotal − LossUnrealized) / shares outstanding; entry price = AssetsTotal / shares. These are the two exchange rates of XLS-65, and Maple v2 prices exits the same way. Counted in the security, not in dollars: the NAV floats.',
    },
    {
      id: 'phase',
      title: 'Fund phase',
      value: phase.toUpperCase(),
      subtitle: boundary
        ? `${duration(boundary.at - clock)} to ${boundary.label}`
        : closed
          ? 'Redemption window open'
          : 'No fixed term',
      category: 'TERM / LEDGER CLOCK',
      phaseIndex: ['subscription', 'investment', 'redemption'].indexOf(phase),
      lines: [
        ['Subscription closes', stamp(vault.SubscriptionDate)],
        ['Redemption opens', stamp(vault.RedemptionDate)],
        ['Term', termDays === null ? 'Open-ended' : `${termDays} days`],
      ],
    },
    {
      id: 'utilisation',
      title: 'Utilisation',
      value: percent(util),
      subtitle: 'Lent out / fund assets',
      category: 'FUND / ALLOCATION',
      meter: util === null ? undefined : util,
      lines: [
        ['Lent out', number(view.assetsTotal - view.assetsAvailable)],
        ['Available liquidity', number(view.assetsAvailable)],
        ['Fund assets', number(view.assetsTotal)],
      ],
    },
    {
      id: 'income',
      title: 'Lending income',
      value: feeBps === null ? 'NO LOANS' : `${number(feeBps, 1)} BPS`,
      subtitle: feeBps === null ? 'Nothing on loan' : 'Lending fee, annualised, principal-weighted',
      category: 'LENDER / RETURN',
      tone: 'green',
      lines: [
        ['Fee split, lenders / agent', broker ? `${number((1 - agentShare) * 100)} / ${number(agentShare * 100)}` : '—'],
        ['Fund return from lending, p.a.', feeBps === null ? '—' : `${number(netLendingReturnBps(feeBps, util, mgmtRate), 1)} bps`],
        ['Interest due to lenders at return', `${number(lenderInterest)} ${ticker}`],
      ],
      note: 'Fund return = lending fee × utilisation × (1 − agent share), the supply-rate identity lending pools use. XRPL accrues interest over a 365-day year, and a vault created under Lending Protocol V1.1 books it into assets only when paid.',
    },
    {
      id: 'loans',
      title: 'Loan book',
      value: String(loans.length),
      subtitle:
        loans.length === 1
          ? 'Term loan recorded on the ledger'
          : 'Term loans recorded on the ledger',
      category: 'LENDING / POSITIONS',
      lines: loans.length
        ? loans.slice(0, 3).map((l) => [shortId(l.borrower), l.status])
        : [['Loan book', 'No loans returned']],
    },
  ]

  if (broker) {
    const atDefault = coverAtDefault(broker, principalOut)
    const coverage = firstLossCoverage(broker)
    cards.push({
      id: 'cover',
      title: 'First-loss capital',
      value: number(Number(broker.CoverAvailable ?? 0)),
      subtitle: `Posted by the lending agent, in ${ticker}`,
      category: 'AGENT / FIRST LOSS',
      tone: atDefault.share === null || atDefault.share >= 1 ? 'green' : 'amber',
      lines: [
        ['First-loss coverage, cover / debt', percent(coverage)],
        ['Paid to the fund if the book defaults', principalOut ? `${number(atDefault.covered)} (${percent(atDefault.share, 0)})` : '—'],
        ['Cover rate, minimum / liquidation', `${percent(tenthBpsToFraction(Number(broker.CoverRateMinimum ?? 0)), 0)} / ${percent(tenthBpsToFraction(Number(broker.CoverRateLiquidation ?? 0)), 0)}`],
      ],
      note: 'Paid at default = min(DebtTotal × CoverRateMinimum × CoverRateLiquidation, principal outstanding), capped by CoverAvailable (LoanManage.cpp). The cover is capped by its rates: it is the agent’s first-loss capital, not an unlimited indemnity.',
    })

    const posted = Object.values(view.collateral).flat()
    if (posted.length) {
      const valued = posted.map((c) => collateralValueInQuote(c, price?.quote))
      const total = valued.every((v) => v !== null) ? (valued as number[]).reduce((a, b) => a + b, 0) : null
      const token = posted[0].token
      cards.push({
        id: 'collateral',
        title: 'Borrower collateral',
        value: number(posted.reduce((a, c) => a + c.value, 0), token.scale),
        subtitle: `${token.ticker} in token escrow to the agent`,
        category: 'BORROWER / COLLATERAL',
        tone: 'green',
        lines: [
          ['Margin on loan market value', price && total !== null ? percent(collateralMargin(total, principalOut, price.price)) : '—'],
          ['Reference price', price ? `${price.base}/${price.quote} ${number(price.price, 4)}` : 'No oracle named'],
          ['Claimable by the agent from', stamp(posted[0].finishAfter)],
        ],
        note: `Collateral is not part of an XLS-66 loan: the borrower posts it in a separate token escrow the agent can finish only after the payment date and grace period, and the borrower recovers after CancelAfter. ${token.ticker} is valued at par in ${price?.quote ?? 'the quote currency'}; the price comes from the Price Oracle named in the vault Data and is set at origination, not marked to market daily.`,
      })
    }

    cards.push({
      id: 'debt',
      title: 'Loan broker',
      value: number(Number(broker.DebtTotal ?? 0)),
      subtitle: 'Debt outstanding to the fund',
      category: 'AGENT / LOAN BROKER',
      lines: [
        ['Debt ceiling', number(Number(broker.DebtMaximum ?? 0))],
        ['Headroom', number(Math.max(0, Number(broker.DebtMaximum ?? 0) - Number(broker.DebtTotal ?? 0)))],
        ['Management fee, share of interest', percent(agentShare, 0)],
      ],
    })
  }

  if (vault.AssetsMaximum) {
    const max = Number(vault.AssetsMaximum)
    cards.push({
      id: 'capacity',
      title: 'Subscription capacity',
      value: number(Math.max(0, max - view.assetsTotal)),
      subtitle: `${ticker} still open to subscribe`,
      category: 'FUND / OFFERING',
      meter: max > 0 ? Math.min(1, view.assetsTotal / max) : undefined,
      lines: [
        ['Maximum fund size', number(max)],
        ['Subscribed', number(view.assetsTotal)],
        ['Filled', percent(max > 0 ? view.assetsTotal / max : null)],
      ],
    })
  }

  cards.push({
    id: 'rules',
    title: 'Ledger rules',
    value: `${PHASE_RULES[phase].allowed.length} ALLOWED`,
    subtitle: `${PHASE_RULES[phase].blocked.length} phase restrictions in ${phase}`,
    category: 'PROTOCOL / PERMISSIONS',
    tone: 'green',
    lines: PHASE_RULES[phase].blocked.length
      ? PHASE_RULES[phase].blocked
      : [['Phase gate', 'No restrictions']],
  })

  let position: VaultSnapshot['position'] = null
  if (holder) {
    const p = vault.ShareMPTID
      ? await readPosition(vault.ShareMPTID, holder)
      : null
    if (vault.ShareMPTID)
      calls.push({
        why: 'the holder position on the vault share issuance',
        request: {
          command: 'ledger_entry',
          mptoken: { mpt_issuance_id: vault.ShareMPTID, account: holder },
          ledger_index: 'validated',
        },
      })
    const shares = p ? Number(p.MPTAmount ?? 0) : null
    position = {
      holder,
      shares: number(shares),
      value: number(
        shares !== null && view.sharesOutstanding > 0
          ? (shares / view.sharesOutstanding) * view.nav
          : null,
      ),
    }
    cards.push({
      id: 'position',
      title: 'Your position',
      value: position.value,
      subtitle: shortId(holder, 8),
      category: 'LENDER / HOLDING',
      lines: [
        ['Vault shares', position.shares],
        [`Value in ${ticker}`, position.value],
        ['Holder lookup', p ? 'Found on ledger' : 'No position returned'],
      ],
    })
  }
  cards.push({
    id: 'provenance',
    title: 'Ledger provenance',
    value: `${calls.length} READS`,
    subtitle: 'Validated ledger, server-side reads',
    category: 'DATA / PROVENANCE',
    lines: [
      ['Network', `${NETWORK.name}, network_id ${NETWORK.networkId}`],
      [
        'Ledger close',
        rippleToDate(clock).toISOString().slice(11, 19) + ' UTC',
      ],
      ['Vault owner', shortId(vault.Owner)],
    ],
  })

  return {
    id: String(vault.index ?? id).toUpperCase(),
    network: NETWORK.name,
    networkId: NETWORK.networkId,
    explorer: NETWORK.explorer,
    name: view.meta.name ?? (closed ? 'Fixed-term lending fund' : 'Open-ended vault'),
    asset: ticker,
    owner: String(vault.Owner),
    phase,
    clock,
    ledgerTime: rippleToDate(clock).toISOString(),
    nextSeconds: boundary ? Math.max(0, boundary.at - clock) : null,
    nextLabel: boundary?.label ?? null,
    subscription: date(vault.SubscriptionDate),
    redemption: date(vault.RedemptionDate),
    termDays,
    permissioned: Boolean(Number(vault.Flags ?? 0) & 0x00010000),
    cards,
    loans,
    rules: PHASE_RULES[phase],
    position,
    signing: {
      vaultId: String(vault.index ?? id).toUpperCase(),
      assetMptId: vault.Asset?.mpt_issuance_id ?? null,
      assetTicker: ticker,
      assetScale: asset?.scale ?? 0,
      shareMptId: vault.ShareMPTID ?? null,
      domainId: vault.DomainID ?? view.shares?.DomainID ?? null,
      acceptsDeposits: phase === 'subscription' || phase === 'open-ended',
      acceptsWithdrawals: phase !== 'investment',
    },
    calls,
  }
}
