# Architecture

`domain/` contient les types, le moteur de template/parcours et la validation ; `data/` encapsule IndexedDB avec Dexie ; `store/` coordonne l'état d'interface et la persistance ; `App.tsx` porte les trois vues. Le navigateur est la seule source de données applicatives : TreeBoard n’appelle aucun backend et ne transmet pas les arbres ou sessions sur le réseau.

Les flux sont `éditeur → DecisionTree → Dexie` et `DecisionTree + variables → ExecutionSession → Dexie → rapport Markdown`.
