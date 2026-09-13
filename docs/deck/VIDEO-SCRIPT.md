# Video demo, script and shot list

App only, no slides. Target 3:30, hard ceiling 4:00. Spoken lines in English, for the jury. Every
number below was read from the deployed app on 13 September 2026 at 12:05 CEST; the app reads the
ledger, so re-check them on the day.

## Before recording

| | |
|---|---|
| URL | https://patapim-gamma.vercel.app in a clean browser profile, window 1440 px wide, no extension popups |
| Wallet | Xaman on the phone, on **XRPL Devnet**, with the two demo investors imported: eligible `rM7nDFZZ…VnNC` and ineligible `rKsP5GqU…22EN`. Connection by XRPL Commons' xrpl-connect, with the single-signature fix from commit `e699d06` deployed. |
| Demo accounts | eligible holds 999,000 TBL and 1,000 Fund II shares; ineligible holds 1,000,000 TBL and no shares |
| Fund II | open for subscription until 16 September 18:00 CEST; `VaultDeposit` and `VaultWithdraw` allowed, `LoanSet` refused `tecTOO_SOON` |
| Fund I | in term until 16 September; `VaultDeposit` refused `tecEXPIRED`, `VaultWithdraw` refused `tecTOO_SOON` |
| Phone on screen | film the phone or mirror it: the slide-to-sign in Xaman is the proof that the wallet signs and the server only relays |
| Timing | after **Sign VaultDeposit in Xaman**, the panel reads "Waiting for Xaman", then "Submitting", then "Waiting for a validated ledger": 10 to 20 seconds including the phone. Keep rolling, the wait is the point. |
| Fallback | if Devnet is slow, the outcome link opens the explorer page of the same transaction; hashes from the last rehearsal are in `docs/evidence/fund-offering.json` |
| Sound | record the voice separately if the room is noisy; the on-screen text is enough to follow without sound |

## Shot list

### 0:00 · Landing (15 s)

**Do.** Open the URL. Let the loader run ("PATAPIM · ASSETS IN MOTION") or press **SKIP INTRO**.
Hold on the headline "Good assets. Put to work." Click **Open app**.

**Say.** "Tokenised treasuries are arriving on the XRP Ledger, and a holder can only sit on them.
patapim is agency securities lending, native on the ledger: holders lend a tokenised security through
a lending agent who puts first-loss capital on the line. No smart contract. Everything you are about
to see is a native XRPL object, read from the validated ledger."

### 0:15 · Fund I, the fund in its term (35 s)

**Do.** The vault page opens on Fund I. Point at the header: `XRPL DEVNET / VAULT B5EC8B2C…4730`,
the clock reading **VALIDATED LEDGER** with the ledger close time and **INVESTMENT**. Click
**Refresh ledger** once so the time ticks. Then open three cards, closing each with the X:

1. **Fund assets** 5,000,000 TBL: available liquidity 3,000,000, lent out 2,000,000.
2. **NAV per share** 1.000000: read the note, exit NAV is `(AssetsTotal − LossUnrealized) / shares`.
3. **First-loss capital** 2,500,000 TBL, posted by the agent, and **Borrower collateral**
   2,014,500 USDX in a token escrow to the agent.

**Say.** "This is Fund I, a closed-ended Single Asset Vault whose asset is the security itself, a
demo T-bill called TBL. The clock is the ledger's, not the browser's: the phase is judged against the
vault's own dates at ledger close. Five million on deposit, two million lent out. The lending agent
posted two and a half million of first-loss capital in the same security, and the borrower posted cash
collateral at a hundred and two percent of market value, priced by an on-ledger oracle."

### 0:50 · Loans, the loan of securities (30 s)

**Do.** Click the **Loans** tab. One row: borrower `rnLnMVxh…43cE`, status **current**. Point at
principal 2,000,000, lending fee 25.0 bps p.a., total owed at return 2,000,035, interest to lenders 32,
returns 15 September 10:00 UTC, grace period 1d 00h, collateral 2,014,500.00 USDX, margin 102.0%.

**Say.** "One term loan, two million TBL to a market maker, at twenty-five basis points a year, the
way securities lending quotes it. It was originated with a single LoanSet carrying two signatures: the
agent signs, the borrower counter-signs. The lenders keep ninety percent of the fee, the agent a tenth.
One day of grace before the agent can declare default, the settlement cycle of a returned Treasury."

### 1:20 · Rules, the calendar is a protocol rule (20 s)

**Do.** Click the **Rules** tab. Left: `LoanSet`, `LoanPay`, `LoanManage` **ALLOWED**. Right:
`VaultDeposit` **tecEXPIRED**, `VaultWithdraw` **tecTOO_SOON**.

**Say.** "In the investment period the ledger itself refuses a late subscription and an early
redemption. These are not app rules. Sign one and the ledger answers with the code you see here."

### 1:40 · Fund II, open for subscription (15 s)

**Do.** Click the header button **CHANGE VAULT / HOLDER**, then **Fund II · Open for subscription**.
The heading reads Fund II, phase **SUBSCRIPTION**. Show the **Subscription capacity** card,
16,999,000 TBL still open. Click **Rules**: `VaultDeposit` and `VaultWithdraw` allowed, `LoanSet`
**tecTOO_SOON**.

**Say.** "Fund II is in its subscription period until Tuesday. Deposits are open, lending is not yet:
the ledger refuses a LoanSet until the investment period starts."

### 1:55 · Sign with Xaman, eligibility the ledger enforces (75 s)

**Do.** Click the **Sign** tab, then **Connect wallet**. The xrpl-connect modal opens with Xaman
first. Scan the QR code with the phone.

1. In Xaman, approve the sign-in with the **ineligible** account. The panel shows Wallet **Xaman**,
   Account `rKsP5GqU…22EN`, TBL held 1,000,000, fund shares held 0. Leave **Subscribe
   `VaultDeposit`** selected, amount **1000**. Read the footnote: "This fund is private…". Click
   **Sign VaultDeposit in Xaman**. Show the phone: the VaultDeposit payload, slide to sign. Back on
   screen, result in red: **tecNO_AUTH**, "Refused by the ledger: this account holds no credential
   accepted by the fund's permissioned domain." Click the explorer link, show the same `tecNO_AUTH`
   on devnet.xrpl.org, come back.
2. **Disconnect**, then **Connect wallet** again and approve the sign-in with the **eligible**
   account. `rM7nDFZZ…VnNC`, TBL held 999,000, shares 1,000. Same amount, **Sign VaultDeposit in
   Xaman**, slide to sign on the phone. Result in green: **tesSUCCESS**, "Accepted. The fund minted
   shares to this account." Shares held now read 2,000.
3. Click the **Vault** tab: a new card, **Your position**, and **Fund assets** now 3,002,000.

**Say.** "Two investors, both in the same Xaman wallet. Both hold the security, both were authorised
by the transfer agent. Only one carries the credential the fund's permissioned domain accepts. The
wallet signs on the phone; only the signed transaction reaches our server, which relays it to Devnet
and reads the result from a validated ledger. The account without a credential: refused, tecNO_AUTH,
by the ledger, not by us. The account with the credential: accepted, shares minted, and the position
reads back from the vault. Holding the security is not enough to lend it: the share issuance carries
the domain, so eligibility is enforced on the fund position itself."

### 3:10 · Provenance (15 s)

**Do.** On the **Vault** tab, click **Ledger provenance**, 7 READS. Expand one or two of the
requests, for example "the reference price, on the Price Oracle the vault Data names".

**Say.** "Every figure on this page comes from these calls, server-side, against a validated ledger:
the vault, its shares, the loan broker, the loans, the oracle price, the collateral escrows. Nothing is
cached, nothing is asserted."

### 3:25 · Close (15 s)

**Do.** Stay on the Vault tab of Fund II, or return to Fund I's loan book.

**Say.** "Building this on the mandated SDK surfaced three things worth fixing, from the counterparty
signature the beta gets wrong to the recall right a fixed-term fund is missing. They are in the
developer report at the root of the repository, each with a hash, a file or a pull request, and one
contribution is already open on the XRPL Explorer. Every transaction you saw, and seventy-six more,
is linked and re-verified against the ledger in the repository. patapim."

## If something goes wrong on camera

| Symptom | Do |
|---|---|
| Xaman connects on the wrong network | the panel says "Xaman is on Mainnet. Switch it to XRPL Devnet and reconnect": switch in Xaman's settings, **Disconnect**, reconnect |
| "Xaman returned unexpected multi-signing account data" | the deployed app predates commit `e699d06`; redeploy, or record on http://localhost:3000 with `npm run dev` |
| **STALE SNAPSHOT** in the header, or "Refresh failed" | click **Retry ledger**; Devnet hiccups clear in seconds |
| "No validated result after 40 seconds" | open the explorer link in the outcome; the transaction is there, the poll timed out |
| `tefPAST_SEQ` or `tefMAX_LEDGER` | sign again, the panel says so |
| `tecINSUFFICIENT_FUNDS` on the eligible account | someone moved its TBL; re-provision with `node scripts/standing.mjs` and update `web/lib/config.ts` and `docs/DEMO-ACCOUNTS.md` |
| the eligible account is refused `tecNO_AUTH` | its credential was deleted; same re-provision |
