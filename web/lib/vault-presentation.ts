import { NETWORK } from './config'
import {
  readVault,
  readPosition,
  loanStatus,
  PHASE_RULES,
  rippleToDate,
  shortId,
  vaultData,
} from './ledger'
import type { LedgerCard, VaultSnapshot } from './vault-ui'

const number = (v: number | null, digits = 0) =>
  v === null || !Number.isFinite(v)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v)
const date = (v: number | undefined) =>
  v ? rippleToDate(v).toISOString() : null

/** Adapt the existing reader, calculations and status logic without replacing them. */
export async function presentVault(
  id: string,
  holder?: string,
): Promise<VaultSnapshot> {
  const view = await readVault(id)
  const { vault, broker, phase, clock } = view
  const calls = [...view.calls]
  const meta = vaultData(vault.Data)
  const closed = vault.VaultKind === 1
  const boundary = closed
    ? phase === 'subscription'
      ? vault.SubscriptionDate
      : phase === 'investment'
        ? vault.RedemptionDate
        : null
    : null
  const loans = view.loans.map((l) => ({
    id: String(l.index),
    borrower: String(l.Borrower ?? ''),
    principal: number(Number(l.PrincipalOutstanding ?? 0)),
    owed: number(Number(l.TotalValueOutstanding ?? 0)),
    payments: String(l.PaymentRemaining ?? '—'),
    due: date(l.NextPaymentDueDate) ?? '—',
    status: loanStatus(l, clock),
  }))
  const asset = vault.Asset?.mpt_issuance_id
    ? `MPT ${shortId(vault.Asset.mpt_issuance_id, 8)}`
    : (vault.Asset?.currency ?? 'Unknown asset')
  const cards: LedgerCard[] = [
    {
      id: 'assets',
      title: 'Vault assets',
      value: number(view.assetsTotal),
      subtitle: asset,
      category: 'VAULT / CAPITAL',
      tone: 'green',
      lines: [
        ['Available liquidity', number(view.assetsAvailable)],
        ['Net asset value', number(view.nav)],
        ['Unrealised loss', number(view.lossUnrealized)],
      ],
    },
    {
      id: 'price',
      title: 'Price per share',
      value: number(view.pricePerShare, 6),
      subtitle: 'Net assets / outstanding shares',
      category: 'LENDER / VALUE',
      tone: 'green',
      lines: [
        ['Net assets', number(view.nav)],
        ['Outstanding shares', number(view.sharesOutstanding)],
        ['Loss deducted', number(view.lossUnrealized)],
      ],
    },
    {
      id: 'phase',
      title: 'Vault phase',
      value: phase.toUpperCase(),
      subtitle: boundary
        ? `${Math.max(0, boundary - clock)}s to next phase at ledger close`
        : closed
          ? 'Redemption window is open'
          : 'No fixed-term phase gate',
      category: 'TERM / LEDGER CLOCK',
      phaseIndex: ['subscription', 'investment', 'redemption'].indexOf(phase),
      lines: [
        [
          'Subscription closes',
          date(vault.SubscriptionDate)?.slice(11, 19) ?? '—',
        ],
        ['Redemption opens', date(vault.RedemptionDate)?.slice(11, 19) ?? '—'],
        [
          'Modelled term',
          meta.term_days ? `${meta.term_days} days` : 'Not specified',
        ],
      ],
    },
    {
      id: 'utilisation',
      title: 'Utilisation',
      value:
        view.utilisation === null
          ? '—'
          : `${number(view.utilisation * 100, 1)}%`,
      subtitle: 'Lent out / total assets',
      category: 'VAULT / ALLOCATION',
      meter: view.utilisation === null ? undefined : view.utilisation,
      lines: [
        ['Lent out', number(view.assetsTotal - view.assetsAvailable)],
        ['Available liquidity', number(view.assetsAvailable)],
        ['Total assets', number(view.assetsTotal)],
      ],
    },
    {
      id: 'loans',
      title: 'Loan book',
      value: String(loans.length),
      subtitle:
        loans.length === 1
          ? 'Loan recorded on the ledger'
          : 'Loans recorded on the ledger',
      category: 'LENDING / POSITIONS',
      lines: loans.length
        ? loans.slice(0, 3).map((l) => [shortId(l.borrower), l.status])
        : [['Loan book', 'No loans returned']],
    },
    {
      id: 'rules',
      title: 'Ledger rules',
      value: `${PHASE_RULES[phase].allowed.length} ALLOWED`,
      subtitle: `${PHASE_RULES[phase].blocked.length} phase restrictions in ${phase}`,
      category: 'PROTOCOL / PERMISSIONS',
      tone: 'green',
      lines: PHASE_RULES[phase].blocked.length
        ? PHASE_RULES[phase].blocked
        : [['Phase gate', 'No restrictions']],
    },
  ]
  if (broker) {
    cards.push(
      {
        id: 'cover',
        title: 'Agent cover',
        value: number(Number(broker.CoverAvailable ?? 0)),
        subtitle: 'First-loss capital in the same security',
        category: 'AGENT / INDEMNITY',
        tone: 'green',
        lines: [
          [
            'Cover rate',
            `${number(Number(broker.CoverRateMinimum ?? 0) / 1000, 1)}%`,
          ],
          ['Debt outstanding', number(Number(broker.DebtTotal ?? 0))],
          ['Debt ceiling', number(Number(broker.DebtMaximum ?? 0))],
        ],
      },
      {
        id: 'debt',
        title: 'Debt outstanding',
        value: number(Number(broker.DebtTotal ?? 0)),
        subtitle: 'Loan broker obligations',
        category: 'AGENT / LOAN BROKER',
        lines: [
          ['Debt ceiling', number(Number(broker.DebtMaximum ?? 0))],
          ['Cover available', number(Number(broker.CoverAvailable ?? 0))],
          ['Broker', shortId(String(broker.index ?? ''))],
        ],
      },
    )
  }
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
        ['Value in securities', position.value],
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
      ['Network', NETWORK.name],
      [
        'Ledger close',
        rippleToDate(clock).toISOString().slice(11, 19) + ' UTC',
      ],
      ['Vault owner', shortId(vault.Owner)],
    ],
  })
  return {
    id,
    network: NETWORK.name,
    explorer: NETWORK.explorer,
    name: meta.n ?? (closed ? 'Fixed-term lending vault' : 'Open-ended vault'),
    asset,
    owner: String(vault.Owner),
    phase,
    clock,
    ledgerTime: rippleToDate(clock).toISOString(),
    nextSeconds: boundary ? Math.max(0, boundary - clock) : null,
    subscription: date(vault.SubscriptionDate),
    redemption: date(vault.RedemptionDate),
    termDays: meta.term_days ?? null,
    permissioned: Boolean(vault.Flags & 65536),
    cards,
    loans,
    rules: PHASE_RULES[phase],
    position,
    calls,
  }
}
