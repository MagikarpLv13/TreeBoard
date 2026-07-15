<p align="center">
  <img src="public/favicon.svg" width="120" alt="Logo TreeBoard" />
</p>

<h1 align="center">TreeBoard</h1>

<p align="center">
  Créez, exécutez et documentez des arbres de décision — directement dans votre navigateur.
</p>

<p align="center">
  <a href="#démarrer">Démarrer</a> ·
  <a href="#fonctionnalités">Fonctionnalités</a> ·
  <a href="#confidentialité">Confidentialité</a> ·
  <a href="#documentation">Documentation</a>
</p>

TreeBoard est une application **local-first** pour concevoir des parcours guidés, les exécuter étape par étape et conserver les observations associées. Elle convient notamment aux procédures internes, à l’investigation autorisée, aux diagnostics et à tout processus qui gagne à être structuré.

## Fonctionnalités

- Bibliothèque locale d’arbres, recherche, import et export JSON.
- Éditeur visuel avec nœuds, branches, minimap et validation structurelle.
- Variables initiales et modèles dynamiques, par exemple `{{email|urlencode}}`.
- Liens externes ouverts uniquement après confirmation.
- Parcours guidés avec notes, statuts, reprise de session et rapport Markdown.
- Exemple de qualification d’adresse e-mail basé sur des sources publiques, à utiliser dans un cadre autorisé.

## Démarrer

### Prérequis

- Une version LTS récente de [Node.js](https://nodejs.org/)
- npm (fourni avec Node.js)

### Installation

```bash
git clone https://github.com/MagikarpLv13/TreeBoard.git
cd treeboard
npm install
npm run dev
```

Vite affiche ensuite l’adresse locale de l’application, généralement `http://localhost:5173`.

### Commandes utiles

| Commande | Description |
| --- | --- |
| `npm run dev` | Lance le serveur de développement. |
| `npm run lint` | Vérifie la qualité statique du code. |
| `npm test` | Exécute les tests unitaires. |
| `npm run build` | Produit la version statique dans `dist/`. |
| `npm run preview` | Prévisualise localement la version de production. |

## Confidentialité

Les arbres et les sessions sont enregistrés dans IndexedDB, sur l’appareil de la personne qui utilise TreeBoard. L’application ne dispose d’aucun serveur applicatif ni compte utilisateur.

Vous pouvez exporter un arbre au format JSON pour le sauvegarder ou le transférer. Les sessions sont exportables sous forme de compte rendu Markdown.

## Stack technique

- React, TypeScript et Vite
- React Flow pour l’éditeur graphique
- Dexie / IndexedDB pour la persistance locale
- Zustand pour l’état de l’interface
- Zod pour la validation des imports
- Vitest et Oxlint pour la qualité

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Import et export](docs/IMPORT_EXPORT.md)
- [Moteur de modèles](docs/TEMPLATE_ENGINE.md)
- [Sécurité et confidentialité](docs/SECURITY.md)
- [Feuille de route](docs/ROADMAP.md)

## Contribution

Les issues et propositions d’amélioration sont bienvenues. Avant d’ouvrir une pull request, lancez :

```bash
npm run lint
npm test
npm run build
```

## Licence

Distribué sous licence [MIT](LICENSE). Vous pouvez utiliser, modifier et redistribuer le projet, sous réserve de conserver la notice de licence.
