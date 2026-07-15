# Moteur de templates

La syntaxe est `{{identifiant|filtre}}`. Les filtres MVP sont `urlencode`, `lower`, `upper` et `trim`. Le moteur remplace uniquement des variables de session ; il n'exécute jamais de JavaScript. Les variables inconnues restent visibles et sont signalées par le résultat du moteur.
