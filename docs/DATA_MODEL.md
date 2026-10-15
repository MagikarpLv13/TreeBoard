# Modèle de données

`DecisionTree` est versionné (`schemaVersion: 1`) et porte les entrées, nœuds et arêtes. Un nœud a un UUID, sa position, son type et son contenu. `ExecutionSession` contient un instantané des variables, l'étape courante et une chronologie de `StepExecution` avec réponse, note et statut.

Les imports JSON sont limités à 2 Mo et validés par Zod. Une future migration doit accepter une version connue, la convertir dans la version courante, puis valider le résultat.

Les sessions conservent dans `treeSnapshots` une copie indépendante de chaque arbre à sa première utilisation. Les étapes, questions et données initiales restent ainsi disponibles après une modification de la bibliothèque. Ces copies sont partagées par les points de l’historique de la session et sont conservées lors d’une duplication.

Au chargement, les anciennes sessions reçoivent une copie des arbres encore disponibles. Cette migration ne peut pas recréer une étape déjà supprimée avant la mise à jour ; le compte rendu des données enregistrées reste exportable quand l’étape courante manque.

Les données sont validées au lancement et avant un passage vers un autre arbre : champs obligatoires après suppression des espaces périphériques, cases obligatoires cochées et formats des e-mails, URLs, nombres, dates et listes. Les formats natifs du formulaire complètent ce contrôle.
