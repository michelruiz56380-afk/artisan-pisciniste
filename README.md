# artisan-pisciniste.fr

Site statique d'Artisan Pisciniste (Olivier Rousseau, Elven, Morbihan) : HTML, CSS, JavaScript et un petit script PHP pour le formulaire de devis. Aucune compilation n'est nécessaire, le contenu du dépôt se dépose tel quel dans `public_html`.

## Déploiement sur Hostinger

1. hPanel › Sites web › Gérer › **GIT** : dépôt `https://github.com/michelruiz56380-afk/artisan-pisciniste.git`, branche `main`, répertoire d'installation vide (= `public_html`).
   Le répertoire doit être vide avant le premier déploiement : sauvegarder puis vider l'ancien contenu.
2. Activer le **déploiement automatique** (webhook GitHub) pour que chaque modification poussée sur `main` soit mise en ligne.
3. Le formulaire envoie les demandes à l'adresse indiquée dans `contact-config.php` (dans le dépôt, sans mot de passe, bloqué en lecture par `.htaccess`).
4. L'expéditeur doit être une boîte existante du domaine (actuellement olivier@artisan-pisciniste.fr).
5. Vérifier le certificat SSL, puis soumettre `https://artisan-pisciniste.fr/sitemap.xml` dans la Google Search Console.

## Adresses

Les pages sont des fichiers `page.html` servies sans extension (`/page`) grâce à `.htaccess`, pour garder exactement les adresses de l'ancien site, notamment celles des 8 articles du blog.

## Mini CRM (/admin/)

- Chaque demande du formulaire est enregistrée dans le CRM avant l'envoi de l'e-mail : elle n'est jamais perdue.
- Données : base SQLite `crm-data/crm.sqlite`, rangée **à côté** de `public_html` (hors du web, non touchée par les déploiements Git).
  Si ce dossier n'est pas accessible en écriture, elle est créée dans `public_html/crm-data/`, interdit d'accès.
- Première visite de `https://artisan-pisciniste.fr/admin/` : création du mot de passe (10 caractères minimum).
- **Mot de passe oublié** : dans le Gestionnaire de fichiers, supprimer la ligne n'est pas possible simplement ; le plus simple est de demander une réinitialisation (script ponctuel) — ne jamais supprimer `crm.sqlite`, qui contient toutes les demandes.
- Sauvegarde : télécharger régulièrement l'export Excel depuis le CRM ; les sauvegardes Hostinger couvrent aussi le dossier `crm-data`.
