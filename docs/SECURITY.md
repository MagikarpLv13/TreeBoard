# Sécurité et confidentialité

Toutes les données applicatives restent dans IndexedDB. Les liens ne s'ouvrent qu'après confirmation explicite et seuls `https:` et `http:` sont autorisés. Les imports sont bornés et validés ; aucun HTML fourni par l'utilisateur n'est injecté. Pour effacer les données, utilisez les outils de stockage du navigateur pour le site, ou supprimez manuellement les arbres et sessions.

Pour le déploiement, prévoir une CSP restrictive, notamment `default-src 'self'` et l'absence de script inline.
