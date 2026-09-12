# Relevé de Phantom.land

Source : https://www.phantom.land/ — relevé effectué le 12 septembre 2026.

## Méthode

Lecture de la page avec agent-reach/Jina, téléchargement du HTML et des bundles publics, inspection du réseau avec Chromium/Playwright et capture du démarrage. Aucun accès authentifié. Les scripts de tracking et les clés d’intégration du site ne sont pas repris.

L’inventaire contient les URLs exactes des 34 fichiers JS/CSS initiaux, les ressources de l’intro et les références du blueprint. Les versions minifiées ont été étudiées localement, sans embarquer l’application Next.js d’origine.

## Ressources retrouvées

| Famille | Découverte | Embarqué dans le frontend |
| --- | --- | --- |
| Fantôme desktop | 55 séries × 25 WebP = 1 375 fichiers | 25 images, dans l’ordre d’une visite observée |
| Fantôme mobile | 3 séries × 25 WebP = 75 fichiers | Les 75 fichiers ; choix aléatoire par image |
| Modèle 3D | `/assets/models/dude.glb`, 166 932 octets | Oui |
| Texture des particules | `/assets/images/particle.jpg` | Oui |
| Sons | load, whoosh, swipe, click, riser | Les cinq fichiers, load/whoosh utilisés après activation |
| Grille | 3 atlas RGB, 3 masques alpha, 3 atlas de labels | Tous ; le troisième atlas RGB est une vidéo |
| Projets | 85 entrées dans le blueprint public | Les 85 entrées, avec attribution à Phantom |
| Logo | SVG public Phantom | Oui, comme repère de la référence |
| Typographie d’origine | Helvetica Now et kit Adobe observés | Inventoriée ici ; Arial et DM Mono employés dans la réécriture |

La page HTML annonce 92 projets ; le blueprint de la grille n’en expose que 85. Le prototype utilise le nombre réellement contenu dans le blueprint. Les médias pleine définition de chaque étude de cas et leurs pages détaillées n’ont pas été aspirés ; leurs liens publics figurent dans le blueprint.

Le premier passage `--all` a téléchargé 1 467 ressources avec zéro échec, pour **306 140 627 octets**. L’archive complète est locale et ignorée par Git. Chaque ressource embarquée possède son URL source, sa taille et son SHA-256 dans `downloaded-assets.json`.

## Animation observée dans le code public

Bundle de référence : `/_next/static/chunks/app/page-4f1246a9fd8e67db.js`.
Feuille de style : `/_next/static/css/439975f23e525bae.css`.

| Moment | Comportement |
| --- | --- |
| Préchargement | Barre `#1eff66`, hauteur 0,4 vh ; changement d’échelle horizontal avec une transition de 600 ms |
| Ressources chargées | Titres décalés de ±10 vw sur desktop, ±30 vh sur mobile ; déformation pendant 1 s, délai de 200 ms ; easing `(0.81,-0.01,0,1)` |
| +1 500 ms | Début de la séquence visuelle |
| 0–800 ms | Dépixellisation : 80, 70, 60, 50, 40, 30, 20, 10, 1 ; résolution de référence 1 024² |
| 800–2 600 ms | 25 images : interpolation `t³` entre deux textures successives |
| 2 500–2 900 ms | Apparition des particules, opacité 0 → 1 |
| 2 700–3 200 ms | Rotation Y 0 → 240° ; offsets X 0 → 400, Y 164 → 400, Z 60 → 1 586 |
| 2 700–3 500 ms | Groupe de l’intro avancé jusqu’à Z = 4,2, easing `power3.in` |
| 2 800–3 800 ms | Grille déplacée de Z = −2,75 vers Z = 1,45 |
| 3 100–3 800 ms | Apparition de la grille |
| 3 200 ms | Affichage de l’interface |
| 4 200 ms | Fin de l’intro |

Caméra perspective : FOV 85°, Z = 3,43. Modèle converti en points par déduplication des sommets et multiplication des coordonnées par 0,012. Bruit curl, texture de particule, mélange additif. Distorsion du rendu et vignette inspirées du post-traitement d’origine.

Les petits shaders présents dans `src/animation` ont été extraits/adaptés de cette référence, avec leur provenance conservée. La gestion des ressources, du cycle de vie, de la grille, des événements et de l’interface est une nouvelle implémentation.

## Limites et choix de cette version

- Même matériau visuel et mêmes paramètres de timing pour l’introduction ; aucune garantie d’égalité pixel pour pixel entre GPU/navigateurs.
- Montage desktop figé sur une visite observée, contrairement au tirage aléatoire original parmi 55 séries. Toutes les variantes sont récupérables via le script.
- La grille utilise les atlas originaux mais sa navigation, son ordre, son rayon de courbure effectif et ses interactions sont réécrits.
- Titres Ripple, navigation et page About propres au prototype ; pas de reproduction des pages institutionnelles de Phantom.
- Les sons sont désactivés par défaut. Le mode de réduction des mouvements passe l’intro.
- Les URLs constituent un instantané ; des mises à jour du site source peuvent rendre certains téléchargements indisponibles.

## Vérifications

Build TypeScript/Vite réussi. Cinq tests Playwright réussis : desktop avec clic/glisser/replay, recherche et modale, mobile 390×844, réduction des mouvements, échec du modèle avec vue liste. Aucun échec HTTP ni erreur JavaScript lors du parcours desktop normal. Captures dans `research/captures/`.
