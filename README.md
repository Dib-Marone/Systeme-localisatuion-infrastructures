# Fatick Terrain — carte d'enquête mobile

Application web **autonome** (indépendante du site Django) pour les enquêtes de terrain à Fatick :
52 infrastructures sur la carte, passage en **rouge** quand tu arrives dessus, guidage vers la prochaine,
nom + quartier au zoom, **formulaire par infrastructure** et **export Excel**. Fonctionne sur téléphone, y compris hors-ligne.

## 1. Mettre en ligne sur GitHub Pages (5 minutes)
1. Crée un dépôt GitHub (ex. `fatick-terrain`), public.
2. Envoie **tout le contenu de ce dossier** (y compris `.nojekyll`) à la racine du dépôt
   (sur github.com : *Add file → Upload files*, glisse les fichiers et dossiers, *Commit*).
3. *Settings → Pages → Build and deployment* : Source = **Deploy from a branch**, Branch = **main**, dossier **/ (root)** → *Save*.
4. Après ~1 minute, le lien est : `https://TON-PSEUDO.github.io/fatick-terrain/`
5. Ouvre ce lien sur ton téléphone (Chrome / Safari) → menu du navigateur → **Ajouter à l'écran d'accueil**.

## 2. Avant de partir (avec du Wi-Fi)
- Ouvre l'appli une fois, autorise la **localisation**.
- ☰ → **Réglages → Télécharger la carte hors-ligne** (plan), puis 🛰️ et refais-le pour le satellite si besoin.
- Les itinéraires demandent du réseau mobile ; sans réseau, le guidage passe en **ligne droite + direction**.

## 3. Sur le terrain
- 🔴 **Rouge** = visitée (automatique à moins de 40 m, réglable ; ou bouton « Marquer visitée »).
- Zoome (≥ 16) : le **nom et le quartier** s'affichent. Touche un pin pour la fiche.
- 🧭 **Itinéraire** : guidage pas à pas (voix optionnelle). 🧭 bouton rond = infrastructure non visitée la plus proche.
- 📝 **Formulaire** : champs identiques à tes fichiers Kobo, pré-remplis avec ce que tu as déjà (24 infrastructures).
  « Corriger avec ma position » enregistre le point GPS réel.
- Les données sont gardées **dans le téléphone** (aucun serveur).

## 4. Export
☰ → **Export** → *Télécharger le fichier Excel* (une feuille par type + `Suivi_visites`, avec coordonnées UTM 28N)
ou *Partager* (WhatsApp, e-mail). Pense aussi à la **sauvegarde .json** en fin de journée.

## Modifier
- Champs des formulaires : `js/forms.js`
- Infrastructures (coordonnées, noms) : `js/data.js`
- Après une modification, change `VER` dans `sw.js` (ex. `ft-v2`) pour forcer la mise à jour du cache.
