# ADR 0001 — Persistance locale

Dexie/IndexedDB est retenu plutôt que `localStorage` pour gérer des entités structurées, des index et une évolution de schéma. Cette décision conserve un déploiement statique et n'empêche pas une synchronisation optionnelle ultérieure.
