# Ripple — Ideas in motion

Premier frontend interactif inspiré de [Phantom Studios](https://www.phantom.land/), centré sur la reproduction de son introduction au fantôme. React, TypeScript, Three.js, GSAP et Vite.

## Version active

La version fantôme inspirée de Phantom est la seule expérience active, sur `/`. Les anciens liens `/?version=fly` affichent aussi le fantôme. L’expérience mouche est abandonnée ; ses fichiers et recherches sont conservés comme archive.

## Lancer

```sh
npm ci
npm run dev
```

Ouvrir `http://localhost:5173` **sur la machine qui exécute le serveur**. Depuis un autre appareil, utiliser l’adresse réseau affichée par Vite si les deux appareils partagent le même réseau, ou exposer le build avec un tunnel HTTPS.

```sh
npm run build
npm run preview
```

`dist/` est un site statique autonome : les images, modèles, atlas, sons et polices utilisés sont locaux. Déployer à la racine d’un domaine. Aucun backend ni clé d’API.

## Ce qui fonctionne

- Préchargement réel, barre verte et séparation des deux titres.
- Dépixellisation sur 800 ms, 25 images de fantôme en 1,8 s avec interpolation cubique.
- Transition vers le modèle original en particules, rotation de 240° et traversée de la caméra.
- Grille 3D infinie, distorsion, navigation au glisser, à la molette et aux flèches du clavier.
- 85 projets du blueprint public, atlas vidéo partagé, vue liste, recherche, aperçu de projet.
- About, replay, passage de l’intro, son sur activation explicite et pause des médias.
- Images adaptées au mobile, réduction des mouvements et vue liste de secours si la 3D échoue.

L’habillage Ripple est provisoire. Les projets présentés restent ceux de Phantom, identifiés comme références dans l’interface.

## Scraping et fidélité

Voir [l’analyse technique](research/PHANTOM.md), [l’inventaire](research/asset-inventory.json) et [le relevé des téléchargements embarqués](research/downloaded-assets.json).

```sh
npm run scrape           # restaure les ressources embarquées
npm run scrape -- --all  # récupère également toutes les variantes dans research/archive/
```

Python 3 suffit pour les téléchargements. FFmpeg sert à recréer l’affiche de l’atlas vidéo si elle manque. Les captures complètes (~306 Mo lors du relevé) restent dans `research/archive/`, exclu de Git ; environ 13 Mo de références Phantom sont utilisés par la version active.

La version desktop rejoue les 25 images d’une visite observée. Le site original choisit une variante aléatoire parmi 55 pour chaque image ; le montage change donc d’une visite à l’autre. Sur mobile, cette sélection aléatoire parmi les 3 séries originales est conservée. Les shaders et paramètres de l’intro proviennent du relevé public, mais le renderer et la grille ont été réécrits : ce n’est pas une copie pixel pour pixel de tout le site.

Les ressources et extraits de shaders de Phantom conservent leur provenance ; leur accessibilité publique n’établit pas une licence de redistribution. La police DM Mono est fournie avec sa licence OFL. Le dépôt ne revendique pas la propriété des créations de Phantom.

## Vérifier

```sh
npx playwright install chromium
npm test
npm run build
```

Les tests couvrent le parcours desktop, le replay, le clic/glisser, la recherche, les modales, le mobile, la réduction des mouvements et un échec de chargement du modèle. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet d’utiliser un Chromium déjà installé.

Les captures de vérification se trouvent dans [`research/captures/`](research/captures/).
