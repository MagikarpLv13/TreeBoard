# Import / export

Un arbre est exporté dans un package JSON versionné : `format`, `schemaVersion`, `exportedAt`, puis `tree`. À l'import, le MVP importe une copie avec un nouvel UUID afin de ne jamais écraser silencieusement l'existant. Les sessions s'exportent aujourd'hui en Markdown lisible.
