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
- **Mot de passe oublié** : dans le Gestionnaire de fichiers, créer un fichier vide nommé `reinitialiser-mot-de-passe` dans le dossier `crm-data`, puis ouvrir `/admin/` pour choisir un nouveau mot de passe (les demandes sont conservées). Ne jamais supprimer `crm.sqlite`.
- Sauvegarde : télécharger régulièrement l'export Excel depuis le CRM ; les sauvegardes Hostinger couvrent aussi le dossier `crm-data`.

## Devis dictés (/admin/devis.php)

Module de devis intégré au CRM (même mot de passe). On dicte le chantier ; Claude propose les lignes à partir du catalogue ; on vérifie, on enregistre, on télécharge le PDF.

- **Depuis une demande** : bouton « Créer un devis » sur la fiche. Le client est pré-rempli et le devis reste lié à la fiche.
- **Lien avec le CRM** : à chaque enregistrement, le montant TTC est reporté sur la demande et noté dans l'historique. Devis « Envoyé » → demande « Devis envoyé » ; « Accepté » → « Gagnée » ; « Refusé » → « Perdue ». Un devis fait pour un nouveau client crée sa demande.
- **Catalogue** : jamais dans ce dépôt (il est public). Onglet Catalogue › Importer, avec le fichier `catalogue-2026.json` fourni à part ; ensuite il se modifie dans l'interface. « Exporter » en fait une sauvegarde.
- **Clé API Claude** : onglet Entreprise. Elle est rangée dans `crm-data` (hors du site) et n'est jamais réaffichée. Créer la clé sur console.anthropic.com et y fixer une limite de dépense. Chaque analyse de dictée est facturée à l'usage.
- **Dictée** : bouton « Dicter au micro » dans Chrome, Edge et Safari ; sinon micro du clavier.
- **PDF** : fabriqué dans le navigateur (jsPDF, dans `admin/vendor/`), logo du site par défaut.
- **Prérequis Hostinger** : extensions PHP `pdo_sqlite` et `curl` activées (hPanel › Avancé › Configuration PHP). L'analyse peut prendre jusqu'à une minute : si elle est coupée, augmenter `max_execution_time` (180 s).
- **Fichiers** : `devis-db.php` (données et appel à Claude, interdit d'accès direct), `admin/devis.php` (page et échanges), `admin/devis.js`, `admin/devis.css`.

## Trafic (/admin/?stats=1)

- `stat.php` reçoit un signal à chaque page vue (envoyé par `assets/site.js`), sans cookie : seule une empreinte du jour, non réversible, sert à compter les visiteurs uniques. Données conservées 13 mois, dans la même base que le CRM.
- Ne sont pas comptés : les robots, les navigateurs « Ne pas me pister », et le navigateur avec lequel on s'est connecté au CRM.
