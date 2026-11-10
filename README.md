# artisan-pisciniste.fr

Site statique d'Artisan Pisciniste (Olivier Rousseau, Elven, Morbihan) : HTML, CSS, JavaScript et un petit script PHP pour le formulaire de devis. Aucune compilation n'est nécessaire, le contenu du dépôt se dépose tel quel dans `public_html`.

## Déploiement sur Hostinger

1. hPanel › Sites web › Gérer › **GIT** : dépôt `https://github.com/michelruiz56380-afk/artisan-pisciniste.git`, branche `main`, répertoire d'installation vide (= `public_html`).
   Le répertoire doit être vide avant le premier déploiement : sauvegarder puis vider l'ancien contenu.
2. Activer le **déploiement automatique** (webhook GitHub) pour que chaque modification poussée sur `main` soit mise en ligne.
3. Créer sur le serveur, à côté de `contact.php`, le fichier `contact-config.php` à partir de `contact-config.exemple.php`, avec l'adresse qui reçoit les demandes. Ce fichier n'est volontairement pas dans Git.
4. Créer la boîte `site@artisan-pisciniste.fr` (hPanel › E-mails), utilisée comme expéditeur du formulaire.
5. Vérifier le certificat SSL, puis soumettre `https://artisan-pisciniste.fr/sitemap.xml` dans la Google Search Console.

## Adresses

Les pages sont des fichiers `page.html` servies sans extension (`/page`) grâce à `.htaccess`, pour garder exactement les adresses de l'ancien site, notamment celles des 8 articles du blog.
