# patapim : le prêt de titres, natif sur le XRP Ledger

**XRPL Lending Protocol Hackathon, Paris, septembre 2026 · Track 2, vaults à terme fixe · XRPL Devnet public**

App : https://patapim-gamma.vercel.app · Vidéo : https://youtu.be/rl5IiE9Bn8A · Code : https://github.com/gamween/patapim · Équipe : Sofiane Ben Taleb (@gamween), Armand Séchon (@STOOOKEEE)

## Le problème

Les bons du Trésor et les fonds monétaires tokenisés arrivent sur les ledgers publics, et leurs
détenteurs ne peuvent que les conserver. Sur les marchés traditionnels, le prêt de titres en mandat est
ce qui fait travailler un portefeuille : un agent prête les titres à des teneurs de marché contre une
rémunération et se porte garant auprès des prêteurs. On-chain, pour des titres réglementés, ce marché
n'existe pas encore.

## Ce que fait patapim

Un agent prêteur gère un **fonds à terme fixe** dont l'actif est le titre lui-même.

| Étape | Ce qui se passe | Primitive XRPL |
|---|---|---|
| Souscription | Les détenteurs éligibles déposent le titre et reçoivent des parts du fonds | Single Asset Vault à terme fixe (XLS-65), Credentials, Permissioned Domain |
| Capital de première perte | L'agent apporte du capital, dans le même titre, qui absorbe les défauts en premier | Couverture du loan broker (XLS-66) |
| Prêt | Un teneur de marché emprunte les titres pour une durée fixe ; l'agent et l'emprunteur signent tous les deux | `LoanSet` à deux signatures |
| Collatéral | L'emprunteur dépose un collatéral en cash à 102 % de la valeur du prêt, valorisé par un oracle on-ledger | Escrow d'un MPT, Price Oracle |
| Restitution | L'emprunteur rend les titres avec la rémunération ; les prêteurs en gardent 90 % | `LoanPay`, frais de gestion |
| Défaut | Passé le délai de grâce, le capital de l'agent rembourse le fonds | `LoanManage`, liquidation de la couverture |

Aucun smart contract : chaque étape est un objet natif du ledger, et chaque chiffre de l'app est lu sur
le ledger validé.

## Les conventions suivies, et d'où elles viennent

- **Rémunération en points de base par an**, comme le prêt de titres la cote : 25 bps sur le prêt de démo.
- **Partage des revenus 90/10** entre prêteur et agent : le haut de la fourchette publiée côté prêteur, et
  le maximum que le protocole autorise (`ManagementFeeRate` plafonné à 10 %).
- **Marge de collatéral de 102 %**, la marge d'usage en même devise, fixée à l'origination.
- **Capital de première perte, pas une garantie illimitée** : en cas de défaut la couverture paie
  `min(DebtTotal × CoverRateMinimum × CoverRateLiquidation, principal)`, dans la limite de ce qui a été déposé.
- **Valeur liquidative par part nette de la perte latente**, le taux de sortie de XLS-65, que Maple Finance
  utilise aussi.
- **Rendement du fonds = rémunération × taux d'utilisation × (1 − part de l'agent)**, l'identité des pools de prêt.

Chaque source est citée dans `docs/research/lending-conventions.md`.

## En ligne sur XRPL Devnet

| | Fund I, en terme | Fund II, ouvert à la souscription |
|---|---|---|
| Actifs | 5 000 000 TBL | 3 000 000 TBL, et plus |
| Prêté | 2 000 000 TBL à 25 bps, retour le 15 septembre | rien, les prêts ouvrent après la souscription |
| Capital de première perte | 2 500 000 TBL, 125 % de la dette | 2 500 000 TBL |
| Collatéral | 2 014 500,00 USDX, 102,0 % de la valeur de marché | aucun |
| Clôture / échéance | clos / 16 septembre 2026 | 16 septembre / 16 décembre 2026 |

**Signez vous-même.** Ouvrez Fund II, connectez un wallet avec xrpl-connect de XRPL Commons, ou chargez une clé
de démo Devnet dans l'onglet Sign ; les deux comptes de démo sont dans `docs/DEMO-ACCOUNTS.md`, clés sur demande. L'investisseur qui détient un credential est accepté, `tesSUCCESS` ; celui qui
n'en a pas est refusé par le ledger, `tecNO_AUTH`. C'est le wallet, ou la page avec
`xrpl.js@5.2.0-beta.0`, la bibliothèque imposée, qui signe ; le serveur ne fait que relayer la
transaction signée.

Chaque compte et chaque objet, avec un lien explorer et chacune des 76 transactions revérifiée sur le
ledger : `docs/ON-CHAIN.md`.

## Ce que la construction nous a appris

Le rapport développeur complet tient en trois pages, `DEVELOPER-REPORT.md`. Les trois constats qui ont
coûté le plus :

1. **La bibliothèque imposée ne peut pas originer un prêt.** `xrpl.js@5.2.0-beta.0` signe la signature de
   l'emprunteur avec le mauvais préfixe de hachage, donc le ledger rejette tout `LoanSet`. Nous appelons le
   codec nous-mêmes ; `5.2.0-beta.1`, publiée pendant l'événement, corrige le défaut. Reproductible hors
   ligne en une seconde.
2. **Les deux réseaux du hackathon appliquent des règles de prêt différentes** derrière les mêmes
   amendements, et rien de ce qu'un développeur peut interroger ne les distingue.
3. **Un vault à terme fixe protège le calendrier, pas la trésorerie.** Un prêt non remboursé laisse les
   prêteurs incapables de racheter leurs parts à l'échéance, et le protocole n'a pas de rappel. Nous
   proposons `tfLoanCall`, le droit de rappel que détient tout prêteur de titres.

Également : un permissioned domain filtre les prêteurs mais pas les emprunteurs (la correction est ouverte
dans XLS-Standards #484 et rippled #6517), la dépréciation ignore le délai de grâce, aucune transaction de
prêt ne peut être déléguée, et ni l'extension Crossmark ni GemWallet ne savent encore signer une
transaction de vault.

## Contribution en retour

[ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), ouverte et en attente de revue : elle fait
résoudre par la recherche de l'XRPL Explorer l'identifiant d'un loan broker ou d'un prêt vers le vault qui
le détient, là où elle répond aujourd'hui « introuvable ».

*Démonstration sur XRPL Devnet avec un titre fictif (TBL) et un token de cash fictif (USDX). Les fonds et
institutions cités sont du contexte de marché, pas des partenaires.*
