# Sunu Jàng — Version PWA (installable)

Ce dossier contient une vraie **application web progressive (PWA)** : elle peut s'installer sur un téléphone comme une app, avec une icône, et fonctionner hors-ligne après la première visite.

## Contenu du dossier
- `index.html` — l'application elle-même
- `manifest.json` — nom, icônes et couleurs de l'app (ce que le téléphone lit pour l'installer)
- `sw.js` — le service worker, qui met l'app en cache pour le mode hors-ligne
- `icons/` — les icônes de l'app (baobab, aux couleurs SM&K)

## Important : il faut l'héberger en ligne pour l'installer
Un navigateur n'autorise l'installation d'une PWA que si elle est servie en **HTTPS** (pas en ouvrant simplement le fichier depuis l'ordinateur). Trois options simples et gratuites :

### Option A — GitHub Pages (recommandé, gratuit)
1. Créez un compte GitHub si besoin, puis un nouveau dépôt (repository).
2. Déposez-y tous les fichiers de ce dossier (en gardant `icons/` comme sous-dossier).
3. Dans les réglages du dépôt → **Pages**, activez GitHub Pages sur la branche principale.
4. Votre app sera accessible à une adresse du type `https://votre-nom.github.io/nom-du-depot/`.

### Option B — Netlify Drop
1. Allez sur `app.netlify.com/drop`.
2. Glissez-déposez le dossier complet.
3. Netlify vous donne un lien HTTPS immédiatement.

### Option C — Un hébergeur web classique
Si vous avez déjà un hébergement (OVH, etc.), déposez simplement tous les fichiers dans un dossier accessible en HTTPS.

## Tester l'installation sur un téléphone
1. Ouvrez le lien HTTPS de votre app dans **Chrome** (Android) ou **Safari** (iPhone).
2. Sur Android/Chrome : un bandeau **"Installer Sunu Jàng"** apparaît automatiquement (déjà intégré dans l'app) — ou via le menu ⋮ → **"Installer l'application"**.
3. Sur iPhone/Safari : bouton **Partager** (carré avec une flèche) → **"Sur l'écran d'accueil"**.
4. L'icône baobab apparaît sur l'écran d'accueil, et l'app s'ouvre en plein écran, sans barre de navigateur.

## Pour aller plus loin
Cette version PWA réutilise exactement le contenu (devoirs, fiches, quiz, module informatique) déjà construit. Les données de progression restent pour l'instant stockées en mémoire le temps de la session — pour les conserver d'une visite à l'autre, l'étape suivante serait de connecter une vraie base de données (voir le guide *"De prototype à vraie application mobile"* fourni précédemment).
