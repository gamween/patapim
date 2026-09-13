# patapim: finance and DeFi conventions, with sources (researched 2026-09-12)

Fetch method: WebFetch unless noted. [dl] = the page was downloaded (WebFetch saved the PDF, or curl/gh api for a large file) and the quote was checked against the extracted text.

## XRPL: verified parameter units (these limit everything below)

- **ManagementFeeRate** (LoanBrokerSet): unit 1/10 bp, range 0-10000 = 0-10%. https://xrpl.org/docs/references/protocol/transactions/types/loanbrokerset : "The 1/10th basis point fee charged by the lending protocol owner against any loan interest." / "0 to 10000 (inclusive), representing 0% to 10%." rippled `kMaxManagementFeeRate` agrees.
- **CoverRateMinimum**: 0-100000 (0-100%). Same page: "The 1/10th basis point DebtTotal that the first-loss capital must cover." LoanSet fails with tecINSUFFICIENT_FUNDS when CoverAvailable < DebtTotal x CoverRateMinimum (rippled LoanSet.cpp [dl]).
- **CoverRateLiquidation**: 0-100000. "The 1/10th basis point of minimum required first-loss capital that is moved to an asset vault to cover a loan default."
- **InterestRate** (LoanSet): https://xrpl.org/docs/references/protocol/transactions/types/loanset : "The annualized interest rate of the loan, in units of 1/10th basis points." Range 0-100000. 15 bp = 150.
- **PaymentInterval**: "The number of seconds between loan payments". **GracePeriod**: "The number of seconds after the loan's payment due date when it can be defaulted".
- **How interest accrues**: the concept page https://xrpl.org/docs/concepts/tokens/lending-protocol does NOT give the formula (checked: its "Interest Rates" section only names the three rates). Source is the XLS-66 spec https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0066-lending-protocol/README.md [dl, WebFetch truncated the 163 KB file]: `periodicRate = interestRate x paymentInterval / secondsPerYear`, "`secondsPerYear` = 31,536,000 (365 x 24 x 60 x 60)". Payments are level amortizing (annuity formula); interest per period = PrincipalOutstanding x periodicRate; interest on early payoff is prorated by seconds since the last payment. rippled: `kSecondsInYear = 365 * 24 * 60 * 60`. In short: simple proration of an annual rate over a 365-day year, compounded at each payment.
- **Fees and cover** (concept page): "Management Fee: This is a percentage of interest charged by the loan broker. Vault depositors pay this fee." `DefaultCovered = min((DebtTotal x CoverRateMinimum) x CoverRateLiquidation, DefaultAmount)`; the spec also caps it by CoverAvailable. Impairment: "Allows the loan broker to register a 'paper loss' with the vault."
- **XLS-66 loans have no collateral**: spec: "issuing uncollateralized, fixed-term loans using pooled funds".
- **Accounting basis (rippled develop, LendingHelpers.cpp [dl])**: vaults created after LendingProtocolV1_1 are `CashBasis`. The project's research docs say V1_1 is enabled on both hackathon networks. Under CashBasis, AssetsTotal does not change when a loan is made, it rises by `interestPaid` on each payment, and "DefaultAmount = Loan.PrincipalOutstanding". Legacy vaults instead book all scheduled interest into AssetsTotal when the loan is made.
- **Exchange rate (XLS-65 spec)** https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0065-single-asset-vault/README.md [dl]: `exchangeRate = (AssetsTotal - LossUnrealized) / SharesTotal`. The spec also says: "the Vault must use two different exchange rate models: one for depositing assets and one for withdrawing them."
- rippled `VaultPhase` enum: `Subscription, Investment, Redemption`.

## A. Agency securities lending

### A1. Borrower default indemnification
- Convention: the agent lender guarantees the lender against the shortfall when the collateral is not enough to buy back securities the borrower fails to return. The agent pays from its own balance sheet, with no cap.
- OFR Working Paper 16-08, authors from OFR, Fed Board, NY Fed and SEC. https://www.financialresearch.gov/working-papers/files/OFRwp-2016-08_Pilot-Survey-of-Securities-Lending.pdf [dl]: "indemnifying lenders against the risk that the value of the pledged collateral will be insufficient to repurchase the loaned security". Table 11: 93-100% of loans are indemnified.
- BlackRock iShares SAI (Dec 30 2025) https://www.ishares.com/us/literature/sai/sai-ishares-inc-eo-8-31.pdf [dl]: "BlackRock indemnifies the Funds and certain other clients and/ or funds against a shortfall in collateral in the event of borrower default."
- BMO Harris agency agreement on SEC EDGAR https://www.sec.gov/Archives/edgar/data/1318342/000139834419005692/fp0040640_ex9928h5.htm , s.7: "Lending Agent shall at its expense (i) within two (2) business days after the expiration of the Recall Period, replace the loaned securities"
- patapim: do not call CoverAvailable "indemnification". XLS-66 cover is capped, and the loan has no collateral. Call it "agent first-loss capital". Say "full indemnity" only if CoverRateMinimum = CoverRateLiquidation = 100000. LoanSet then forces CoverAvailable >= DebtTotal, and under CashBasis DefaultAmount = principal, so a default is fully covered.

### A2. Fee split
- Convention: the lender keeps most of the revenue. Published splits run from 50/50 up to about 90/10.
- Callan (consultant, secondary source) https://www.callan.com/blog-archive/securities-lending-101/ : "ranging from 50%/50% for smaller programs to 90% for the lender with larger programs."
- iShares SAI [dl]: "retain 82% of securities lending income (which excludes collateral investment fees)". This rises to 85% above set thresholds, with a floor of 70%.
- BMO/Zacks s.2 (SEC): "a fee for each loan equal to 60% (the remaining 40% shall be retained by Lending Agent)"
- OFR: "it is common for the lender to retain most of it." eSecLending [dl]: "the agent will typically be paid a minority share of the gross revenue earned from the loan"
- patapim: ManagementFeeRate cannot go above 10%. The biggest agent share you can set is therefore 90/10 (lender/agent), the lender-friendly end of the range. 80/20 and 82/18 cannot be set. Use ManagementFeeRate = 10000 and label it "Fee split 90/10 (beneficial owner / lending agent), on loan interest".

### A3. Collateral margins
- Convention: 102% for same-currency collateral, 105% for cross-currency, marked to market daily. Collateral can be cash or non-cash.
- OFR: "prevailing market practices for margin on securities lending activity, which generally range from 102 percent to 105 percent." US Treasury loans: mean 102%, 5th-95th percentile 100-105%. Collateral "can be cash, securities, or another form of financial commitment such as a letter of credit."
- eSecLending best practices [dl] https://www.eseclending.com/wp-content/themes/klasik-child/pdfs/eSecLending_Securities_Lending_Best_Practices.pdf : "The typical market practice for the collateral value is 102% (same currency) or 105% (different currency) of the value of the lent security." The margin levels are also "marked-to-market,” or valued, on a daily basis".
- BMO s.6(a): "102% of the market value of domestic U.S. loaned securities, (ii) 105% of the market value of foreign loaned securities"; s.6(b) marks to market "on a daily basis".
- ISLA/GMSLA: not verified. islaemea.org failed with a TLS certificate error, and islagroup.org returned HTTP 500.
- patapim: XLS-66 has no collateral. Show "102% collateral, daily mark-to-market" only if a real off-ledger collateral leg exists. Posting the cover in the same T-bill removes the asset mismatch that the 2-5% margin exists for. Still, first-loss cover is agent capital, not borrower collateral.

### A4. Terminology and fee levels
- OFR: "the lender that owns the securities, the securities borrower, and a lending agent". eSecLending: "The beneficial owner (lender) temporarily transfers title of the security".
- Rebate rate (OFR): "When collateral for a security loan is in the form of cash, the security lender pays a rebate rate to the borrower." With non-cash collateral, "the borrower pays the lender a fee."
- Recall (eSecLending): "Most securities lending transactions are “on open” or callable (i.e. they can be recalled at any time)". Term loans (same source): "lend securities for a defined term, which generally means that securities cannot be recalled." Return cycle (BMO s.5): "not be later than the second business day (but, in the case of Government Securities, the first business day)".
- GC vs specials. eSecLending: "known as general collateral (GC) securities" vs "hard to borrow, known as specials", which earn "between 100 bps to 6,000 bps". NY Fed https://www.newyorkfed.org/markets/treasury-repo-reference-rates-information : "the specific securities are said to be trading "special"".
- Treasury fee levels. OFR Table 8: US Treasury/Agency mean lending fee 0.13-0.20% (13-20 bp), 95th percentile 0.31-0.60%, "annualized using a 360-day count convention". NY Fed SOMA https://www.newyorkfed.org/markets/sec_faq : "The minimum bid rate is 5 basis points." It is "calculated on an actual over 360 basis."
- patapim: use "beneficial owner", "lending agent", "borrower", "lending fee (bp p.a.)". The Investment phase is a "term loan (no recall)". A T-bill is GC, so use a 5-20 bp fee (InterestRate 50-200). XRPL uses a 365-day year, so 15 bp act/360 is about 15.2 bp act/365. Avoid "rebate": there is no cash collateral.

## B. DeFi lending

### B1. Aave v3
- Glossary https://aave.com/docs/resources/glossary , Utilization Rate: "A metric that determines the proportion of borrowed assets to the total available assets in a reserve." Reserve Factor: "A percentage of interest accrued by borrowers that is allocated to the Aave Treasury".
- Code https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/pool/DefaultReserveInterestRateStrategy.sol : `borrowUsageRatio = totalDebt.rayDiv(availableLiquidityPlusDebt)` and `currentLiquidityRate = overallBorrowRate.rayMul(supplyUsageRatio).percentMul(PERCENTAGE_FACTOR - reserveFactor)`. So supply rate = borrow rate x U x (1 - RF). The docs page itself does not show the formula. The old docs.aave.com risk page now returns 404.
- patapim: ManagementFeeRate plays the role of the reserve factor. Lender yield ~= InterestRate x utilisation x (1 - ManagementFeeRate). On a CashBasis vault, AssetsTotal - AssetsAvailable = principal outstanding, so your utilisation formula matches Aave's debt / (liquidity + debt).

### B2. Maple v2
- Defaults https://docs.maple.finance/technical-resources/loans/defaults.md : `maxCoverLiquidationPercent` "defines the maximum percentage of pool cover used when covering for losses." and "All liquidated collateral and cover first goes towards recovering fees owed to the protocol".
- Code https://github.com/maple-labs/pool-v2/blob/main/contracts/MaplePoolManager.sol : `availableCover_ = balanceOf(poolDelegateCover) * maxCoverLiquidationPercent / HUNDRED_PERCENT`.
- Impairments https://docs.maple.finance/technical-resources/loans/impairments.md : "A 'paper loss' (`unrealizedLoss`)"; "`unrealizedLosses` is factored into the Pool's value for withdrawals".
- Lenders page https://docs.maple.finance/maple-institutional-for-lenders/defaults-and-impairments.md : "When a loan is impaired, its value is temporarily reduced." "Defaults can be executed by Maple when a borrower has not made a payment past the grace period"
- MaplePool.sol https://github.com/maple-labs/pool-v2/blob/main/contracts/MaplePool.sol : `convertToExitAssets = shares * (totalAssets() - unrealizedLosses()) / totalSupply`, while `convertToAssets` uses only totalAssets().
- Fees https://docs.maple.finance/technical-resources/protocol-overview/fees.md : "managementFee = grossInterest x managementFeeRate". Open-term loan manager page: "If the PoolDelegate does not provide enough cover, the `delegateManagementFee` is instead not deducted".
- patapim: follow the Maple/XRPL chain "impairment (paper loss) -> default -> first-loss cover". Your NAV formula is Maple's exit price, so label it "Exit NAV per share". Maple caps cover at a % of the cover balance. XLS-66 caps it at a % of the minimum required cover.

### B3. Goldfinch (Centrifuge docs returned HTTP 403)
- https://docs.goldfinch.finance/goldfinch/goldfinch-v1/protocol-mechanics/backers : "decide if they want to supply first-loss capital (junior tranche) to fund a Borrower Pool." Also: "20% of the senior tranche's nominal interest is reallocated to the junior tranche."
- patapim: agent cover = junior / first-loss tranche; vault depositors = senior. A useful metric: "first-loss coverage = CoverAvailable / DebtTotal".

### B4. ERC-4626 (Final) and ERC-7540 (Final)
- https://eips.ethereum.org/EIPS/eip-4626 , convertToAssets: "The amount of assets that the Vault would exchange for the amount of shares provided, in an ideal scenario". It "MUST NOT be inclusive of any fees" and should reflect "the 'average-user's' price-per-share". previewRedeem: "as close to and no more than the exact amount of assets that would be withdrawn in a `redeem` call".
- https://eips.ethereum.org/EIPS/eip-7540 : intended for "real-world asset protocols, undercollateralized lending protocols". Pending = "the state where a Request has been made but is not yet Claimable". In async redemption vaults, "previewRedeem and previewWithdraw MUST revert for all callers and inputs".
- patapim: "share price" / "assets per share" is valid ERC-4626 wording. Show an entry price (AssetsTotal/SharesTotal) and an exit price (minus LossUnrealized), following XLS-65 and Maple. ERC-7540 "Pending -> Claimable" is an analogy for Investment -> Redemption. XLS-65 has no request objects, so do not claim ERC-7540 compliance.

## C. Fund conventions

### C1. Closed-end / term lifecycle; NAV per share
- SEC "Mutual Funds and ETFs" guide [dl] https://www.sec.gov/investor/pubs/sec-guide-to-mutual-funds.pdf : "closed-end funds—which sell a fixed number of shares at one time (in an initial public offering)". UITs "terminate and dissolve on a date that is specified at the time the UIT is created." NAV: "the per-share value of the mutual fund’s assets minus its liabilities—is called the NAV or net asset value."
- ICI https://www.ici.org/cef/background/bro_g2_ce : NAV is "subtracting the fund's liabilities (e.g., fund borrowing) from the current market value of its assets and dividing by the total number of shares outstanding".
- ILPA https://ilpa.org/glossary/commitment-period/ : "The period of time within which the fund can make investments as established in the LPA for the fund."
- EU ELTIF Reg. 2015/760 https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32015R0760 : Art. 18 says investors "shall not be able to request the redemption of their units or shares before the end of the life of the ELTIF". Art. 30(6) uses "during the subscription period".
- US term closed-end fund (Calamos 497) https://www.sec.gov/Archives/edgar/data/1602584/000119312515109273/d770155d497.htm : "The Fund will terminate on the fifteenth anniversary". "The final distribution of net assets upon termination may be more than, equal to or less than $25 per common share."
- investor.gov glossary: HTTP 403, not fetched. The SEC and ICI pages above were used instead.
- patapim: keep "Subscription period" (ELTIF), "Investment period" (ILPA; "commitment period" is the synonym) and "Redemption", with "end of life / termination date" = RedemptionDate. Keep "Maturity" for the T-bill and loans. "NAV per share" = (AssetsTotal - LossUnrealized)/SharesTotal. Note that this counts the impairment as a write-down of assets.

### C2. Money market / stable vs floating NAV
- SEC guide: "Government and retail money market funds try to keep their NAV at a stable $1.00 per share, but the NAV may fall below $1.00". Also "Other money market funds, however, have a floating NAV".
- patapim: the vault has a floating NAV, counted in T-bill units, not USD. Never show "$1.00 stable NAV".
