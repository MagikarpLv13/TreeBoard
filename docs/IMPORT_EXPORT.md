# Import / export

Un arbre est exporté dans un package JSON versionné : `format`, `schemaVersion`, `exportedAt`, puis `tree`. À l'import, le MVP importe une copie avec un nouvel UUID afin de ne jamais écraser silencieusement l'existant. Les sessions s'exportent aujourd'hui en Markdown lisible.

Une question peut référencer une donnée initiale avec `answerInputId`. Si la valeur enregistrée correspond exactement à l’identifiant d’un de ses chemins (`choices[].value`), le lecteur suit ce chemin sans afficher la question. Cette sélection fonctionne au démarrage, entre deux étapes et après un passage vers un autre arbre. Les données restent présentes dans la session et le compte rendu ; la question automatique n’ajoute pas d’étape à l’historique.

Si la valeur est absente ou inconnue, si la destination manque ou si des questions automatiques bouclent entre elles, le lecteur conserve une question visible pour permettre un choix manuel. Les anciens arbres restent entièrement manuels tant que `answerInputId` n’est pas renseigné. L’éditeur propose ce réglage dans les chemins de la question, ainsi que la modification des options des données de type liste (`select`).
