# Audit externe, 12 septembre 2026, 23:30 CEST

## Résolution, 13 septembre 2026, nuit

Tout ce qui suit a été corrigé et revérifié contre le ledger, le code et l'app déployée. L'audit
d'origine est conservé tel quel en dessous.

| Point | Résolution | Où le vérifier |
|---|---|---|
| B-1 beta.1 | Finding 2 et la proposition du finding 1 réécrits ; README et F-001/F-002 corrigés ; repro hors ligne sur les trois versions | `DEVELOPER-REPORT.md`, `scripts/experiments/counterparty-signature.mjs` |
| B-2 donation | Ligne du tableau spec et essai yield pointent rippled #6383 `tfVaultDonate` | rapport, README « On yield », F-016 |
| B-3 pages | Rapport réécrit : 3 pages en A4 11 pt, Letter 12 pt et style GitHub, aucun finding perdu | `DEVELOPER-REPORT.md` |
| B-4 deck | Lien vers Fund I sur l'app Vercel, slide 2 corrigée, collatéral réel, PDF régénéré, 6 hashes vérifiés | `web/public/deck/`, `docs/PATAPIM-DECK.pdf` |
| B-5 réseau | Les trois hashes du devnet custom marqués † et l'en-tête le dit | rapport |
| B-6 VaultCreate | Ligne réécrite avec la preuve `8D50A1D9…F93D` ; F-012 réécrit | rapport, F-012 |
| B-7 vault vivant | Nouveau carnet : Fund I, prêt courant jusqu'au 15 septembre 12:00 CEST ; Fund II ouvert à la souscription ; evidence complète | `scripts/standing.mjs`, `docs/ON-CHAIN.md` |
| B-8 éligibilité | Phrase du README remplacée par le mécanisme réel, prouvé par le compte de démo sans credential | README « On the ledger » |
| N-1 à N-10 | Batch sourcé (#6360), trois codes et non quarante, #589 attribué au co-auteur, plafond `CoverAvailable`, buffer de 60 s, destination tierce, frais au `LoanSet` | rapport, F-021, F-022, README |
| §3 | NAV net partout, labels d'impairment, casse des codes, sorties en anglais, `pay` dans `demo.mjs`, `xrpl` épinglé côté app | scripts, `web/` |
| Bug trouvé en cours | Le dashboard prenait le premier `LoanBroker` du propriétaire : filtré sur `VaultID` | `web/lib/ledger.ts` |

**Le wallet connect, décision révisée sur preuve.** `xrpl-connect` n'est pas livré. Les extensions
Crossmark 0.2.19 et GemWallet 3.8.2 ne savent encoder ni `VaultDeposit` ni un montant MPT : GemWallet
verrouille `xrpl` 3.1.0 et `ripple-binary-codec` 2.1.0, qui lèvent sur les deux, et aucun des deux bundles
ne contient `VaultDeposit` ni `mpt_issuance_id`. `xrpl-connect@1.0.0-rc.2` casse en plus le build Turbopack
et exclut `xrpl` 5 de ses peers. À la place : l'onglet Sign signe dans le navigateur avec
`xrpl.js@5.2.0-beta.0` et une des deux clés publiées dans `docs/DEMO-ACCOUNTS.md` ; le serveur ne relaie
qu'un blob signé `VaultDeposit` ou `VaultWithdraw`. Prouvé sur la production : `tesSUCCESS` pour
l'investisseur éligible, `tecNO_AUTH` pour l'autre. Constats F-019 et F-020.

---


Dépôt audité : `main` à `51cf263`, plus l'arbre de travail au moment de la lecture. Ledger : devnet
public, `server_info` → rippled `3.4.0-rc5`, `network_id 2`. Devnet custom joint par websocket pour
les hashes qu'on y attendait : `3.4.0-rc1`, `network_id 4001`.

Sources croisées pendant l'audit, toutes datées du 12 septembre : XRPLF/rippled `develop` à
`9403736` (clone), XRPLF/XRPL-Standards `master` à `0200ec5`, XRPLF/xrpl-dev-portal `main` à
`dc29bc4`, les tarballs npm `xrpl@5.2.0-beta.0`, `xrpl@5.2.0-beta.1`, `xrpl@5.2.0`,
`ripple-binary-codec@2.11.0`, `xrpl-connect@0.8.2` et `@1.0.0-rc.2`, ripple/explorer `main` à
`0232381` avec la PR #1342 appliquée, l'app construite depuis `web/` et servie sur `:3100`.

Ce que je n'ai pas pu faire : rendre l'onglet Chrome piloté visible (`document.hidden` est resté
`true` même onglet unique, fenêtre probablement en arrière-plan). J'ai forcé la visibilité et
l'intro comme tu l'indiquais, ce qui a rendu la landing et le dashboard. Le drag de la grille et le
400 px, qui dépendent d'une fenêtre réelle, sont couverts par la suite Playwright du dépôt
(`web/tests/ghost.spec.ts`, 7 tests) que j'ai exécutée avec le Chrome système : 7/7 verts. La suite
réécrit `docs/design/live/*.png` ; je les ai restaurés (`git checkout`).

---

## 1. Bloquant

### B-1 · « No published version has both halves » est faux depuis le 11 septembre, 16:59 UTC

Où : `DEVELOPER-REPORT.md:43` (titre du finding 2), `:39` (le « Proposed fix » du finding 1),
`README.md:81-82`, `docs/feedback/FRICTION-LOG.md:62`.

```
npm view xrpl time --json | grep '5.2.0'
# 5.2.0-beta.0 2026-09-10T13:42  ·  5.2.0-beta.1 2026-09-11T16:59  ·  5.2.0 2026-09-11T22:20
npm pack xrpl@5.2.0-beta.1 && tar xzf xrpl-5.2.0-beta.1.tgz
grep -n "'counterparty'" package/src/Wallet/counterpartySigner.ts     # :88 et :101
grep -rl "VaultKind" package/src/models                                # ledger/Vault.ts, transactions/vaultCreate.ts
```

Obtenu : `xrpl@5.2.0-beta.1` porte **et** les types closed-ended **et** l'argument `role:
'counterparty'`. Attendu par le rapport : aucune version publiée ne porte les deux. Le dist-tag
`beta-experimental` pointe déjà sur beta.1. Le finding 1 reste vrai pour la beta.0 que le brief
impose ; le finding 2 et la proposition « backport the role argument » sont morts tels quels.

Correctif le plus court : finding 2 devient « la ligne stable n'a pas les types, la ligne beta.0 n'a
pas la signature ; beta.1, publiée pendant l'événement, a les deux et le brief ne pointe pas dessus ».
Finding 1 : proposition → « pointer le brief sur beta.1, et dire dans le README de beta.0 qu'elle ne
peut pas originer un prêt ». Même phrase à corriger dans `README.md:81` et F-002.

### B-2 · `tfVaultDonation` « n'existe nulle part » : la PR rippled est ouverte depuis février

Où : `DEVELOPER-REPORT.md:89` (ligne 6 du tableau spec), `:97-110` (essai yield), `README.md:131-135`
(« On yield »), F-006, F-016.

```
gh api repos/XRPLF/rippled/pulls/6383 --jq '[.title,.state,.created_at,.updated_at,.user.login]|join(" | ")'
# feat: Add tfVaultDonate feature | open | 2026-02-18 | 2026-09-09 | Tapanito
```

C'est exactement le schéma F-018. Le flag s'appelle `tfVaultDonate` (pas `tfVaultDonation`),
`0x00010000` sur `VaultDeposit`, gardé par `LendingProtocolV1_2` qui est `Supported::No` dans
`features.macro:19`. La spec référencée par la PR est XRPL-Standards #469, dont le corps dit
explicitement ne **pas** introduire la donation ; aucun texte de spec trouvé. Le deck de l'atelier
enseigne donc un flag en cours d'implémentation, non voté, non spécifié. La phrase « that flag exists
nowhere in the source or in `server_definitions` » est vraie pour l'arbre, fausse comme conclusion.

Correctif : ligne 6 → « pas dans l'implémentation ; `tfVaultDonate` est la PR rippled #6383, ouverte,
derrière `LendingProtocolV1_2` ». Essai yield : « either ship the donation flag or correct the deck »
→ « either merge #6383 or correct the deck ». Déjà intégré dans `docs/review/FABLE-REPORT-CUT.md`.

### B-3 · Le rapport fait 6 pages, pas 3, et la coupe de la table « Smaller things » ne suffit pas

Mesure : `DEVELOPER-REPORT.md` → HTML via `marked`, impression PDF par Chrome headless
(`--print-to-pdf`), comptage des objets `/Type /Page`. Deux réglages :

| variante | mots | A4, 11 pt, marges 20 mm | A4, 10,5 pt, marges 15 mm | style GitHub 16 px |
|---|---|---|---|---|
| rapport actuel | 2 418 | **6** | 4 | 7 |
| sans « Smaller things » | 2 086 | 5 | | |
| sans « Smaller things » ni tableau spec | 1 869 | 4 | | |
| `docs/review/FABLE-REPORT-CUT.md` (tous les findings, compressés) | 1 554 | 4 | **3** | 5 |
| idem, tableau spec replié dans les essais | 1 391 | **3** | **3** | |

Fichiers dans le scratchpad `report/` : `render.mjs`, `variants.mjs`, `measure-compact.mjs`.

La coupe minimale qui passe sous trois pages **quel que soit le réglage** est à ≈1 400 mots : cette
table part, chaque essai perd 40 %, le tableau spec devient sept lignes courtes ou se replie dans les
essais. J'ai écrit cette version dans `docs/review/FABLE-REPORT-CUT.md` : aucun finding perdu, les
neuf « smaller things » renvoyées au friction log et au hook, catégorie et sévérité sur chaque
finding, et les corrections B-1, B-2, B-5, la nuance du #589 et le « 2000001 » intégrées. À 1 554
mots elle tient à 10,5 pt ; si tu veux la garantie à 11 pt, replie le tableau spec (lignes 1, 2, 7
sont les plus faibles).

### B-4 · Le deck pointe sur le vault vidé et prête à l'agent un contrôle que le ledger ne fait pas

Où : `web/public/deck/index.html` (une occurrence de `/vault/1D5C0C8E…`), `docs/PATAPIM-DECK.pdf`
(même id dans les flux), `docs/PITCH-DECK.md:17`.

```
curl -s -X POST https://s.devnet.rippletest.net:51234/ -d '{"method":"ledger_entry","params":[{"index":"1D5C0C8EA8BEB028EB4AD5507F0BCFCA7D3D0977712C09B96D21E3DB54372687"}]}' | python3 -c "import sys,json;n=json.load(sys.stdin)['result']['node'];print(n.get('AssetsTotal'),n.get('RedemptionDate'))"
# None 842550010   → zéro partout, redemption passée
```

Le lien « live vault » du deck envoie sur le vault que l'ACTION-LIST a déclaré vidé (3.1). Le vault
vivant est `FAB518C7…0132`. Slide 2 : « The agent … checks borrower eligibility » contredit F-018 :
aucun contrôle d'éligibilité emprunteur n'existe on-chain (`LoanSet` du non-membre `DDD61141` passe),
et l'agent ne le fait pas non plus dans le code. Les cinq hashes du deck résolvent avec le bon
résultat (`7B9D16FA` tecEXPIRED, `CE5C7E59` tesSUCCESS, `D4C93863` tecNO_AUTH, `EDF10740`, `95AD6692`).

Correctif : remplacer l'id dans `index.html`, régénérer le PDF (`scripts/build-deck.py`), reformuler
slide 2 : « the agent decides whom to lend to; the ledger does not gate the borrower, F-018 ».

### B-5 · Deux hashes du rapport sont sur le devnet custom, l'en-tête dit network_id 2

Où : `DEVELOPER-REPORT.md:24` (`42BDEBF8…A530`, finding 1) et `:85` (`553C31E8…`, ligne 2 du tableau).

```
# devnet public : txnNotFound pour les deux
# devnet custom (wss://lending-hackathon.dev.ripplex.io:51233, network_id 4001) :
#   553C31E8 VaultClawback tesSUCCESS validated   42BDEBF8 LoanSet tesSUCCESS validated
```

Le finding 3 nomme son réseau, ces deux-là non. Un juge qui colle `553C31E8` dans devnet.xrpl.org
obtient NOT FOUND. Correctif : une dague † sur les deux et une phrase dans l'en-tête, comme dans
`FABLE-REPORT-CUT.md`. Le friction log F-001 le dit bien (« custom hackathon devnet »), le rapport pas.

### B-6 · La ligne « VaultCreate » du rapport est fausse sur deux points, et cache un meilleur finding

Où : `DEVELOPER-REPORT.md:196`, F-012.

1. « the `VaultCreate` reference page never says the cost is a reserve at all » : faux.
   `docs/references/protocol/transactions/types/vaultcreate.md:76-78` (portail `dc29bc4`) : « VaultCreate
   **must destroy an incremental owner reserve**, currently 0.2 XRP ».
2. « `VaultCreate` costs 2 XRP on one hackathon network and 0.2 XRP on the other » : c'est ce que
   xrpl.js a **facturé**, pas ce que le ledger **exige**. Vérifié ce soir sur le devnet public :

```
VaultCreate, Fee: '12' drops, autofill sans toucher au Fee
→ tesSUCCESS  8D50A1D91E85B8CEA7EDBAEB7BCA82AD8320F6B6892BFF9D87711F201C5BF93D   (reserve_inc 200000)
```

   `xrpl@5.2.0-beta.0/src/sugar/autofill.ts:379-381` met `VaultCreate` dans la liste
   `AccountDelete, AMMCreate, VaultCreate` qui reçoit `reserve_inc` comme fee. Dans rippled
   `develop` à `9403736`, seuls `LedgerStateFix.cpp:90`, `AMMCreate.cpp:91` et `AccountDelete.cpp:63`
   appellent `calculateOwnerReserveFee` ; `VaultCreate.cpp` n'a pas de `calculateBaseFee`. La spec
   XLS-65 §3.2.4 (« must destroy one incremental owner reserve ») et xrpl.org disent burn, la
   bibliothèque le prélève, le ledger ne le demande pas : vous avez brûlé 2 XRP puis 0,2 XRP pour rien.

C'est un finding « client libraries » plus fort que celui écrit. La table est coupée en B-3, mais
F-012 et l'item déposé via le hook restent faux : à réécrire. Compte devnet jetable créé pour ce test,
sans rapport avec vos comptes.

### B-7 · Le vault vivant change d'état à 14:25 CEST dimanche, et son tableau on-chain est vide

Loan `1D463015…5BB8` sur `FAB518C7` : `NextPaymentDueDate 842617452`, `GracePeriod 60`,
`PaymentRemaining 1`, `TotalValueOutstanding 2000183`.

| événement | Ripple epoch | CEST dimanche |
|---|---|---|
| échéance du paiement | 842617452 | **14:24:12** |
| fin de grâce | 842617512 | **14:25:12** |
| ouverture de la redemption | 842624590 | 16:23:10 |

À partir de 14:25:12 `loanStatus()` (`web/lib/ledger.ts:167`) passe le prêt de `current` à
`overdue`, badge ambre, sur la landing et le dashboard. `demo.mjs` n'a **pas** de verbe `pay` : les
seules sorties sont `impair` puis `default`, qui font tomber la cover à 500 000 et changent les
figures du hero. Si le passage devant le jury est après 14:25, décide maintenant : ajouter un verbe
`pay` (LoanPay `tfLoanFullPayment` par `mm`, montant `TotalValueOutstanding`) et le tirer vers 14:00,
ou assumer « overdue » et le raconter. Le vault reste en Investment jusqu'à 16:23, ça tient.

Ensuite, `docs/ON-CHAIN.md` section « Standing demo vault » : tableau des transactions **vide**
(`standing-demo.json` → `"events": []`, `demo.mjs:38-43` ne journalise jamais les hashes). Les
transactions existent : `account_tx` sur l'agent `r9RrYWqq…` donne `8293E877` VaultCreate,
`17BB4425` LoanBrokerSet, `F6925468` LoanBrokerCoverDeposit, `43EEA67B` VaultDeposit (prêteur
`rUqiSs1m…`), `FAE60FDE` LoanSet, `1E034E77` VaultSet. Ajoute-les à `events` et relance
`gen-onchain-inventory.mjs` : c'est le vault que le README appelle « the one to open in the explorer ».

### B-8 · `README.md:71-72` inverse le mécanisme d'éligibilité

« Vault shares inherit the underlying security's authorisation gate, so eligibility on the security
is eligibility on the lender position. » Faux et vérifié : l'émission de parts
`000000013004654E…838A` porte son **propre** `DomainID 9200CA56…`, et le market maker, autorisé sur
la security (`MPTokenAuthorize` passé, il détient 10 000 000 TBL), est refusé `tecNO_AUTH` au dépôt
(`30C4B86F`). L'éligibilité sur la security n'est **pas** l'éligibilité sur la position ; c'est
l'inverse qui fait la démo. Correctif : « the share issuance carries its own `DomainID`, so lender
eligibility is enforced on the share position by the permissioned domain, independently of the
security's require-auth gate: a holder needs both. » L'ACTION-LIST B7④ le disait déjà.

---

## 2. Non sourcé

Affirmations que je n'ai pu rattacher à aucune spec, doc, fichier rippled ou hash. Fausses jusqu'à
preuve du contraire.

| # | Où | Affirmation | Ce que j'ai trouvé |
|---|---|---|---|
| N-1 | `DEVELOPER-REPORT.md:197` | « Lending transactions are excluded from `Batch` at compile time, **a mitigation for a counterparty-signature bypass** » | L'exclusion existe : `include/xrpl/tx/transactors/system/Batch.h:60-76` `kDisabledTxTypes`, refus `temINVALID_INNER_BATCH` dans `Batch.cpp:290-295`. C'est un preflight à l'exécution, pas du compile-time. **Aucun commentaire ni PR ne lie la liste à un bypass de signature.** Le bypass documenté dans #8162 a été corrigé par les préfixes, pas par cette liste. Et **rippled #6360 « feat: Support lending in batch »** (a1q123456) est ouverte depuis le 12 février : même schéma que F-018. |
| N-2 | `DEVELOPER-REPORT.md:200` | « Around forty result codes returned by the lending transactors appear on no reference page » | Côté docs : les 15 pages Vault*/Loan* ont toutes une table « Error Cases » ; sur les 25 codes qu'elles nomment, **3** manquent dans `tec-codes.md` (`tecLIMIT_EXCEEDED`, `tecLOCKED`, `tecWRONG_ASSET`). Si « forty » compte les codes émis par les transactors, le dénominateur n'est nulle part dans le dépôt. |
| N-3 | `DEVELOPER-REPORT.md:197` | « a Ripple product manager publicly describes repo settlement built on co-signed atomic batches » | Source dans `docs/research/jury-and-social.md:77-79` : une citation Discord attribuée à « Shota ». Non vérifiable par un lecteur, pas de lien. Soit un lien public, soit retirer la clause. |
| N-4 | `DEVELOPER-REPORT.md:150`, F-007 | « The author of the specification named the cause himself in XRPL-Standards discussion #589 » | La citation existe, mot pour mot, mais c'est un **commentaire** de Tapanito (co-auteur de XLS-66 avec Aanchal Malhotra) sur la discussion **« Amendment XLS: On-Chain Cosigner »** de shawnxie999. Écrire « the XLS-66 co-author, commenting on #589 ». |
| N-5 | `README.md:101`, F-014 | « the rate, not the balance, decides what the cover absorbs » | `LoanManage.cpp:150-170` : `min(tenthBipsOfValue(minimumCover, coverRateLiquidation), totalDefaultAmount)` **puis** `min(covered, coverAvailable)`. Le solde borne aussi. « the rate decides first » est exact ; « not the balance » ne l'est pas. |
| N-6 | `DEVELOPER-REPORT.md:195` | « `VaultWithdraw` in assets under-delivers one unit … asked 500000 got 499999 » | Aucun hash dans le rapport ni dans le friction log ; `docs/research/mpt-vault-asset.md:272` le raconte sans hash. Un hash ou rien. |
| N-7 | `DEVELOPER-REPORT.md:32` | « The same defect ships in Ripple's own reference application, `ripple/xrpl-reference-app-lending-sav`, which pins `xrpl@4.6.0` » | Le pin `^4.6.0` est vérifié (`package.json:31`). Que 4.6.0 ait `signLoanSetByCounterparty` **et** signe sans préfixe n'est démontré nulle part dans le dépôt. Plausible, non vérifié : dire « pins a pre-#8162 library ». |
| N-8 | `DEVELOPER-REPORT.md:86`, ligne 3 | « `VaultWithdraw` … false since `fixCleanup3_4_0`: the destination is checked » | Vrai pour un **tiers** : `VaultWithdraw.cpp:220-247` vérifie le domaine si `dstAcct != account && dstAcct != issuer`. Un retrait vers soi reste hors domaine, donc A.2 reste exact pour le cas nominal. Préciser « a third-party destination ». |
| N-9 | `DEVELOPER-REPORT.md:144` | « `LoanSet` is refused `tecNO_PERMISSION` when the amortisation schedule would end after `RedemptionDate` » | `LoanSet.cpp:334-341` : `finalPayment + kLoanRedemptionBuffer > RedemptionDate`, buffer = **60 s** (`Protocol.h:357`). « ends within 60 seconds of » plutôt que « after ». Nuance, pas erreur. |
| N-10 | `README.md:124` | `LoanPay` : « the borrower returns the securities **and the fee** » | Méta de `DDD61141` : la fee de 100 000 est prélevée **à l'origination** (emprunteur +1 900 000, agent +100 000). `71DE04C6` paie 2 000 001 = principal + 1 unité d'intérêt. La fee ne revient pas au LoanPay. |

Tout le reste des affirmations techniques du rapport a une source, listée en section 5.

---

## 3. À corriger si le temps le permet, du moins cher au plus cher

1. **`docs/review/repo-hygiene.md` H-1 et H-2** : résolus, vérifié. `ghost.css` 1 660 lignes, `DEMO_VAULT`
   pointe sur un vault qui tient (5 000 000 / 1.000000 / 40,0 %). H-3 à moitié : `read-vault.mjs:245`
   corrigé, **`demo.mjs:182` et `default-arc.mjs:86` gardent `assets / shares`**. Trois lignes.
2. **Labels d'impairment inversés** (S-3 de repo-hygiene, toujours ouvert) : `default-arc-cover*.json`
   et donc `docs/ON-CHAIN.md` lisent « LoanManage impair (too early) → tesSUCCESS » puis « LoanManage
   impair → tecNO_PERMISSION ». Quatre chaînes JSON à éditer, puis `gen-onchain-inventory.mjs`.
3. **`README.md:97`** : « impaired … price per share 1.00 » est le chiffre naïf que le rapport appelle
   un bug. Ajouter une colonne « NAV per share 0.60 » ou une note.
4. **`SUBMISSION.md:15`** : « Security issue reported privately to a mentor … the borrower eligibility
   gap » contredit `PLAN.md` et F-018 (rien à divulguer). `:14` deck non coché alors que
   `docs/PATAPIM-DECK.pdf` existe, 9 pages, ≤ 10.
5. **PR #1342, formulation des tests** : le corps dit « four suites passing » avec quatre puces ; le diff
   ajoute **zéro** nouveau `it`, les quatre scénarios sont des assertions dans le test `search values`
   existant (le fichier avait déjà 4 `it`). Vrai mais trompeur ; le rapport dit « Four tests ». Écrire
   « four scenarios covered in the existing suite ». Tout le reste de la PR tient (section 5).
6. **Le serveur sur `:3000`** est un `next-server` lancé à 22:26, avant le revert de 22:37 : il sert
   un build sans `web/public/reference/` (logo `ghost.svg` 404, frames 404). Le build actuel sur
   `:3100` sert tout en 200. Redémarre-le avant toute démo locale.
7. **`package.json`** : `"xrpl": "^5.2.0-beta.0"` accepte `5.2.0` stable, qui n'a pas `VaultKind` ;
   seul le lockfile tient la beta.0. Épingler `"5.2.0-beta.0"`. `README.md:166` « xrpl.js and the
   codec, nothing else » : il y a aussi `ripple-keypairs`.
8. **Codes de résultat déformés à l'écran** : la carte « Ledger rules » affiche `TECEXPIRED` et
   `TECTOO_SOON` (text-transform CSS sur `.live-status`). Un juge qui connaît `tecEXPIRED` tique.
   `text-transform: none` sur les codes. « 61438s to next phase » : secondes brutes, formater.
9. **Français résiduel** dans la sortie des scripts : `demo.mjs:156-157`, `gen-onchain-inventory.mjs:88`,
   `recall-spine.mjs:162`, `default-arc.mjs:130` (qui annonce en plus un fichier qu'il n'écrit pas).
   `default-arc.mjs:111` attend `'REJECT_OR_OK'`, donc imprime `DIFF` même quand tout va bien.
10. **Rapport** : « `LoanSet::preclaim` », « `transactions.macro` », etc. sont justes, mais les chemins
    `src/xrpld/app/tx/detail/…` cités dans `docs/research/` sont périmés : les transactors sont sous
    `src/libxrpl/tx/transactors/{vault,lending,system}/` à `9403736`.
11. **`Number()` sur les montants** (`web/lib/ledger.ts:112-115`, `vault-presentation.ts`) : sûr pour la
    démo, faux au-delà de 2^53 sur un MPT à `AssetScale: 0`. Une phrase dans le code suffit.
12. **Schémas de couleur** : l'app déclare `color-scheme: dark` et n'a aucune variante claire. Ce n'est
    pas un défaut, mais l'item « both colour schemes » du brief ne peut pas être « passé » : il faut
    l'écrire « the app commits to one dark palette ». Le 400 px est couvert par le test 6 de Playwright.
13. **Le brief lui-même** : `grep -rn "Date.now" scripts/ web/lib/` ne peut pas « return nothing » :
    trois hits sont des chronos d'affichage (`recall-spine.mjs:30-31`, `probe-t2.mjs:18-19`) et un
    est `nowRipple` exporté et jamais appelé. Aucune décision de phase ne les utilise, l'item est
    satisfait sur le fond, la commande est mal écrite. Écrire « must return only elapsed-time logging ».

---

## 4. Le wallet connect

Réponses aux six points, puis verdict.

**1. La bibliothèque est-elle bien la leur, et vivante ?** Oui. `XRPL-Commons/xrpl-connect`,
organisation XRPL Commons, MIT, créé 2025-10-15, `pushed_at` 2026-09-11, 9 contributeurs, 23 étoiles.
npm : publié par `xrpl-commons-admin <dev@xrpl-commons.org>`, `repository` pointe sur le dépôt.
**Mais** `0.8.2` (2026-05-21) est `latest`, pas la plus récente : `1.0.0-rc.2` (2026-09-08) est sous
le tag `rc`, et le paquet React `@xrpl-commons/xrpl-connect-react@1.0.0-rc.0` exige `xrpl-connect
^1.0.0-rc.2`, pas 0.8.2. ≈210 téléchargements/semaine : petit, actif.

**2. Devnet, dans les adaptateurs ?** Partiellement, et la version change la réponse.
`packages/core/src/types.ts:56-62` définit `devnet` avec `wss://s.devnet.rippletest.net:51233/` et
`rpc :51234` : le bon endpoint. Dans **0.8.2** (`main` à `01ce8a66`), `crossmark-adapter.ts:69-91` et
`gemwallet-adapter.ts:73-88` font `resolveNetwork(options?.network)` et **enregistrent** la valeur sans
interroger le wallet ni le basculer : si l'extension est sur testnet, l'app croit être sur devnet. C'est
l'issue #179, fermée par la PR #186. Dans **rc.2 / `develop` à `a45d7216`**, `getLiveNetwork()`
interroge le wallet (`crossmark-adapter.ts:210-241`, `gemwallet-adapter.ts:197-214`) et lève
`NETWORK_MISMATCH` si ça diverge (`:132-134`, `:116-120`). Aucune version ne **bascule** le wallet :
le juge choisit Devnet dans l'extension lui-même (PR #98 « runtime network switching » ouverte).
`docs/guide/wallets.md:77` liste `devnet` comme valeur supportée ; le README ne montre que `testnet`.

**3. Import de seed dans l'extension.** GemWallet : oui, source officielle,
`gemwallet-extension/packages/extension/src/pages/AddNewWallet/ImportNewWallet/ImportSeed.tsx:20-36`,
et Devnet est un réseau natif (`network.constant.ts:6-25`, `DEVNET_NODES =
['wss://s.devnet.rippletest.net:51233']`). Crossmark : Devnet oui (`docs.crossmark.io/faq`, typings
`NetworkTypes.devnet`) ; l'import par family seed n'est **pas dans docs.crossmark.io**, seule une
source secondaire l'affirme (AMA RippleX, dev.to, 2023 : « family seed, secret numbers… »). À tester
en cinq minutes avant d'écrire une ligne.

**Le risque que la doc ne lève pas, et qui décide de tout.** Une extension signe et encode avec **sa
propre** copie de xrpl.js / binary-codec. `VaultDeposit` (type 67) avec un `Amount` MPT n'est encodable
qu'avec un codec qui connaît le Single Asset Vault et les MPT. GemWallet : dernière release v3.8.2 le
**2024-12-11**, dernier commit `master` 2025-04-21 : antérieur au SAV. Si son codec ne connaît pas le
type, `submitTransaction` échoue dans l'extension, quel que soit xrpl-connect. Crossmark : source
fermée, version du codec inconnue. **Je ne l'ai pas vérifié, personne ne l'a vérifié dans vos notes, et
c'est le point qui tue le plan.** Test avant tout code : importer une seed faucet dans GemWallet, passer
sur Devnet, dans la console `await GemWalletApi.submitTransaction({transaction: {TransactionType:
'VaultDeposit', Account, VaultID, Amount:{mpt_issuance_id, value:'1'}}})`. Idem Crossmark
`signAndSubmitAndWait`. Un `tecNO_AUTH` avec hash = ça marche ; une erreur locale = mort pour ce wallet.

**4. Coût sur « lecture seule ».** `signAndSubmit()` ne fait que déléguer au wallet et rend `{ hash }`
(`wallet-manager.ts:600-616`, `crossmark-adapter.ts:346-356`, `gemwallet-adapter.ts:315-326`) : pas
d'autofill à toi, pas d'attente de validation, **pas de `meta.TransactionResult`**. `web/` ne détient
donc toujours rien et ne soumet rien : c'est le wallet qui soumet à son nœud. La propriété tient, à
condition d'ajouter une route de lecture `/api/tx/[hash]` qui interroge `tx` jusqu'à `validated` et
rend le code. Attention : je n'ai pas établi que les extensions renvoient un hash pour un `tec`
plutôt qu'une erreur ; c'est dans le test du point 3.

Où mettre les deux seeds : **pas dans `web/`**, pas dans `docs/evidence/`, pas dans le README.
Un fichier unique `docs/DEMO-ACCOUNTS.md`, titre « Devnet test accounts, published on purpose »,
une table `rôle | adresse | seed | credential | ce que le ledger répond`, une ligne « test XRP and a
fictitious security only, re-fund at faucet.devnet.rippletest.net ». Item 4 du brief à reformuler :

> `git grep -nE "\bs[Ee]d[A-Za-z0-9]{27,}" -- . ':!docs/DEMO-ACCOUNTS.md'` doit rendre vide, et
> `git grep -c "sEd" -- web/` doit rendre 0. Les deux seeds de `DEMO-ACCOUNTS.md` doivent
> correspondre aux deux adresses de la table, et à rien d'autre dans l'historique.

Deux conséquences à décider : (a) quiconque a la seed du compte credentialisé peut déposer dans
`FAB518C7` et changer les chiffres du hero pendant le pitch, ou vider le XRP de réserve ; credentialise
un compte sur un **second** vault « sandbox », pas sur le vault vivant. (b) Un `VaultDeposit` du juge
en phase Investment rend `tecEXPIRED`, pas `tesSUCCESS` : le vault sandbox doit être en Subscription
pendant le créneau, ou le scénario devient « le ledger vous refuse pour la bonne raison ».

**5. Réimplémente-t-on quelque chose qu'ils fournissent ?** Ce qu'il ne faut pas écrire : la détection
des extensions, les ponts `window.crossmark` / `GemWalletApi`, l'état compte/réseau, la modale de
choix (`<xrpl-wallet-connector>` web component, `packages/ui`), le provider et les hooks React
(`XrplConnectProvider`, `useWallet`, `useSigner`, `packages/react`). Ce qu'ils **ne** fournissent pas et
que tu écriras : le polling du résultat, la construction du `VaultDeposit`, l'affichage du code. Peer
deps : 0.8.2 n'en déclare aucune ; rc.2 exige `xrpl ^3 || ^4` ; `develop` (PR #195, 2026-09-09)
ajoute `^5` mais **exclut les pré-releases**, donc `5.2.0-beta.0` ne satisfera jamais le peer range.
`web/` n'a pas `xrpl` en dépendance aujourd'hui (le serveur parle JSON-RPC nu), donc pas de conflit,
mais npm installera un `xrpl@4` inutile comme peer.

**6. Ce que le code actuel rend difficile.** `ghost-app.tsx` est un seul composant client de 650
lignes ; la connexion wallet doit vivre **au-dessus** de `GhostEntry`, sinon `key={id:holder}` la
remonte et déconnecte à chaque changement de vault. `presentVault` ne renvoie que des chaînes
formatées : il manque `Asset.mpt_issuance_id` brut, `AssetScale`, `DomainID`, pour construire une
transaction ; ajoute-les au `VaultSnapshot`. Le `<dialog>` natif et la modale xrpl-connect se
disputent le top layer : ferme l'un avant l'autre. `use-vault` diffère le fetch si `document.hidden` :
après un dépôt, appelle `refresh()` explicitement. SSR : la lib est importable côté serveur, mais
provider et UI exigent `'use client'` et, pour Crossmark, un `dynamic(..., { ssr:false })` comme
`GhostApp`. Ce qui casse si c'est mal fait : mettre `Wallet` ou `xrpl` côté serveur (grep du brief),
laisser le compte connecté dans l'URL (`?holder=`) et le confondre avec la position lue.

**Verdict.** L'approche « deux comptes pré-provisionnés, le juge signe dans son extension, `web/`
reste sans clé » est la bonne **par rapport à** une route qui signe avec la seed de l'agent. Mais elle
repose sur une hypothèse non vérifiée : que Crossmark et GemWallet encodent un `VaultDeposit` MPT. Si
le test du point 3 échoue sur les deux, le plan naturel avec **leurs** outils est le B ci-dessous ;
si ça passe sur l'un, prends **rc.2** (réseau vérifié, `NETWORK_MISMATCH`), pas 0.8.2.

Liste ordonnée, si le test passe :

| # | Étape | Source officielle |
|---|---|---|
| 0 | Test manuel `VaultDeposit` via GemWallet API et Crossmark sur Devnet avec une seed faucet | `gemwallet.app/docs/api/gemwallet-api-reference` (`submitTransaction` → `{hash}`), `docs.crossmark.io/sync/signAndSubmit` |
| 1 | Provisionner le vault sandbox et les deux comptes avec `demo.mjs`-like ; publier `docs/DEMO-ACCOUNTS.md` ; reformuler l'item 4 | `CredentialCreate`/`CredentialAccept`, `PermissionedDomainSet` : xrpl.org references, déjà exercés (`637B18C4`, `BCC0A216`) |
| 2 | `npm i xrpl-connect@1.0.0-rc.2` dans `web/`, `WalletManager({ network: 'devnet', adapters: [crossmark, gemwallet] })` | `packages/core/src/types.ts:56-62`, `docs/guide/wallets.md:77` |
| 3 | Provider au-dessus de `GhostEntry`, UI en `'use client'` + `dynamic({ssr:false})` | `docs/guide/frameworks/react.md:176-178` |
| 4 | Route `/api/tx/[hash]` : `tx` en boucle jusqu'à `validated: true`, rend `meta.TransactionResult` | xrpl.org `tx` method reference ; même pattern que `web/lib/ledger.ts` |
| 5 | Formulaire dépôt : `VaultDeposit` avec `Amount: { mpt_issuance_id, value }` depuis le snapshot enrichi | xrpl.org `vaultdeposit.md` ; `Flags` absent (« no flags defined », `:71`) |
| 6 | Afficher `tesSUCCESS` / `tecNO_AUTH` / `tecEXPIRED` avec lien explorer ; `refresh()` du snapshot | `PHASE_RULES` déjà en place |
| 7 | Mettre à jour `AUDIT-CHECKLIST.md` §3b « There is no wallet connect » → « the wallet signs, `web/` never holds a key » | |

Plan B si les extensions n'encodent pas `VaultDeposit` : le juge génère un compte au faucet **dans son
navigateur** (`faucet.devnet.rippletest.net/accounts` renvoie la seed au client), signe dans le
navigateur avec `xrpl@5.2.0-beta.0` (`Wallet.fromSeed` côté client uniquement) et soumet au websocket
devnet public depuis la page. Aucune clé ne touche `web/` ni Vercel ; le compte est jetable ; le codec
connaît tout. Le `tecNO_AUTH` est immédiat ; le `tesSUCCESS` demande que l'agent credentialise
l'adresse fraîche, donc un compte pré-credentialisé reste nécessaire pour ce chemin. C'est moins
« wallet connect », c'est plus sûr d'arriver à 12:30.

---

## 5. Vérifié et solide

Ce sur quoi tu peux t'appuyer devant le jury, avec la source.

**Hashes et réseau**
- Les **31 hashes** du README et de `ON-CHAIN.md` résolvent sur le devnet public, `validated: true`,
  type et code exacts, dont `30C4B86F` → `VaultDeposit tecNO_AUTH`, `E4F68FB0` → `tecEXPIRED`,
  `32077697` → `tecTOO_SOON`, `3C01AF18` → `LoanSet tecEXPIRED`, `03933F6D`/`C9F00989` →
  `LoanManage tecNO_PERMISSION`. 0 mismatch (script `verify.py`, `server_info` network_id 2).
- Hashes du rapport hors tableau : `DD751B83` `LoanBrokerSet tecNO_PERMISSION` public ;
  `D5879394` `VaultWithdraw tecINSUFFICIENT_FUNDS` public ; `784DA553` `LoanSet` public, méta :
  emprunteur 10 000 000 → 11 900 000, propriétaire du broker 9 500 000 → 9 600 000, `AssetsTotal`
  intact, `DebtTotal` 0 → 2 000 000 : **F-016 tient à l'unité**. `59496BAE`, `42BDEBF8`, `553C31E8`
  sur le devnet custom, `tesSUCCESS` tous trois.
- `71DE04C6` `LoanPay` : `Amount 2000001`, `tfLoanFullPayment`, vault pseudo-account 3 000 000 →
  5 000 000, `TotalValueOutstanding` 2 000 001 → supprimé. `05F9AF64` `EscrowCreate` porte
  `FinishAfter` **et** `CancelAfter`, `Destination` = agent ; `7CE7D679` `EscrowCancel` passé :
  la ligne « held bilaterally / released back » du README est vraie.
- `2FAB3F9D` `VaultWithdraw` : `Amount` = `{ mpt_issuance_id: <ShareMPTID>, value: '5000000' }`,
  `OutstandingAmount` 5 000 000 → 0 : **libellé en parts**, comme le brief l'exige.
- Les cinq hashes du deck résolvent avec le bon code.

**Amendements et réseaux** (RPC `feature` sur les deux nœuds, ce soir)
- Public : 89 activés ; custom : 48. `LendingProtocol`, `LendingProtocolV1_1`, `SingleAssetVault`,
  `PermissionedDomains`, `Credentials`, `fixCleanup3_4_0`, `MPTokensV1`, `TokenEscrow`, `BatchV1_1`,
  `PermissionDelegationV1_1`, `Sponsor` : **activés sur les deux**. `TicketBatch` : activé public,
  non activé custom. `LendingPermissionedDomain` : **absent des deux listes**. Finding 3 et F-018
  tiennent mot pour mot. `build_version` `3.4.0-rc5` / `3.4.0-rc1` : conformes.

**Finding 1, la signature** (tarballs npm)
- `xrpl-5.2.0-beta.0/src/Wallet/counterpartySigner.ts:96` → `computeSignature(tx, wallet.privateKey)` ;
  `xrpl-5.2.0/…:97-102` → `computeSignature(tx, wallet.privateKey, undefined, 'counterparty')`.
  `utils.ts` stable ajoute `SignatureRole` et `SIGNING_ENCODERS.counterparty.single =
  encodeForSigningCounterparty` ; la beta.0 n'a pas de `role`. `ripple-binary-codec@2.11.0/dist/index.js:102`
  exporte `encodeForSigningCounterparty` ; beta.0 dépend de `^2.11.0-beta.0`, stable de `^2.11.0`.
- `scripts/lib/lending.mjs:65-74` `signCounterparty()` appelle `encodeForSigningCounterparty(tx)` du
  codec, jamais `encodeForSigning` ; `submitLoanSet()` signe `decode(signed.tx_blob)` (`:81`), pas
  `prepared`. C'est bien **leur** encodeur, importé du codec qu'ils publient : rien d'inventé.
- rippled #8162 « fix: Add signature prefixes for sfCounterpartySignature and sfSponsorSignature »,
  mvadari, mergé **2026-09-03T18:06Z** ; préfixes `CPT/CPM/SPN/SPM` dans
  `include/xrpl/protocol/HashPrefix.h:96-114` ; garde `fixCleanup3_4_0` dans
  `src/libxrpl/protocol/Sign.cpp:54-72`.
- Stable `5.2.0` : zéro occurrence de `VaultKind`/`SubscriptionDate` sous `src/models` ; beta.0 et
  beta.1 les ont. `LoanSet` absent de `txToFlag` (`src/models/utils/flags.ts:118`) dans les trois
  versions : la ligne « client libraries » de la table est exacte.

**Protocole, contre rippled `develop` à `9403736`**
- Flags : `lsfVaultPrivate 0x00010000`, `lsfLoanDefault 0x00010000`, `lsfLoanImpaired 0x00020000`
  (`LedgerFormats.h:201-207`) ; `tfLoanDefault/Impair/Unimpair` `0x00010000/0x00020000/0x00040000`
  (`TxFlags.h:223-226`). `web/lib/ledger.ts:145-146` et `demo.mjs:32` sont justes.
- Types : `LoanBrokerSet 74 … LoanSet 80, LoanDelete 81, LoanManage 82, LoanPay 84`
  (`transactions.macro:890-1023`) ; XLS-66 `README.md:1347` dit **83** pour LoanPay. Ligne 1 exacte.
- `VaultClawback.cpp:196-204` ne teste que `lsfMPTCanClawback` ; XLS-65 `:700-702` liste aussi
  `lsfMPTCanLock`. Ligne 2 exacte.
- Gates de phase : `LoanSet.cpp:319-343` (`tecTOO_SOON` en Subscription, `tecEXPIRED` en Redemption,
  `tecNO_PERMISSION` si `finalPayment + 60 s > RedemptionDate`), `VaultDeposit.cpp:110-118`
  (`tecEXPIRED`), `VaultWithdraw.cpp:90-97` (`tecTOO_SOON`). Horloge : `View.cpp:49-63` `hasExpired`
  sur `view.parentCloseTime()`. `PHASE_RULES` de `ledger.ts` et `ledgerClock()` sont conformes.
- `LoanManage.cpp:294-300` : impairment dès `NextPaymentDueDate` (`isPaymentLate`, sans grâce,
  `LendingHelpers.cpp:173-180`) ; déjà impairé → `tecNO_PERMISSION` (`:89-93`) ; défaut exige
  `NextPaymentDueDate + GracePeriod` (`:106-115`). F-015 exact.
- `LoanSet.cpp:546-548, 612-647` : `originationFee` va au **propriétaire** du broker, principal moins
  fee à l'emprunteur. F-016 exact.
- Délégation : aucune entrée Vault*/Loan* de `transactions.macro:774-1023` ne pose `.delegable`
  (défaut `NotDelegable`, `:21-26`) ; `permissions.macro` : 12 permissions, aucune lending.
- `ledger_entries.macro:501-520` : `AssetsTotal`, `AssetsAvailable`, `LossUnrealized`, `VaultKind`
  en `SoeDefault`. « Absent means zero » et `?? 0` dans `ledger.ts:112-115` sont justes.
- `vault_info` existe (`Handler.cpp:353`, `VaultInfo.cpp:78-119`) et ne renvoie ni NAV ni prix.
- Closed-ended : `VaultKind/SubscriptionDate/RedemptionDate` présents dans rippled, **absents** de
  XLS-65 `master` et de XRPL-Standards hors PR #587 (ouverte 2026-07-21). Ligne 5 exacte.
- XRPL-Standards #484 ouverte depuis 2026-02-26 (Tapanito), rippled #6517 ouverte depuis 2026-03-10
  (a1q123456, 18 fichiers), `XRPL_FEATURE(LendingPermissionedDomain, Supported::No,
  VoteBehavior::DefaultNo)`, contrôle `credentials::validDomain` dans `LoanSet::preclaim` derrière
  `lsfLoanBrokerPrivate`. **F-018 est exact sur chaque point**, y compris « open since March 2026 »
  (mis à jour 2026-09-09 et 2026-09-01, ni l'une ni l'autre mergée).

**Documentation, contre xrpl-dev-portal à `dc29bc4`**
- `single-asset-vaults.md:56-92` : section « Exchange Algorithm », les deux formules et l'exemple 1,0 M /
  900 k. `vault.md:59,62` définit `AssetsTotal`/`LossUnrealized` sans lien vers elle.
  `lending-protocol.md:92-94` : `DefaultCovered = min((DebtTotal x CoverRateMinimum) x
  CoverRateLiquidation, DefaultAmount)`, exemple 1 090 / 10 % / 10 % → 10,9. `loanbrokerset.md:46-52` :
  sept champs, pas de `DomainID`, rien sur l'emprunteur. `loanbroker.md:71` : `CoverRateMinimum`
  sans mention du plafond. `loanmanage.md` : rien sur impair vs grâce. `loanset.md:65` : fee « paid to
  the LoanBroker owner », payeur non dit. **559** fichiers `.md` sous `docs/`, zéro occurrence de
  `VaultKind`. `ripple/lending-demo` → 404 ; xrpl.org ne l'a jamais lié ; le portail lie
  `xrpl-reference-app-lending-sav` (`sections.config.ts:105`), qui pin `xrpl ^4.6.0`.

**Le dépôt et l'app**
- Aucune seed dans l'arbre de travail (`git ls-files | xargs grep -E "\bs[Ee]d[A-Za-z0-9]{27,}"` :
  vide), aucune dans `docs/evidence/*.json` (`standing-demo.json` est bien écrit sans `seeds`).
  Historique : seeds devnet dans `49caa01` et `82f68dd` uniquement, comptes jetables, connu, redressé
  ensuite ; je ne réécrirais pas l'historique à cette heure.
- `.xrpl-devex/`, `.demo/`, `.claude/settings.local.json` ignorés et non suivis ; 221 fichiers suivis,
  aucun dot-dir. `web/` : zéro `Wallet`, zéro `fromSeed`, zéro `submit(`, zéro `seed` dans `app/` et
  `lib/`. Le navigateur n'appelle que `/api/vault/[id]` (test 1 Playwright vérifie qu'aucune
  requête ne part vers `rippletest.net`).
- `npm install && npm run build` dans `web/` : succès, 5 routes, aucune route morte
  (`/`, `/vault/[id]`, `/api/vault/[id]`, `/icon.svg`, `/_not-found`). Lockfile racine épinglé
  `xrpl 5.2.0-beta.0`, `ripple-binary-codec 2.11.0`, `ripple-keypairs 2.0.0` ; installés identiques.
- L'app servie (`:3100`), forcée visible : landing en `data-phase="ready"`, `data-ledger-state="ready"`,
  logo chargé (`naturalWidth > 0`), liens `Skip to app` et `Open app` → `/vault/FAB518C7…`, brand → `/`,
  canvas `aria-label` explicite. Dashboard : 9 cartes, chacune ouvre son dialog avec les bonnes
  lignes ; onglets Vault/Loans/Rules ; recherche métriques (« cover » → 1 carte) et prêteurs (« zzz »
  → « No loans match this search. ») ; sélecteur de vault : `pattern` refuse `not-a-vault` et un holder
  `xyz`, formulaire invalide ; « Refresh ledger » ; provenance : 5 appels avec leur JSON ; liens
  explorer sur l'emprunteur et le propriétaire.
- Chemins d'erreur : `/api/vault/zzz` → **400** « Enter a 64-character vault ID… » ; holder malformé →
  400 ; vault inconnu → **502** « ledger_entry: Entry not found. » ; `fetch` coupé puis Refresh →
  bandeau `role="alert"` « Refresh failed. Showing the last successful ledger snapshot. », horloge
  **STALE SNAPSHOT**, `data-ledger-state="error"`, note « Last successful snapshot » dans le dialog ;
  Retry → « VALIDATED LEDGER », bandeau retiré. Aucun chiffre périmé présenté comme live.
- **L'explorer est d'accord avec nous** sur `FAB518C7` : TVL 5,00 M, disponible 3,00 M, broker debt
  2,00 M / max 4,00 M / FLC 2,50 M / cover rates 100 %, prêt `Current`, private vault YES, `Data`
  décodé `term_days 90`. Seules divergences : « UNREALIZED LOSS -- » chez eux contre `0` chez nous
  (absent = zéro, déjà notée dans `CONTRIBUTION-explorer-search.md`), et la règle défaut-terminal de
  `loanStatus()` qui ne s'exerce pas sur ce prêt. Rien d'autre.
- Dashboard contre ledger : `assets 5 000 000`, `available 3 000 000`, `pricePerShare 1.000000` =
  `(5 000 000 − 0) / 5 000 000` avec `OutstandingAmount` lu sur l'émission de parts, `utilisation
  40,0 %`, `cover 2 500 000`, `debt 2 000 000`, loan `owed 2 000 183`, `due 2026-09-13T12:24:12Z`.
  Tout coïncide avec `ledger_entry` brut à la même minute.
- Titre `patapim, securities lending native on the XRP Ledger`, favicon `/icon.svg` (pas le triangle).
- `docs/reference/PHANTOM.md` et `FRONTEND-SOURCE.md` disent d'où vient l'art direction, que
  « l'accessibilité publique n'établit pas une licence de redistribution » et que « le dépôt ne
  revendique pas la propriété des créations de Phantom » ; `INTEGRATION.md` distingue ce qui est
  réécrit ; `shaders.ts:2` cite la provenance. La police est sous OFL avec sa licence à côté. Rien
  n'est attribué à l'équipe qui ne le soit.
- Aucun `localhost`, aucun `example.com` dans les quatre .md racine et `ON-CHAIN.md` (`localhost:3000`
  n'apparaît que dans le bloc « Getting started », attendu). Les 61 liens explorer répondent 200 et
  les objets nommés existent ; les deux profils GitHub, les PR #1342, #484, #6517 résolvent ; le
  lien npm renvoie 403 à `curl` (anti-bot) mais la version existe (`npm view`). Un seul 404 : le badge
  XLS-66, corrigé (voir plus bas).

**La contribution, ripple/explorer#1342**
- Ouverte, non mergée, `mergeable: true`, `mergeable_state: blocked` (deux revues requises, pas un
  conflit). Base `main` à `0232381` = merge-base : **fast-forward propre**. 3 fichiers, +107/−21,
  **pas de `package-lock.json`**. À la tête de la PR : `jest --env=jsdom --ci
  src/containers/Header/test/Search.test.js` → **4 passed** ; `eslint --max-warnings 0`, `prettier
  --check`, `tsc --build` : exit 0. `main` ne contient toujours pas d'équivalent (`Search.tsx` sur
  `main` : aucun `LoanBroker`/`getLedgerEntry`), et le gap est toujours vivant : ce soir
  `devnet.xrpl.org/search/1D463015…5BB8` (notre prêt) → « NOT FOUND ». Le compte de requêtes est
  vérifié dans le diff : 1 pour un Vault et un LoanBroker, 2 pour un Loan, comme le corps de la PR
  le dit. Le `default` du `switch` lève et retombe en not-found ; test avec un nœud
  `PermissionedDomain` présent. Semgrep vert ; la seule revue humaine est un « Better now? ».

---

## Corrections appliquées par moi, à relire

Triviales et sans risque, hors `scripts/lib/lending.mjs`, config réseau et chiffres publiés.

1. `README.md:11` : lien du badge XLS-65/66 `https://xls.xrpl.org/xls/XLS-0066` (404) →
   `https://xls.xrpl.org/xls/XLS-0066-lending-protocol` (200, c'est l'URL que xls.xrpl.org sert).
2. `.gitignore` : `.DS_Store` ajouté (deux fichiers traînaient en `??`).
3. `docs/review/FABLE-REPORT-CUT.md` : ma proposition de rapport à 1 554 mots (B-3). C'est un brouillon
   à toi de relire, pas un remplacement ; supprime-le si tu ne le prends pas.
4. `docs/design/live/*.png` : réécrits par la suite Playwright que j'ai lancée, **restaurés** à HEAD.

Non touché, à trancher par toi : tout le reste des sections 1 à 3, `standing-demo.json`, les
evidence JSON, le deck, `SUBMISSION.md`. Une transaction devnet créée par moi pour B-6, sur un compte
faucet jetable, hash `8D50A1D9…F93D`.
