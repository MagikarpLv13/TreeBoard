# TreeBoard — revue rapide du 15 octobre 2026

TreeBoard dispose déjà d’un premier ensemble cohérent : création d’arbres, éditeur visuel, sauvegarde automatique, parcours guidé, historique et comptes rendus. Pour un usage individuel sur un navigateur, le socle permet de commencer à utiliser le script IRSO.

Périmètre initial : état local au commit `62eb3da`. Cette fiche a été actualisée après correction des trois problèmes et vérification de la version compilée dans le navigateur. Cette revue ciblée n’est pas un audit exhaustif.

## Ce qui est déjà en place

- Bibliothèque locale, recherche, import et export JSON.
- Éditeur avec branches de questions, suppression des connexions, copier/coller et annuler/rétablir.
- Sauvegarde automatique temporisée et validation de la structure.
- Données initiales, variables dans les textes et liens, ajout de données pendant le parcours.
- Sessions enregistrées, consultation des étapes antérieures et choix entre dupliquer ou abandonner la suite après une modification de l’historique.
- Passage vers un autre arbre, export Markdown, thèmes et libellés d’accessibilité sur de nombreux contrôles.
- Stockage local dans IndexedDB ; les textes importés sont affichés comme du texte.

## Constats initiaux et correctifs

1. **Version de l’arbre conservée dans chaque session — corrigé.** L’arbre est copié au lancement, puis chaque nouvel arbre à sa première utilisation. Modifier ou supprimer une étape de la bibliothèque ne modifie plus la version du parcours enregistré. Les anciennes sessions reçoivent au chargement une copie des arbres encore disponibles ; les étapes déjà supprimées avant cette migration ne peuvent pas être recréées. Les données enregistrées restent exportables si l’étape courante manque.

2. **Validation des données selon leur type — corrigé.** Le lancement et le passage à un autre arbre utilisent le même contrôle : cases obligatoires cochées, champs obligatoires non vides après retrait des espaces périphériques, e-mails, URLs, dates et nombres valides, options de liste reconnues. Le formulaire active aussi la validation native du navigateur. Les listes importées disposent d’un véritable menu de sélection et les nombres décimaux sont acceptés.

3. **Progression adaptée aux embranchements — corrigé.** Le nombre d’étapes parcourues est affiché pendant la session ; la longueur restante dépend des réponses. Après clôture, la progression atteint 100 %. Consulter un point antérieur de l’historique rétablit son état sans lui attribuer par erreur la clôture finale.

Les tests couvrent ces régressions dans le moteur, la persistance et le lecteur React.

## Vérifications

- 46 tests passent, dans 8 fichiers, dont des tests d’interface et de migration des sessions.
- Vérification statique et compilation réussies.
- La compilation ne signale plus de fichier trop volumineux : environ 404 Ko pour le fichier principal et 188 Ko pour les dépendances graphiques, désormais séparées. La taille totale reste comparable.
- Script IRSO v2 : schéma accepté, aucune erreur ni alerte structurelle, 44 étapes et 146 connexions.
- Chaque réponse possède une destination ; chaque étape dispose d’un chemin vers une fin.
- 16 scénarios v2 simulés, dont les quatre métiers, un rôle inconnu, un transfert, le répondeur, le refus, l’opposition et plusieurs objections.
- Import, lancement, choix de branches, enregistrement des notes et téléchargement du compte rendu vérifiés dans le navigateur avec des données fictives.

Le graphe Graphify existant date du 14 juillet ; les constats ci-dessus reposent sur le code actuel et les vérifications directes. Aucun audit de dépendances, test de panne de stockage, test multi-onglets ou examen complet d’accessibilité n’a été effectué.

## Utiliser le script IRSO

Le fichier `data/irso-prospection-telephonique.json` est un package importable dans TreeBoard. Une copie est également placée à côté de la fiche téléphonique d’origine.

1. Dans la bibliothèque, cliquer sur **Importer** et choisir le JSON.
2. Cliquer sur **Tester le parcours**, ou sur **Lancer** depuis la bibliothèque.
3. Renseigner le cabinet appelé, puis suivre uniquement les passages utiles.
4. Enregistrer les données ajoutées avec **Enregistrer les données** avant de changer d’étape. Les notes sont enregistrées en passant à la suite.
5. Terminer la session et exporter le compte rendu.

Un appel correspond à une session. La v2 commence par une présentation dès qu’une personne répond, puis identifie son rôle avant de choisir l’accroche métier. Après un transfert, la présentation est répétée auprès de la nouvelle personne. Réimporter le JSON révisé pour utiliser ce scénario ; la mise à jour du site ne remplace pas les arbres personnels déjà enregistrés.

Le script couvre les détectives privés, avocats, cabinets cyber et professionnels de l’assurance. Il reprend la fiche fournie et conserve les distinctions entre phrases à dire et repères personnels. Les déclarations d’expérience et de statut viennent de cette fiche ; les dossiers d’investigation n’ont pas été réexaminés.

Une session « Démonstration — appel fictif » a été utilisée pour la vérification. Le parcours n’envoie aucun message et ne planifie aucun rappel. Les suites convenues restent à reporter dans le fichier de prospection.

La feuille de route a été actualisée pour distinguer les fonctions déjà livrées des travaux restant à faire.
