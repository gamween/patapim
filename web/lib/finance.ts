/**
 * Lending metrics, each defined the way the market it comes from defines it. Pure functions over
 * ledger fields, so every figure on the dashboard can be recomputed by hand from `ledger_entry`.
 * Sources and quotes: docs/research/lending-conventions.md.
 */

type Json = Record<string, any>

/** XRPL rates are in tenths of a basis point: 10 = 1 bp, 1000 = 1%, 100000 = 100%. */
export const tenthBpsToBps = (v: number) => v / 10
export const tenthBpsToFraction = (v: number) => v / 100000

/** rippled LendingHelpers.h kSecondsInYear: interest is an annual rate prorated over 365 days. */
export const SECONDS_IN_YEAR = 365 * 24 * 60 * 60

/**
 * Exit NAV per share: what the ledger redeems a share against. XLS-65 exchange algorithm and
 * xrpl.org "Exchange Algorithm": (AssetsTotal - LossUnrealized) / SharesTotal. Maple v2 calls the
 * same quantity the exit price, convertToExitAssets.
 */
export const exitNavPerShare = (assetsTotal: number, lossUnrealized: number, shares: number) =>
  shares > 0 ? (assetsTotal - lossUnrealized) / shares : null

/** Entry price per share: the deposit exchange rate, AssetsTotal / SharesTotal (XLS-65). */
export const entryPricePerShare = (assetsTotal: number, shares: number) =>
  shares > 0 ? assetsTotal / shares : null

/**
 * Utilisation, Aave's definition: borrowed over total. Under cash-basis accounting, which every
 * vault created under LendingProtocolV1_1 uses, AssetsTotal - AssetsAvailable is principal lent out.
 */
export const utilisation = (assetsTotal: number, assetsAvailable: number) =>
  assetsTotal > 0 ? Math.min(1, Math.max(0, (assetsTotal - assetsAvailable) / assetsTotal)) : null

/** Principal-weighted lending fee across the loan book, annualised, in basis points. */
export function weightedLendingFeeBps(loans: Json[]): number | null {
  let weight = 0
  let sum = 0
  for (const l of loans) {
    const p = Number(l.PrincipalOutstanding ?? 0)
    if (p <= 0) continue
    weight += p
    sum += p * tenthBpsToBps(Number(l.InterestRate ?? 0))
  }
  return weight > 0 ? sum / weight : null
}

/**
 * The lenders' annualised return from lending, on the whole fund: fee x utilisation x (1 - fee
 * split). It is Aave's supply rate, borrow rate x U x (1 - reserve factor), with the agent's
 * ManagementFeeRate in the reserve factor's place.
 */
export const netLendingReturnBps = (feeBps: number | null, util: number | null, managementFeeRate: number) =>
  feeBps === null || util === null ? null : feeBps * util * (1 - tenthBpsToFraction(managementFeeRate))

/**
 * Interest the lenders receive when a loan is repaid as scheduled: what is owed beyond principal,
 * less the agent's management fee. Cash basis: it enters AssetsTotal only when paid.
 */
export const interestToLenders = (loan: Json) =>
  Math.max(0, Number(loan.TotalValueOutstanding ?? 0) - Number(loan.PrincipalOutstanding ?? 0) - Number(loan.ManagementFeeOutstanding ?? 0))

/**
 * What the agent's first-loss capital pays the vault if the whole book defaults. LoanManage.cpp:
 * min(DebtTotal x CoverRateMinimum x CoverRateLiquidation, DefaultAmount), then capped by
 * CoverAvailable. Under cash basis DefaultAmount is the principal outstanding.
 */
export function coverAtDefault(broker: Json, principalOutstanding: number) {
  const debt = Number(broker.DebtTotal ?? 0)
  const minimum = debt * tenthBpsToFraction(Number(broker.CoverRateMinimum ?? 0))
  const liquidated = minimum * tenthBpsToFraction(Number(broker.CoverRateLiquidation ?? 0))
  const covered = Math.min(liquidated, principalOutstanding, Number(broker.CoverAvailable ?? 0))
  return { covered, share: principalOutstanding > 0 ? covered / principalOutstanding : null }
}

/** First-loss coverage, the junior tranche over the senior exposure: CoverAvailable / DebtTotal. */
export const firstLossCoverage = (broker: Json) => {
  const debt = Number(broker.DebtTotal ?? 0)
  return debt > 0 ? Number(broker.CoverAvailable ?? 0) / debt : null
}

/**
 * Collateral margin, securities lending's convention: collateral value over the market value of
 * the securities lent, customarily 102% for same-currency collateral.
 */
export const collateralMargin = (collateralValue: number, principal: number, price: number) =>
  principal > 0 && price > 0 ? collateralValue / (principal * price) : null

/** A Price Oracle AssetPrice is an unsigned integer, hex encoded on the ledger entry, with a Scale. */
export function oraclePrice(priceData: Json | undefined): number | null {
  if (!priceData || priceData.AssetPrice === undefined) return null
  const raw = typeof priceData.AssetPrice === 'number' ? priceData.AssetPrice : parseInt(String(priceData.AssetPrice), 16)
  return Number.isFinite(raw) ? raw / 10 ** Number(priceData.Scale ?? 0) : null
}

/** "2d 14h", "3h 05m", "42s": a countdown a person reads, from seconds. */
export function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${s}s`
}
