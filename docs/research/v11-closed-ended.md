# Lending Protocol V1.1 / Closed-Ended Vault — verified research notes

Slug: `v11-closed-ended`. Compiled 2026-09-12 during the XRPL Lending Protocol Hackathon (Paris).

**Method.** Every claim below is taken from one of: the merged `rippled` C++ source
(`XRPLF/rippled` @ `9403736199` / `94037361992ad75b32a6b2659b655ab96b7cb7c2`, `develop`, 2026-09-10),
the XLS specs in `XRPLF/XRPL-Standards` @ `0200ec57ec70836be04eee436a8e9e9a92e67989`,
GitHub PRs, the `xrpl` npm package source, or **live transactions submitted to the public XRPL
Devnet during this research**. Transaction hashes are given so every ledger claim is checkable.

> **Headline:** three load-bearing assumptions in the hackathon briefing are wrong.
> 1. `tfVaultDonation` **does not exist** anywhere in rippled, the XLS specs, xrpl.org or xrpl.js.
> 2. With `LendingProtocolV1_1` enabled, `LoanBrokerSet` **rejects open-ended vaults** with
>    `tecNO_PERMISSION` — verified live on public Devnet. Track 1 (open-ended + loan broker) is
>    impossible on public Devnet; it works on the hackathon Devnet because that node runs a **custom
>    fork** whose `build_version` string (`3.4.0-rc1`) does not match the public tag of that name.
> 3. `xrpl@5.2.0-beta.0`'s `signLoanSetByCounterparty` produces an **invalid signature** on both
>    Devnets (wrong hash prefix). No loan can be originated with it unpatched.

---

## 1. Amendments

Three separate amendments, all independently votable. Verified live via `feature` RPC on both
networks (2026-09-12).

| Amendment | Amendment ID | Hackathon Devnet | Public Devnet |
| --- | --- | :---: | :---: |
| `SingleAssetVault` | `81BD2619B6B3C8625AC5D0BC01DE17F06C3F0AB95C7C87C93715B87A4FD240D8` | enabled | enabled |
| `LendingProtocol` | `565B90CA1AB2B9D42208ED10884188C64F9E19083DECB9634AAF06EB03299509` | enabled | enabled |
| `LendingProtocolV1_1` | `A360E2BFD775A5B0DCE1C36C16DF31B72735A57584FD163655D2F9564F8E7AC8` | **enabled** | **enabled** |

Source declaration — `include/xrpl/protocol/detail/features.macro`:

```
XRPL_FEATURE(LendingProtocolV1_1,         Supported::Yes,  VoteBehavior::DefaultNo)   // line 25
XRPL_FEATURE(LendingProtocol,             Supported::Yes, VoteBehavior::DefaultNo)    // line 31
XRPL_FEATURE(LendingProtocolV1_2,         Supported::No,  VoteBehavior::DefaultNo)    // line 19 (future)
```

Naming history: it was originally `fixLendingProtocolV1_1` and renamed in
[rippled#6527](https://github.com/XRPLF/rippled/pull/6527) *"refactor: Rename fixLendingProtocolV1_1
to featureLendingProtocolV1_1"*. Introduced in
[rippled#6324](https://github.com/XRPLF/rippled/pull/6324), enabled by default in
[rippled#8125](https://github.com/XRPLF/rippled/pull/8125).

### 1.1 Can V1 and V1.1 coexist on one ledger? — **Yes, and they must.**

`LendingProtocolV1_1` is an *additive* amendment on top of `LendingProtocol`; both are enabled
simultaneously on both Devnets. Coexistence is **per-vault**, carried by a new `Vault.LEVersion`
field:

`include/xrpl/protocol/Protocol.h:321-330`
```cpp
/**
 * Vault ledger-entry schema versions. Assigned to newly created
 * Vaults once featureLendingProtocolV1_1 is enabled. Vaults created before
 * activation are left without LEVersion (implicit legacy version 0,
 * accrual-basis accounting).
 */
enum class VaultVersion : uint8_t {
    Legacy = 0,
    CashBasis,
};
```

`src/libxrpl/ledger/helpers/LendingHelpers.cpp:251-259`
```cpp
// Cash-basis accounting applies only when featureLendingProtocolV1_1 is
// enabled AND the specific Vault was created under it (LEVersion ==
// VaultVersion::CashBasis). Vaults created before activation keep accrual-basis
// accounting forever, even after the amendment later turns on.
bool cashBasisEnabled(SLE::const_ref vaultSle)
{ return getVaultVersion(vaultSle) == VaultVersion::CashBasis; }
```

So a single ledger can hold V1 (accrual) vaults and V1.1 (cash-basis) vaults side by side, and a
vault's accounting model is frozen at creation. **Verified live:** the two pre-existing vaults on
public Devnet carry no `LEVersion` (Legacy/accrual); every vault I created today carries
`"LEVersion": 1`.

### 1.2 Other amendments relevant to V1.1 behaviour

`fixCleanup3_4_0` is **enabled on both Devnets** and is not part of `LendingProtocolV1_1`, but it
changes two things you will hit:
- Role signatures (counterparty, sponsor) get their own hash prefixes — see §7.
- Impairment timing / exclusive due-date boundaries — spec `XLS-0066-lending-protocol/66.2/README.md`.

Full relevant amendment parity (both networks identical): `SingleAssetVault`, `LendingProtocol`,
`LendingProtocolV1_1`, `MPTokensV1`, `PermissionedDomains`, `Credentials`, `TokenEscrow`, `Sponsor`,
`BatchV1_1`, `fixCleanup3_1_3/3_2_0/3_3_0/3_4_0` all enabled. `fixCleanup3_5_0` exists but is
disabled on the hackathon Devnet and absent from public Devnet.

---

## 2. Where the V1.1 / closed-ended specification actually lives

There is **no** merged "Lending Protocol V1.1" document. What exists:

| Artifact | Location | Status |
| --- | --- | --- |
| Closed-ended vault spec | [XRPL-Standards PR #587](https://github.com/XRPLF/XRPL-Standards/pull/587), file `XLS-draft-closed-ended-vault/README.md` | **OPEN**, unmerged, `xls: TBD`, empty PR description |
| Closed-ended implementation | [rippled PR #7921](https://github.com/XRPLF/rippled/pull/7921) *"feat: Add a new closed ended vault to extend SAV"* | MERGED 2026-08-12 |
| Cash-basis implementation | [rippled PR #7817](https://github.com/XRPLF/rippled/pull/7817) *"feat: Implement LoanBroker cash-basis accounting"* | MERGED |
| Open-ended broker rejection | [rippled PR #8076](https://github.com/XRPLF/rippled/pull/8076) *"fix: Reject open-ended vaults at LoanBrokerSet"* | MERGED 2026-08-26 |
| `VaultDelete.MemoData` | [rippled PR #6324](https://github.com/XRPLF/rippled/pull/6324); spec `XLS-0065-single-asset-vault/65.1/README.md` | merged |
| Impairment timing | spec `XLS-0066-lending-protocol/66.2/README.md` (gated on `fixCleanup3_4_0`, not V1.1) | merged spec |
| Cash-basis **specification** | — | **does not exist** |

Raw text of the draft closed-ended spec used here:
`https://raw.githubusercontent.com/a1q123456/XRPL-Standards/b057622a0402651c859a4cd7a38b4c35090d9ff2/XLS-draft-closed-ended-vault/README.md`

Discussion thread cited by the draft: https://github.com/XRPLF/XRPL-Standards/discussions/590

**xrpl.org documents none of it.** A full clone of `XRPLF/xrpl-dev-portal` (559 markdown files under
`docs/`) yields **zero** matches for `VaultKind`, `SubscriptionDate`, `RedemptionDate`,
`closed-ended`, `cash-basis` or `LEVersion`. `docs/references/protocol/ledger-data/ledger-entry-types/vault.md`
and `docs/references/protocol/transactions/types/vaultcreate.md` both stop at `Scale`.

---

## 3. Closed-ended vault: exact fields

### 3.1 New fields

`include/xrpl/protocol/detail/sfields.macro`
```
TYPED_SFIELD(sfVaultKind,                UINT8,     22)   // line 30
TYPED_SFIELD(sfSubscriptionDate,         UINT32,    75)   // line 120
TYPED_SFIELD(sfRedemptionDate,           UINT32,    76)   // line 121
```

`include/xrpl/protocol/detail/ledger_entries.macro:501-523` — `ltVAULT` (`0x0084`):
```
    {sfScale,                SoeDefault},
    {sfLEVersion,            SoeDefault},
    {sfVaultKind,            SoeDefault},
    {sfSubscriptionDate,     SoeOptional},
    {sfRedemptionDate,       SoeOptional},
```

`include/xrpl/protocol/detail/transactions.macro:774-791` — `ttVAULT_CREATE` (`65`):
```
    {sfVaultKind, SoeOptional},
    {sfSubscriptionDate, SoeOptional},
    {sfRedemptionDate, SoeOptional},
```

`VaultSet` does **not** carry these fields: all three are immutable after creation.

**Time base: Ripple epoch seconds** (seconds since 2000-01-01T00:00:00Z = Unix − 946 684 800).
Confirmed by `include/xrpl/ledger/View.h:45-55` (`hasExpired` doc block) and by xrpl.js's own error
string: *"SubscriptionDate must be an integer number of seconds since the Ripple Epoch"*.

### 3.2 `VaultKind` enum — `include/xrpl/protocol/Protocol.h:332-339`
```cpp
enum class VaultKind : std::uint8_t {
    OpenEnded = 0,
    ClosedEnded = 1,
};
```
An absent **or unrecognised** `sfVaultKind` decodes to `OpenEnded`
(`VaultHelpers.cpp: decodeVaultKind`). `VaultCreate::preflight` rejects unrecognised values first
via `isValidVaultKind()` → `temMALFORMED`.

Because `sfVaultKind` is `SoeDefault`, an open-ended vault created under V1.1 stores the value `0`,
which is *not serialised*. **Verified live:** an open-ended vault I created shows
`{"LEVersion":1}` and no `VaultKind` key at all.

### 3.3 Investment-period bounds — `include/xrpl/protocol/Protocol.h:352-371`
```cpp
constexpr std::uint32_t kLoanRedemptionBuffer = std::chrono::seconds{60}.count();
constexpr std::uint32_t kMinInvestmentPeriod  = std::chrono::seconds{180}.count();
// This is 946708560 seconds which 30 x 365.2425 days (the average length of a Gregorian year).
constexpr std::uint32_t kMaxInvestmentPeriod  = std::chrono::seconds{std::chrono::years{30}}.count();
```

`VaultHelpers.cpp`
```cpp
[[nodiscard]] bool isValidClosedEndedGap(std::uint32_t sub, std::uint32_t red)
{
    auto const s = static_cast<std::int64_t>(sub);
    auto const r = static_cast<std::int64_t>(red);
    return r >= s + kMinInvestmentPeriod && r < s + kMaxInvestmentPeriod;
}
```

So: **`180 <= RedemptionDate - SubscriptionDate < 946708560`.**

> ⚠️ The draft spec (PR #587 §2.4) says `MIN_INVESTMENT_PERIOD` is **60** and
> `MAX_INVESTMENT_PERIOD` is **946080000**. Both numbers are wrong versus merged code. xrpl.js
> agrees with the code — its client-side error is verbatim:
> `VaultCreate: RedemptionDate - SubscriptionDate must be within [180, 946708560) seconds`.

---

## 4. Phase derivation

`src/libxrpl/ledger/helpers/VaultHelpers.cpp`
```cpp
[[nodiscard]] VaultPhase
getVaultPhase(ReadView const& view, std::optional<std::uint8_t> vaultKind,
              std::optional<std::uint32_t> subscriptionDate,
              std::optional<std::uint32_t> redemptionDate)
{
    if (!vaultKind || *vaultKind != std::to_underlying(VaultKind::ClosedEnded))
        return VaultPhase::NoPhase;

    // Subscription includes now == SubscriptionDate; Investment starts
    // strictly after SubscriptionDate.
    if (!hasExpired(view, subscriptionDate, ExpiryComparison::Exclusive))
        return VaultPhase::Subscription;
    if (!hasExpired(view, redemptionDate))
        return VaultPhase::Investment;
    return VaultPhase::Redemption;
}
```

`hasExpired` (`src/libxrpl/ledger/View.cpp:49-63`) compares against **`view.parentCloseTime()`**:
```cpp
return comparison == ExpiryComparison::Inclusive
    ? view.parentCloseTime() >= boundary
    : view.parentCloseTime() > boundary;
```

Let `now` = parent ledger close time (Ripple epoch seconds):

| Condition | Phase |
| --- | --- |
| `VaultKind != ClosedEnded` (incl. absent) | `NoPhase` |
| `now <= SubscriptionDate` | `Subscription` |
| `SubscriptionDate < now < RedemptionDate` | `Investment` |
| `now >= RedemptionDate` | `Redemption` |

`enum class VaultPhase : std::uint8_t { NoPhase = 0, Subscription, Investment, Redemption };`
(`Protocol.h:345-350`). The phase is **never stored** — it is recomputed every time.

Practical consequence: the phase advances on the *parent* ledger's close time, so it lags real
wall-clock by roughly one ledger interval (~3-4 s on Devnet). Poll
`ledger(ledger_index=validated).close_time` rather than local `Date.now()` when driving a demo.

---

## 5. Phase permission matrix — code, spec and ledger

| Transaction | Open-ended | Subscription | Investment | Redemption |
| --- | --- | --- | --- | --- |
| `VaultDeposit` | allowed | allowed | **`tecEXPIRED`** | **`tecEXPIRED`** |
| `VaultWithdraw` | allowed | allowed | **`tecTOO_SOON`** | allowed |
| `LoanSet` | allowed¹ | **`tecTOO_SOON`** | allowed² | **`tecEXPIRED`** |
| `VaultClawback`, `LoanPay`, `LoanManage`, `LoanDelete`, `VaultDelete` | allowed | allowed | allowed | allowed |

¹ but `LoanBrokerSet` cannot create a broker on an open-ended vault under V1.1 — see §6.
² plus the redemption-buffer constraint below.

### 5.1 `VaultDeposit` — `src/libxrpl/tx/transactors/vault/VaultDeposit.cpp:110-119`
```cpp
if (ctx.view.rules().enabled(featureLendingProtocolV1_1))
{
    auto const phase = getVaultPhase(ctx.view, vault);
    if (phase == VaultPhase::Investment || phase == VaultPhase::Redemption)
    {
        JLOG(ctx.j.debug()) << "VaultDeposit: vault deposit is not allowed in the investment "
                               "or redemption phase.";
        return tecEXPIRED;
    }
}
```
> ⚠️ rippled PR #7921's own description says this returns `tecNO_PERMISSION`. The merged code
> returns **`tecEXPIRED`**. The draft spec §5.2 says `tecEXPIRED` and is correct.

### 5.2 `VaultWithdraw` — `src/libxrpl/tx/transactors/vault/VaultWithdraw.cpp:90-98`
```cpp
if (ctx.view.rules().enabled(featureLendingProtocolV1_1))
{
    if (getVaultPhase(ctx.view, vault) == VaultPhase::Investment)
    {
        JLOG(ctx.j.debug())
            << "VaultWithdraw: vault withdrawal is not allowed in the investment phase.";
        return tecTOO_SOON;
    }
}
```

### 5.3 `LoanSet` — `src/libxrpl/tx/transactors/lending/LoanSet.cpp:319-344`
```cpp
if (ctx.view.rules().enabled(featureLendingProtocolV1_1))
{
    auto const phase = getVaultPhase(ctx.view, vault);
    if (phase == VaultPhase::Subscription)
    {
        JLOG(ctx.j.warn()) << "Vault is still in the subscription phase.";
        return tecTOO_SOON;
    }
    if (phase == VaultPhase::Redemption)
    {
        JLOG(ctx.j.warn()) << "Vault has entered the redemption phase.";
        return tecEXPIRED;
    }
    if (phase == VaultPhase::Investment)
    {
        auto const finalPayment =
            std::uint64_t{getStartDate(ctx.view)} + (std::uint64_t{interval} * total);
        if (finalPayment + kLoanRedemptionBuffer > vault->at(sfRedemptionDate))
        {
            JLOG(ctx.j.warn())
                << "Final loan payment date is fewer than " << kLoanRedemptionBuffer
                << " seconds before the vault's redemption date.";
            return tecNO_PERMISSION;
        }
    }
}
```

### 5.4 The "final payment before RedemptionDate" rule — enforced on chain, with a 60 s buffer

The actual on-ledger predicate is **not** "strictly before". It is:

```
StartDate + (PaymentInterval * PaymentTotal) + 60  <=  RedemptionDate
```

where `StartDate` comes from `LoanSet.cpp:225-229`:
```cpp
static std::uint32_t getStartDate(ReadView const& view)
{ return view.header().closeTime.time_since_epoch().count(); }
```

Violation → **`tecNO_PERMISSION`**. Enforced in `LoanSet::preclaim` *and* re-asserted by the
`LoanInvariant`/`ValidVault` invariants (`src/libxrpl/tx/invariants/VaultInvariant.cpp:325-344`:
*"Invariant failed: loan origination only allowed in Investment phase"*).

Static assertion tying the constants together (`LoanSet.cpp:43-47`):
```cpp
// StartDate is strictly after SubscriptionDate. A min-gap vault must still
// fit a minimum-interval loan plus kLoanRedemptionBuffer. The interval and
// buffer constants are independent; only their sum (plus the +1 for a
// strictly-later StartDate) is required to fit in kMinInvestmentPeriod.
static_assert(kMinInvestmentPeriod >= LoanSet::kMinPaymentInterval + kLoanRedemptionBuffer + 1);
```
with `kMinPaymentInterval = 60`, `kDefaultPaymentInterval = 60`, `kMinPaymentTotal = 1`,
`kDefaultPaymentTotal = 1`, `kDefaultGracePeriod = 60` (`include/xrpl/tx/transactors/lending/LoanSet.h:64-73`).

> ⚠️ The draft spec §7.2.1.3 states only *"If `startDate + (paymentInterval × paymentTotal)` is not
> strictly before `RedemptionDate`, return `tecNO_PERMISSION`"* — it never mentions
> `kLoanRedemptionBuffer`. A schedule ending 30 s before `RedemptionDate` satisfies the spec and is
> rejected by the ledger.

> ⚠️ Clock mismatch: phase derivation uses `view.parentCloseTime()`, while `getStartDate` uses
> `view.header().closeTime`. For an `OpenView`, `header_.parentCloseTime = base_->header().closeTime`
> (`src/libxrpl/ledger/OpenView.cpp:103`), so the two differ by one ledger. Budget at least one extra
> ledger interval of slack beyond the 60 s buffer.

### 5.5 `VaultCreate` failure conditions — `src/libxrpl/tx/transactors/vault/VaultCreate.cpp`

preflight (lines 108-122) → all `temMALFORMED`:
```cpp
if (!isValidVaultKind(ctx.tx))            return temMALFORMED;   // VaultKind not in {0,1}
auto const kind = getVaultKind(ctx.tx);
auto const hasSubscription = ctx.tx.isFieldPresent(sfSubscriptionDate);
auto const hasRedemption   = ctx.tx.isFieldPresent(sfRedemptionDate);
auto const isClosedEnded   = kind == VaultKind::ClosedEnded;
if (!isClosedEnded && (hasSubscription || hasRedemption)) return temMALFORMED;
if (isClosedEnded)
{
    if (!hasSubscription || !hasRedemption)  return temMALFORMED;
    if (!isValidClosedEndedGap(ctx.tx[sfSubscriptionDate], ctx.tx[sfRedemptionDate]))
        return temMALFORMED;
}
```
Feature gate (`checkExtraFeatures`, lines 47-50): any of the three fields present without
`featureLendingProtocolV1_1` → `temDISABLED`.

preclaim (lines 167-169):
```cpp
if (hasExpired(ctx.view, ctx.tx[~sfSubscriptionDate]) ||
    hasExpired(ctx.view, ctx.tx[~sfRedemptionDate]))
    return tecEXPIRED;
```
(`Inclusive`, so `SubscriptionDate` must be **strictly greater** than the parent close time.)

doApply (lines 276-287):
```cpp
if (view().rules().enabled(featureLendingProtocolV1_1))
{
    vault->at(sfLEVersion) = std::to_underlying(VaultVersion::CashBasis);
    auto const kind = getVaultKind(tx);
    vault->at(sfVaultKind) = std::to_underlying(kind);
    if (kind == VaultKind::ClosedEnded)
    {
        vault->at(sfSubscriptionDate) = tx[sfSubscriptionDate];
        vault->at(sfRedemptionDate)   = tx[sfRedemptionDate];
    }
}
```

---

## 6. `LoanBrokerSet` requires a closed-ended vault (the track-defining rule)

`src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp:148-162` (create path only):
```cpp
// LP V1.1: only closed-ended vaults may host a loan broker. The
// lending protocol relies on the closed-ended Subscription /
// Investment / Redemption phase structure; attaching a broker to
// an open-ended vault has no well-defined lifecycle. VaultCreate
// stays unrestricted so existing open-ended flows keep working;
// the constraint is enforced here, at the point where the vault
// is first bound to the lending protocol.
if (ctx.view.rules().enabled(featureLendingProtocolV1_1) &&
    getVaultKind(sleVault) != VaultKind::ClosedEnded)
{
    JLOG(ctx.j.warn()) << "LoanBroker requires a closed-ended Vault.";
    return tecNO_PERMISSION;
}
```

From [rippled#8076](https://github.com/XRPLF/rippled/pull/8076):

| Amendment state | Before | After |
| --- | --- | --- |
| LP V1.1 disabled | allowed on open- or closed-ended | unchanged |
| LP V1.1 enabled | allowed on open- or closed-ended | **open-ended → `tecNO_PERMISSION`**; closed-ended unaffected |

Updating an existing broker on an already-open-ended vault is *not* affected — only creation.

### 6.1 The two Devnets disagree, and `build_version` tells you nothing

| | Hackathon Devnet | Public Devnet |
| --- | --- | --- |
| endpoint | `wss://lending-hackathon.dev.ripplex.io:51233` | `wss://s.devnet.rippletest.net:51233/` |
| `server_info.build_version` | `3.4.0-rc1` | `3.4.0-rc5` |
| network id | 4001 | 2 |
| amendments known | 107 | 106 |
| `LendingProtocolV1_1` | enabled | enabled |
| `LoanBrokerSet` on an **open-ended** vault | **`tesSUCCESS`** | **`tecNO_PERMISSION`** |

**Both verified by transactions I submitted on 2026-09-12:**

- Hackathon Devnet — `VaultCreate` with no `VaultKind` →
  `23AC98015A673C800DA07AE175CA2428F54FA3AC3C851B542E90211E6DD4EB80` (`tesSUCCESS`), then
  `LoanBrokerSet` against that vault →
  `58187AAE58E5A36FB5657F26839098CFF7600D3924DA2319AA86078574F2DC8A` (**`tesSUCCESS`**).
  The vault reads back as `{"LEVersion":1}` with no `VaultKind`, i.e. V1.1 is genuinely active on it.
- Public Devnet — the same two transactions →
  `BDDFA7D871FE462C23ED99A2536A1F891297226244553911B896FE6335110BD7` (`tesSUCCESS`) then
  `959899A83AB756696FA9C952F4DA8A7833ED60242F6A27E23AA2F9825B2BF52A` (**`tecNO_PERMISSION`**).

Corroboration on the hackathon Devnet from another team the same morning: account
`rPx8KDHN3KdEnexVTFJijr8RH26oQhxTWm` ran `VaultCreate` (open-ended) → `LoanBrokerSet` →
`LoanBrokerCoverDeposit` → `VaultDeposit` → `LoanSet` → `LoanPay` → `VaultWithdraw`, all
`tesSUCCESS`, between 11:24 and 11:37 UTC. A snapshot of that ledger shows 17 loan brokers, 9 of
them attached to open-ended vaults.

**The hackathon Devnet is a custom build, not a public tag.** The public `XRPLF/rippled` tag
`3.4.0-rc1` *does* contain the gate (fetch `LoanBrokerSet.cpp` at that tag and the
`"LoanBroker requires a closed-ended Vault."` string is there), and no public `3.4.0-rc5` tag exists
at all. Nor is the hackathon node simply older: it knows `fixCleanup3_5_0`, an amendment the public
Devnet has never heard of (the only difference between the two amendment name sets). So the
hackathon node runs a fork that has `fixCleanup3_5_0` but not
[rippled#8076](https://github.com/XRPLF/rippled/pull/8076) — most plausibly patched on purpose to
keep the open-ended Track 1 flow viable.

**Consequences for track choice**
- Track 1 (open-ended vault + loan broker) works **only** on the hackathon Devnet.
- On public Devnet the lending protocol is **closed-ended only**: you cannot create a loan broker
  without a `ClosedEnded` vault, so Track 2's closed-ended requirement is not a style choice, it is
  the only thing the ledger will accept.
- Never port a Track 1 flow to public Devnet or vice versa expecting the same results, and never
  reason about behaviour from `build_version`.

---

## 7. 🔴 `xrpl@5.2.0-beta.0` cannot originate a loan (wrong counterparty signing prefix)

`fixCleanup3_4_0` (enabled on **both** Devnets) gave role signatures their own hash prefixes.

`src/libxrpl/protocol/Sign.cpp:45-70`
```cpp
// Before fixCleanup3_4_0 every signature on a transaction covered the same
// bytes, so a signature could be moved from one role to another.
if (!rules.enabled(fixCleanup3_4_0))
    return multiSigning ? HashPrefix::TxMultiSign : HashPrefix::TxSign;

switch (role)
{
    case SignatureRole::Transaction:
        return multiSigning ? HashPrefix::TxMultiSign : HashPrefix::TxSign;
    case SignatureRole::Counterparty:
        return multiSigning ? HashPrefix::CounterpartyTxMultiSign
                            : HashPrefix::CounterpartyTxSign;
    ...
```
`include/xrpl/protocol/HashPrefix.h:99-104`: `CounterpartyTxSign = 'C','P','T'` (`0x43505400`),
`CounterpartyTxMultiSign = 'C','P','M'` (`0x43504D00`).

`ripple-binary-codec@2.11.0` (the dependency shipped with both xrpl.js builds) already exports
`encodeForSigningCounterparty` / `encodeForMultisigningCounterparty` with exactly those prefixes
(`dist/hash-prefixes.js`: `counterpartyTransactionSig: bytes(0x43505400)`).

But `xrpl@5.2.0-beta.0`, `dist/npm/Wallet/counterpartySigner.js:39,48`:
```js
TxnSignature: computeSignature(tx, wallet.privateKey, multisignAddress),   // multisig path
TxnSignature: computeSignature(tx, wallet.privateKey),                      // single-sig path
```
and `dist/npm/Wallet/utils.js:36-44` — no role parameter, so it falls through to
`encodeForSigning(tx)` (prefix `STX`).

`xrpl@5.2.0` (final) fixes it — `dist/npm/Wallet/counterpartySigner.js:39,48`:
```js
TxnSignature: computeSignature(tx, wallet.privateKey, multisignAddress, 'counterparty'),
TxnSignature: computeSignature(tx, wallet.privateKey, undefined, 'counterparty'),
```
with a `SIGNING_ENCODERS` table routing `counterparty` → `encodeForSigningCounterparty`.

**Observed failure (public Devnet, xrpl@5.2.0-beta.0):**
```
fails local checks: Counterparty: Invalid signature.
```
which is rippled's `STTx::checkSign` (`src/libxrpl/protocol/STTx.cpp:276-281`) prefixing the role
name onto the failure.

### 7.1 Working workaround for 5.2.0-beta.0

```js
const { encode, decode, encodeForSigningCounterparty } = require('ripple-binary-codec')
const { sign } = require('ripple-keypairs')

// Replaces xrpl@5.2.0-beta.0's signLoanSetByCounterparty.
// The broker must have signed first (TxnSignature + SigningPubKey present).
function counterSign(counterpartyWallet, brokerSignedTxBlob) {
  const tx = decode(brokerSignedTxBlob)
  tx.CounterpartySignature = {
    SigningPubKey: counterpartyWallet.publicKey,
    TxnSignature: sign(encodeForSigningCounterparty(tx), counterpartyWallet.privateKey),
  }
  return encode(tx)   // submit this blob
}
```
Order matters: `autofill` → broker `wallet.sign()` → counterparty signs the *broker-signed* blob.
`LoanSet::preflight` (`LoanSet.cpp:90-93`) rejects a non-Batch `LoanSet` with no
`CounterpartySignature` as `temBAD_SIGNER`.

---

## 8. Cash-basis vs whole-life (accrual) accounting

`include/xrpl/ledger/helpers/LendingHelpers.h:341-343, 367-368`
```
// Whole-life (pre-LendingProtocolV1_1) recognition model: interest is
// recognized into AssetsTotal/DebtTotal up front, at origination.
namespace accrual { ... }

// Cash-basis (LendingProtocolV1_1) recognition model: AssetsTotal/DebtTotal
// are principal-only, interest is recognized only as it's actually paid.
namespace cash_basis { ... }
```

`src/libxrpl/ledger/helpers/LendingHelpers.cpp`

| Touch point | `accrual::` (V1, `LEVersion` absent) | `cash_basis::` (V1.1, `LEVersion = 1`) |
| --- | --- | --- |
| `LoanSet` origination | `assetsTotalDelta = interestDue`<br>`debtTotalDelta = principalRequested + interestDue` | `assetsTotalDelta = 0`<br>`debtTotalDelta = principalRequested` |
| `LoanPay` | `assetsTotalDelta = valueChange`<br>`debtTotalDelta = (principalPaid + interestPaid) − valueChange` | `assetsTotalDelta = interestPaid`<br>`debtTotalDelta = principalPaid` |
| Vault exposure on impair / default (`loanVaultExposure`) | `TotalValueOutstanding − ManagementFeeOutstanding`<br>(= `PrincipalOutstanding + InterestOutstanding`, XLS-66 §3.2.3.2) | `PrincipalOutstanding` |
| `AssetsMaximum` check at origination | `interestDue > vaultMaximum − vaultTotal` → `tecLIMIT_EXCEEDED` | **never triggers** (returns `false`) |

Verbatim:
```cpp
namespace cash_basis {
AccountingDeltas loanOriginationDeltas(Number const& principalRequested)
{ return {.assetsTotalDelta = kNumZero, .debtTotalDelta = principalRequested}; }

/* Under CashBasis accounting, Loan default amount is:
 *   DefaultAmount = Loan.PrincipalOutstanding */
Number loanVaultExposure(SLE::const_ref loanSle)
{ return loanSle->at(sfPrincipalOutstanding); }

AccountingDeltas loanPaymentDeltas(LoanPaymentParts const& parts)
{ return {.assetsTotalDelta = parts.interestPaid, .debtTotalDelta = parts.principalPaid}; }
}
```
And the `AssetsMaximum` carve-out (`LoanSet.cpp:346-355`):
```cpp
// Accrual origination credits interestDue into AssetsTotal, so a vault
// already at AssetsMaximum cannot take another loan. Cash-basis origination
// does not change AssetsTotal (see cash_basis::loanOriginationDeltas), so
// this leftover accrual gate must not apply there.
if (getVaultVersion(vault) != VaultVersion::CashBasis && vault->at(sfAssetsMaximum) != 0 &&
    vault->at(sfAssetsTotal) >= vault->at(sfAssetsMaximum))
    return tecLIMIT_EXCEEDED;
```

### 8.1 What this changes for a demo

- **Share price.** `PPS = AssetsTotal / SharesTotal`, where `SharesTotal` is
  `MPTokenIssuance.OutstandingAmount` (the `Vault` entry deliberately has *"no SharesTotal ever"* —
  `ledger_entries.macro:521`). Under V1 PPS jumps at origination; under V1.1 PPS is flat at
  origination and rises **only** when `LoanPay` actually delivers interest.
- **There is no donation flag.** Yield enters a V1.1 vault exclusively through
  `cash_basis::loanPaymentDeltas`: `AssetsTotal += interestPaid` with no shares minted → PPS rises.
  That *is* the "raise PPS without minting shares" mechanism; it needs no special flag.
- **Withdrawal exchange rate** subtracts `LossUnrealized` unless the redeemer is the sole remaining
  shareholder (`assetsTotalForWithdrawal` + `WaiveUnrealizedLoss`, `VaultHelpers.h`).
- **`LoanBroker.DebtTotal`** is principal-only under V1.1, so "broker debt" is no longer comparable
  to a V1 vault's number.

---

## 9. ❌ `tfVaultDonation` does not exist

Exhaustive negative search, all returning zero matches:

| Corpus | Query | Result |
| --- | --- | --- |
| `XRPLF/rippled` @ `9403736` (whole tree, case-insensitive) | `donation` | **0** |
| `include/xrpl/protocol/TxFlags.h` | `VaultDonation` | **0** |
| `XRPLF/XRPL-Standards` @ `0200ec5` (all XLS) | `donation` | only XLS-68 prose about sponsoring fees |
| `XRPLF/xrpl-dev-portal` `docs/` (559 files) | `donation` | **0** |
| `xrpl@5.2.0-beta.0` `dist/npm` | `donation` | **0** |

`VaultDeposit` has **no flags at all** — `TxFlags.h` defines flags only for `VaultCreate`
(`tfVaultPrivate = lsfVaultPrivate = 0x00010000`, `tfVaultShareNonTransferable = 0x00020000`).
`transactions.macro:828-836` gives `ttVAULT_DEPOSIT` exactly two fields, `sfVaultID` and `sfAmount`.

Any design that assumed `VaultDeposit` + `tfVaultDonation` must be rewritten to inject yield via
`LoanPay` interest (§8.1).

---

## 10. RPC surface

`vault_info` and `ledger_entry` return the three new fields for closed-ended vaults and omit them
for open-ended ones. **Verified live** — `vault_info` on a closed-ended vault I created returns keys:

```
["Account","Asset","Data","Flags","LEVersion","LedgerEntryType","Owner","OwnerNode",
 "PreviousTxnID","PreviousTxnLgrSeq","RedemptionDate","Sequence","ShareMPTID",
 "SubscriptionDate","VaultKind","WithdrawalPolicy","index","shares"]
```
```json
{"VaultKind":1,"SubscriptionDate":842528715,"RedemptionDate":842529015,"LEVersion":1}
```
An open-ended vault created under V1.1 returns `{"LEVersion":1}` and no `VaultKind`. Callers MUST
treat an absent `VaultKind` as `OpenEnded`.

`LEVersion` is returned but is documented nowhere; it is the only way to tell cash-basis from
accrual accounting for a given vault.

---

## 11. Verified live transactions (public XRPL Devnet, 2026-09-12)

Network: `wss://s.devnet.rippletest.net:51233/`, `build_version` `3.4.0-rc5`, network id 2.
Library: `xrpl@5.2.0-beta.0` (+ the §7.1 workaround for `LoanSet`).

| Probe | Result | Hash |
| --- | --- | --- |
| `VaultCreate` open-ended | `tesSUCCESS` | `BDDFA7D871FE462C23ED99A2536A1F891297226244553911B896FE6335110BD7` |
| `LoanBrokerSet` on that open-ended vault | **`tecNO_PERMISSION`** | `959899A83AB756696FA9C952F4DA8A7833ED60242F6A27E23AA2F9825B2BF52A` |
| `VaultCreate` closed-ended, gap `120` s | rejected client-side by xrpl.js (`[180, 946708560)`) | — |
| `VaultCreate` closed-ended, gap `179` s | rejected client-side by xrpl.js | — |
| `VaultCreate` closed-ended, gap `180` s | `tesSUCCESS` | `36E8C2750766B322B3FF59505F3C120AD8CF54A4D1C3F9C81BD13E8877791F97` |
| `VaultCreate` closed-ended, `SubscriptionDate` in the past | **`tecEXPIRED`** | `9CD1C7FFCB32E60CA68E01679002DE814F0530E41927B7CC8109ED3C492F6BF8` |
| `VaultCreate` no `VaultKind` + dates present | `ValidationError` client-side | — |
| `VaultCreate` `VaultKind: 2` | `ValidationError` client-side | — |
| `VaultCreate` closed-ended (phase-walk vault) | `tesSUCCESS` | `891E8F77FA198DEAF27E897AB8C8141E42AD9F0AFF8A1E8AD0C3A1A2BF325D63` |
| `LoanBrokerSet` on closed-ended vault (Subscription) | `tesSUCCESS` | `2166388ED18884739BBD5D8EB98E5FAD0F99492E9C1C73684B1A0AAA03A23D0C` |
| `LoanBrokerCoverDeposit` (Subscription) | `tesSUCCESS` | `CE63F6802F8E83DEA8CDF51C15BCF7BDC3151E5E8D24DEE71FD0CA7C07D3826E` |
| `VaultDeposit` during **Subscription** | `tesSUCCESS` | `1FA74D582D09509EBEF1B09B375398B81DD0ED52A725F87E39784CB07C669984` |
| `VaultWithdraw` during **Subscription** | `tesSUCCESS` | `F0D845C85F2263DEF9C0038AF8F9ADE2181B17047815465A673E1A3D21F7E0EB` |
| `VaultDeposit` during **Investment** | **`tecEXPIRED`** | `367F41849772063733C48F4BD0FE3EE78B6CF211B760F7FEA6D5DB75F3418723` |
| `VaultWithdraw` during **Investment** | **`tecTOO_SOON`** | `01F68F66C19823BCC8366A8B0AB7BE6573446DC875DA261411783FB228975D42` |
| `LoanSet` via unpatched `signLoanSetByCounterparty` | local reject: `Counterparty: Invalid signature.` | — |
| `LoanBrokerSet` on closed-ended vault (loan walk) | `tesSUCCESS` | `AF8C1AB526650F3EA0448962B69AB7B852ACC0EAACF40332B025D4D87D022E0D` |
| `LoanSet` during **Subscription** | **`tecTOO_SOON`** | `FB400B208663CFAC3CB3906A40BCBE03A1AE4CD2F4A68B233816ED90D3AAEEBD` |
| `LoanSet` during Investment, final payment inside the 60 s buffer | **`tecNO_PERMISSION`** | `38AC1C602FDF105A885D635FADFDD4E0CD2A7D70B47157791175E85D2BAF10E1` |
| `LoanSet` during Investment, valid schedule, **§7.1 workaround** | `tesSUCCESS` | `13823CD6B30068C193493C048B931C4E0557DC70EB9A3110F780992BE0509BEF` |
| `LoanPay` (cash-basis interest recognition) | `tesSUCCESS` | `DA26AE7F74FE45AB16863753D05952D890D445F5D284980AA99F5796E314CC38` |
| `LoanSet` during **Redemption** | **`tecEXPIRED`** | `94098C97BC5C7126EF76F82D6CE5B40CDF571DD35AE776F503CBC7E2D404B455` |
| `VaultDeposit` during **Redemption** | **`tecEXPIRED`** | `C1638B0858BA21A370C4986106B8E24AE149DAE2B838660E7AA3D14FE1651A16` (also `8F4F7A0DEECFBA1B595E0E635D4642AFDA87D315F083A4F9DE38BBFA28B2741D`) |
| `VaultWithdraw` during **Redemption** | `tesSUCCESS` | `9820FB2A71E6684361448F271A533C181D6BF6ED77FA3ED6B2F0781A99A050FB` (also `509DF00B90C471CAA417DDE3A1C0074D634931061DE0EEF52D625AA8E51673D1`) |

Vault `E0FC7A17A3B09BCEAF57A24630965D413D254F106D7708925AF38AEC6A453ECD`
(`SubscriptionDate` 842528900, `RedemptionDate` 842529380),
broker `857AC606D93AB9DA04E41D3362478E013FF8853B1B739E5869A8E11085D55713`,
loan `85F223D5F90E224C5ABAA017FE6D8991F1C127928D863F9F4E3C178CAAB8A772`.
The `tecNO_PERMISSION` probe used `PaymentInterval=120, PaymentTotal=4` with 479 s left to
`RedemptionDate`: `480 + 60 > 479`. The accepted one used `PaymentTotal=2`: `240 + 60 <= 479`.

### 11.1 Cash-basis proven on ledger

| Moment | `Vault.AssetsTotal` | `Vault.AssetsAvailable` | `LoanBroker.DebtTotal` |
| --- | --- | --- | --- |
| after deposits, before origination | `80000000` | `80000000` | `0` |
| after `LoanSet` (principal 60000000) | **`80000000` (unchanged)** | `20000000` | **`60000000`** |
| after `LoanPay` | **`80000226`** | `50000168` | **`30000058`** |

The loan at origination: `PrincipalOutstanding 60000000`, `TotalValueOutstanding 60000343`,
`ManagementFeeOutstanding 6`, `PaymentRemaining 2`, `StartDate 842528921`,
`PaymentInterval 120`, `NextPaymentDueDate 842529041`.

The 343 drops of scheduled interest were **not** added to `AssetsTotal` at origination, and
`DebtTotal` was set to the bare principal — this is `cash_basis::loanOriginationDeltas`
(`{0, principalRequested}`). Under V1 accrual the same origination would have produced
`AssetsTotal = 80000343` and `DebtTotal = 60000343`. The `LoanPay` then moved
`AssetsTotal` by exactly `+226` (the interest actually delivered) and `DebtTotal` by
`-29999942` (the principal actually repaid) — `cash_basis::loanPaymentDeltas`
(`{interestPaid, principalPaid}`). Shares outstanding were unchanged throughout, so **PPS rose
purely from the interest leg of the payment**. That is the entire yield mechanism; no flag is
involved.

### 11.2 Redemption with a loan still outstanding

At `RedemptionDate` the loan still had `PaymentRemaining 1`. The vault showed
`AssetsTotal 75000227` but only `AssetsAvailable 45000169`, with `Broker.DebtTotal 30000058`
still on loan. Withdrawals during Redemption are capped by `AssetsAvailable`, so **a loan whose
schedule runs up to the 60 s buffer leaves lenders unable to redeem in full at the start of
Redemption.** Size the schedule so the final `LoanPay` lands comfortably before `RedemptionDate`,
not merely 60 s before it.

Explorer: https://devnet.xrpl.org

---

## 12. Reference JSON

### Closed-ended `VaultCreate`
```json
{
  "TransactionType": "VaultCreate",
  "Account": "rBroker...",
  "Asset": { "currency": "XRP" },
  "VaultKind": 1,
  "SubscriptionDate": 842528715,
  "RedemptionDate": 842529015,
  "Data": "70617461706...",
  "WithdrawalPolicy": 1
}
```
Rules: `VaultKind` 0 or 1; both dates required iff `VaultKind == 1` and forbidden otherwise;
`180 <= RedemptionDate - SubscriptionDate < 946708560`; `SubscriptionDate` strictly greater than the
parent ledger close time; Ripple epoch seconds (`Math.floor(Date.now()/1000) - 946684800`).

### Resulting `Vault` ledger entry (closed-ended, V1.1)
```json
{
  "LedgerEntryType": "Vault",
  "VaultKind": 1,
  "SubscriptionDate": 842528715,
  "RedemptionDate": 842529015,
  "LEVersion": 1,
  "WithdrawalPolicy": 1,
  "ShareMPTID": "00000001D63564611000A695774D12C700AD03C890CE7997",
  "AssetsTotal": "75000000",
  "AssetsAvailable": "75000000"
}
```

### `LoanSet` schedule sizing for a closed-ended vault
```
StartDate ≈ current ledger close time at submission
require: StartDate + PaymentInterval * PaymentTotal + 60 <= RedemptionDate
PaymentInterval >= 60 (kMinPaymentInterval), PaymentTotal >= 1
InterestRate in tenth-basis-points, max 100000 (= 100% APR)
```


---

## 13. Additional gotchas worth designing around

- **`Loan` never stores `PaymentTotal`.** `ledger_entries.macro` `ltLOAN` (`0x0089`) stores
  `sfPaymentRemaining` and `sfPeriodicPayment`, not the original payment count. The closed-ended
  maturity rule is enforced against `PaymentTotal`, a `LoanSet`-only transaction field, so the
  constraint cannot be re-derived from ledger state after the first payment. Approximate with
  `NextPaymentDueDate + PaymentInterval * (PaymentRemaining - 1)`.
- **`InterestOutstanding` is computed, not stored:**
  `InterestOutstanding = TotalValueOutstanding - PrincipalOutstanding`, and
  `InterestOwedToVault = InterestOutstanding - ManagementFeeOutstanding`
  (comment block in `ledger_entries.macro`, `ltLOAN`).
- **`Vault` has no `SharesTotal`.** `ledger_entries.macro:521`: *"no SharesTotal ever (use
  MPTIssuance.sfOutstandingAmount)"*. For PPS you must read the share `MPTokenIssuance`.
  `vault_info` conveniently returns a `shares` sub-object.
- **`VaultCreate` on public Devnet needs a real reserve.** Vault creation consumes owner reserve
  plus the MPTokenIssuance; the Devnet faucet grants 100 XRP, which is enough for one vault +
  broker + a ~60 XRP loan but not much more.
- **Phase transitions are driven by the parent ledger close time**, which on Devnet lags wall
  clock by one ledger (~3-4 s). Drive demos off
  `ledger(ledger_index="validated").close_time`, not `Date.now()`.
- **Hackathon faucet breaks `client.fundWallet()`.** `POST https://lending-hackathon-faucet.dev.ripplex.io/accounts`
  returns `{"account":{"address":"r...","secret":"sEd..."},"balance":1000}`. xrpl.js's `fundWallet`
  reads `account.classicAddress` and therefore throws `The faucet account is undefined`. Work
  around it by calling the faucet yourself and doing
  `Wallet.fromSeed(json.account.secret)`. (The public Devnet faucet works with `fundWallet` and
  grants 100 XRP; the hackathon faucet grants 1000 XRP.)
- **`LoanSet` fee autofill**: xrpl.js prints a bare `console.log` on every `LoanSet` autofill —
  *"For LoanSet transaction the auto calculated Fee accounts for total number of signers the
  counterparty has to avoid transaction failure."* — with no way to silence it.
- **`LoanBrokerSet` update path is not phase-gated**; only creation checks `VaultKind`.
- **`VaultDelete.MemoData`** (spec `XLS-0065-single-asset-vault/65.1`, amendment
  `LendingProtocolV1_1`): optional, 1-256 bytes decoded, empty is `temMALFORMED`, absent the
  amendment its presence is `temDISABLED`. Not written to any ledger entry.

## 14. Transaction type numbers (for reference)

`include/xrpl/protocol/detail/transactions.macro`: `VaultCreate` 65, `VaultSet` 66,
`VaultDelete` 67, `VaultDeposit` 68, `VaultWithdraw` 69, `VaultClawback` 70,
`LoanBrokerSet` 74, `LoanBrokerDelete` 75, `LoanBrokerCoverDeposit` 76,
`LoanBrokerCoverWithdraw` 77, `LoanBrokerCoverClawback` 78, `LoanSet` 80, `LoanDelete` 81,
`LoanManage` 82, `LoanPay` 84. There is **no `LoanAccept` transaction** — grep for
`LoanAccept` across the whole rippled tree returns zero, yet the draft closed-ended spec
devotes §8 and §13.6 to it.

Ledger entries: `ltVAULT` `0x0084`, `ltLOAN_BROKER` `0x0088`, `ltLOAN` `0x0089`.
