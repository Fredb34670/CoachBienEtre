# Design – Espace d'administration du site Happy-Thérapie-Holistique

Date : 2026-11-26
Statut : validé avec la propriétaire du site (direction WYSIWYG par blocs, option « sauvegarde immédiate »).

## 1. Intent et pourquoi

Le site `Happy-thérapie-holistique` (actuellement hébergé sur Netlify, sans domaine personnalisé) est un site statique en HTML/CSS/JS : une seule page avec 7 sections-onglets (Accueil, Pour qui, Déroulement, Mon approche, Tarifs, Actualités, Contact), des images locales, et des balises SEO dans le `<head>`.

La propriétaire du site souhaite pouvoir **modifier, ajouter et supprimer des textes et des images** elle-même, sans toucher à la structure technique du site, et sans qu'un bouton de connexion soit visible aux visiteurs.

- **Accès** : uniquement via l'URL `https://<site>.netlify.app/admin`.
- **Public** : un seul administrateur (la propriétaire).
- **Usage typique** : mettre à jour des textes, remplacer des images, ajouter/supprimer des sections de contenu, ajuster la description SEO.
- **Pourquoi maintenant** : le site est en ligne ; les contenus évoluent (actualités, tarifs, messages) et la propriétaire ne veut pas dépendre d'un développeur pour chaque changement.

## 2. Objectifs / Non-objectifs

### Objectifs
1. Authentification par mot de passe, accessible uniquement via `/admin` (aucun lien ni bouton visible sur le site public).
2. Interface d'édition type WYSIWYG par « blocs » : chaque bloc de texte ou d'image d'une section est modifiable indépendamment, avec un aperçu qui ressemble au rendu du site.
3. Possibilité d'ajouter et de supprimer des blocs (texte ou image) dans chaque section.
4. Remplacement des images (téléversement d'une image depuis l'ordinateur de l'admin) ; les changements sont visibles immédiatement sur le site public.
5. Édition des métadonnées SEO (title, meta description, keywords).
6. Sauvegarde immédiate : l'enregistrement dans l'interface admin met le contenu à jour pour les visiteurs sans délai de publication.
7. La structure HTML/CSS du site public (mise en page, couleurs, navigation) reste figée : l'admin ne peut la modifier.

### Non-objectifs (anti-goals)
- Pas de comptes multiples, pas de rôles, pas de permissions fines (1 seul admin).
- Pas d'historique de versions ni de restauration (« rollback ») — explicitement refusé par la propriétaire.
- Pas de multilingue — explicitement refusé.
- Pas d'édition HTML/CSS, pas de restructuration de pages.
- Pas de calendrier de prise de RDV en ligne (l'emplacement est prévu dans le code mais hors périmètre).
- Pas de modification du nom de domaine ni de l'hébergement (reste sur Netlify).

### Contraintes
- Hébergement = Netlify (fonctions sans serveur uniquement, pas de serveur 24/7).
- La propriétaire est non-technicienne : l'interface doit être auto-explicative, en français.
- Les images actuelles sont des PNG de ~2 Mo ; la solution doit accepter des images de cette taille sans abonnement payant.
- Le site public doit continuer à s'afficher correctement même si le contenu « en ligne » est indisponible (repli sur le contenu par défaut intégré au site).

## 3. Approches envisagées (et choix)

### Approche A retenue — Contenu JSON + fonctions Netlify + stockage intégré, publication immédiate
- Les textes du site sont extraits du HTML dans des **fichiers JSON de contenu** (un par section) qui font partie du dépôt (contenu par défaut).
- L'interface admin (`/admin`, pages statiques) charge le contenu, permet de l'éditer et de l'enregistrer via de **petites fonctions Netlify** (API) ; l'état courant est conservé dans un **stockage clé/valeur Netlify** (Blob/KV), et les images dans **Netlify Blob**.
- Le site public lit le contenu JSON à l'affichage (chargement immédiat, rendu identique) et replie sur le contenu par défaut si la requête échoue.
- Authentification : mot de passe unique de l'admin, session par jeton.

**Avantages** : publication immédiate ; tout reste chez Netlify (gratuit pour cet usage) ; l'admin ne voit que des textes et des images.
**Inconvénients** : le contenu du site est chargé par le navigateur au lieu d'être dans le HTML (légèrement moins favorable au référencement que du HTML statique, négligeable pour un site de cette taille bien structuré) ; le site dépend de la disponibilité des fonctions (mitigé par le repli).

### Approche B (rejetée) — Publication différée via Git (type Static CMS)
L'interface admin génère des fichiers HTML/JSON et pousse des commits dans le dépôt ; Netlify republie le site (30–60 s).
Rejetée parce que : délai avant que le changement soit visible, pièce mobile supplémentaire (accès au dépôt), plus complexe à vivre au quotidien pour une seule utilisatrice.

### Approche C (rejetée) — Backend Node classique sur un VPS séparé
Rejetée parce que : la propriétaire veut rester sur son hébergement actuel (Netlify) et éviter un second service payant.

## 4. Architecture (décisions du concepteur)

> Les éléments marqués « décision concepteur » n'ont pas été discutés avec la propriétaire ; ils sont choisis pour rester dans l'esprit validé et peuvent être ajustés au planning si un conflit apparaît.

### 4.1 Modèle de contenu
- Un fichier JSON **par section** (7 fichiers : `accueil`, `pourqui`, `deroulement`, `approche`, `tarifs`, `activites`, `contact`) + un fichier `meta.json` pour le SEO (title, description, keywords).
- Chaque section est une **liste de blocs** : `{ type: "titre" | "texte" | "image", label, valeur }`. Un bloc « texte » est du riche HTML restreint (gras, italique, souligné, listes à puces) — le même sous-ensemble que l'aperçu WYSIWYG de la maquette.
- Le bloc « image » référence le nom d'une image du stockage (pas le contenu binaire).
- Cette structure est extensible (on pourra ajouter plus tard des blocs « liste », « tableau », « vidéo » sans casser le reste). **Décision concepteur** : prévoir le schéma dès maintenant, mais n'implémenter que les types titre/texte/image.

### 4.2 Site public
- `index.html` conserve sa structure actuelle (onglets, styles). Chaque section devient un conteneur vide qui sera rempli par le script à l'affichage.
- Le script (`content.js`) : charge le contenu (fichier par section) depuis l'API avec repli sur le contenu par défaut intégré ; applique les métadonnées SEO ; laisse intactes la navigation et les styles.
- Comportement en cas d'échec de chargement : le site affiche le contenu par défaut (celui intégré au dépôt), le site reste donc toujours lisible. **Décision concepteur.**

### 4.3 Fonctions Netlify (API)
- `POST /api/login` : vérifie le mot de passe (comparaison hachée), renvoie un **jeton de session** (HttpOnly cookie, valide 12 h, jeton signé + aléatoire, inactif sans le mot de passe).
- `GET /api/content` (public) : renvoie le contenu courant (JSON par section) + les métadonnées SEO.
- `POST /api/content` (protégé par le jeton) : enregistre le contenu modifié (validation du schéma, taille bornée).
- `POST /api/media` (protégé par le jeton) : téléverse une image (limites : 5 Mo par image, formats jpg/png/webp) et renvoie son nom.
- `GET /api/media/<nom>` (public) : sert l'image.
- `POST /api/logout` : invalide la session.
- Limite de tentative de connexion (anti-force-brute) : quelques échecs bloqués pendant une courte durée par adresse IP. **Décision concepteur.**

### 4.4 Stockage
- **Contenu JSON courant** : Netlify Blob (fichier unique `site.json` contenant les 7 sections + `meta`). Le dépôt garde les fichiers de contenu par défaut (repli + source de vérité au premier déploiement ; le Blob est amorcé au premier enregistrement).
- **Images** : Netlify Blob (dossier dédié), limites de la formule gratuite à vérifier au déploiement ; les ~2 Mo/images actuels passent largement.
- **Mot de passe admin** : ne jamais stocker en clair. Haché (scrypt) ; le hash + la clé de signature sont placés dans les **variables d'environnement Netlify**. Le mot de passe est choisi par la propriétaire (ou généré et communiqué une fois), minimum 12 caractères.

### 4.5 Interface admin (`/admin`)
- Basée sur la maquette validée (`admin-mockup/mockup-admin.html`) : écran de connexion minimaliste, barre latérale avec les 7 sections + « SEO & description », blocs éditables (titre = champ simple ; texte = éditeur riche minimal avec toolbar gras/italique/souligné/listes ; image = aperçu + « Remplacer l'image… »), boutons « Ajouter un texte », « Ajouter une image », « Supprimer ce bloc », barre de bas « N modifications non enregistrées » + Annuler / Enregistrer.
- Éditions **en direct dans la page admin** (pas de redirection) ; « Enregistrer » appelle l'API puis confirme.
- Le lien « Voir le site ↗ » ouvre la version publique.
- **Décision concepteur** : l'éditeur riche sera une implémentation minimaliste maison (contenteditable + commandes), sans dépendance externe lourde ; si le résultat est insatisfaisant, on basculera sur une librarie d'éditeur légère en CDN.

### 4.6 Sécurité (résumé)
- `/admin` n'est référencé nulle part dans le site public (pas de lien). Un visiteur qui tape l'URL voit simplement l'écran mot de passe ; le contenu reste invisible sans session.
- Sessions courtes (12 h), cookies HttpOnly, site servi en HTTPS uniquement par Netlify.
- L'API `/api/content` en lecture est publique (ce sont des contenus déjà publics), mais écriture et médias ne sont accessibles qu'avec le jeton.

## 5. Ce qui est laissé au concepteur (builder)
- Détails du découpage des fichiers du dépôt (organisation des dossiers `netlify/functions`, `admin/`, `content/`).
- Choix exact de la librarie d'édition riche (si besoin).
- Tests : tests manuels (connexion, édition, remplacement d'image, ajout/suppression de bloc, repli hors-ligne, expiration de session, limites d'upload).
- Déploiement et amorçage du Blob (première sauvegarde part des contenus actuels du site).
- Vérification des limites gratuites Netlify (Blob, nombre d'appels fonctions) et ajustement des bornes si nécessaire.

## 6. Périmètre de modification par section (contenu actuel du site)

| Section | Blocs |
|---|---|
| Accueil | Photo thérapeute (image), titre, intro, liste « ce que j'aide à retrouver », texte « le but de mes séances », texte « mes outils » |
| Pour qui | Titre, 2 listes, bloc « bonne nouvelle » |
| Déroulement | Titre, liste, texte, image schéma, (sous-titres outils + paragraphes) |
| Mon approche | Titre, texte parcours, texte invitation, image |
| Tarifs | Titre, texte, liste des tarifs, avertissement |
| Actualités | Titre, texte libre (zone évolutive) |
| Contact | Titre, coordonnées, consignes, lieu des séances |
| SEO | title, meta description, keywords |

*Le découpage exact des blocs est à confirmer au planning (section 5) en travaillant sur le code réel ; le tableau ci-dessus est l'intention.*
