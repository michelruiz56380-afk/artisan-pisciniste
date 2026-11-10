# artisan-pisciniste.fr — sources du générateur

Cette branche n'est **jamais déployée** (Hostinger ne déploie que `main`). Elle contient de quoi régénérer le site :

- `build.py` : génère toutes les pages (accueil, Conseils, 8 articles, mentions légales, 404), les images optimisées, `sitemap.xml`, `robots.txt`.
- `template.html` : la page d'accueil (sections, styles, scripts : eau interactive, chantier animé, piscine 3D, avis…).
- `pages.json` : contenu des articles récupéré sur l'ancien site.
- `server/` : fichiers copiés tels quels (`.htaccess`, formulaire, CRM `admin/`, `crm-db.php`, `stat.php`, modèles d'e-mail, fichier Google).
- `img/`, `dl/`, `sup/`, `logo/` : photos, police, bibliothèque 3D, logos et photos fournisseurs.

## Régénérer le site

```bash
pip install pillow
python3 build.py prod /chemin/vers/sortie
```

Puis copier le contenu de la sortie dans la branche `main` (en gardant `README.md` et `.gitignore` de `main`), commit et push : Hostinger met en ligne automatiquement.

Les fichiers PHP du CRM et du formulaire peuvent aussi être modifiés directement sur `main` ; dans ce cas, reporter la modification dans `server/` ici.
