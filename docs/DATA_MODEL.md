# Modèle de données

`DecisionTree` est versionné (`schemaVersion: 1`) et porte les entrées, nœuds et arêtes. Un nœud a un UUID, sa position, son type et son contenu. `ExecutionSession` contient un instantané des variables, l'étape courante et une chronologie de `StepExecution` avec réponse, note et statut.

Les imports JSON sont limités à 2 Mo et validés par Zod. Une future migration doit accepter une version connue, la convertir dans la version courante, puis valider le résultat.
