# Activer la vraie base de données (Supabase) — pas à pas

L'application est câblée pour utiliser **Supabase**, une base de données en ligne gratuite et plus simple que Firebase : seulement **2 informations** à copier-coller (au lieu de 6), et les tables se créent en collant un seul bloc de texte tout prêt.

## Étape 1 — Créer un compte et un projet (2 minutes)
1. Allez sur **supabase.com** → **"Start your project"** → connectez-vous avec GitHub ou Google.
2. Cliquez sur **"New project"**, donnez-lui un nom (ex. "sunu-jang"), choisissez un mot de passe pour la base (notez-le quelque part), choisissez une région proche.
3. Attendez ~1 minute que le projet se prépare.

## Étape 2 — Créer les deux tables (copier-coller, 1 minute)
1. Dans le menu de gauche, cliquez sur **"SQL Editor"**.
2. Cliquez sur **"New query"**, collez exactement ce bloc :

```sql
create table eleves (
  id text primary key,
  prenom text,
  niveau text,
  created_at timestamptz default now()
);

create table resultats_quiz (
  id bigint generated always as identity primary key,
  eleve_id text,
  eleve_nom text,
  niveau_eleve text,
  matiere text,
  titre text,
  score int,
  total int,
  pourcentage int,
  created_at timestamptz default now()
);

alter table eleves enable row level security;
alter table resultats_quiz enable row level security;

create policy "Autoriser tout pour démarrer" on eleves for all using (true) with check (true);
create policy "Autoriser tout pour démarrer" on resultats_quiz for all using (true) with check (true);
```
3. Cliquez sur **"Run"** (ou Ctrl+Entrée). Les deux tables sont créées.

*(Les deux dernières lignes ouvrent l'accès pour que l'app fonctionne tout de suite. Avant un vrai lancement à grande échelle, il est recommandé de faire affiner ces règles par un développeur.)*

## Étape 2 (bis) — Ajouter les tables de l'Espace Enseignant

Si vous avez déjà exécuté le bloc SQL de l'étape 2 plus haut, retournez dans **"SQL Editor"** → **"New query"** et collez ce bloc supplémentaire (il ajoute les tables pour les élèves gérés par l'enseignant, les absences et les notes — sans toucher aux tables déjà créées) :

```sql
create table classes (
  id text primary key,
  enseignant_nom text,
  nom text,
  created_at timestamptz default now()
);

create table eleves_classe (
  id bigint generated always as identity primary key,
  classe_id text,
  prenom text,
  created_at timestamptz default now()
);

create table absences (
  id bigint generated always as identity primary key,
  classe_id text,
  eleve_id bigint,
  date date,
  present boolean,
  created_at timestamptz default now()
);

create table notes_eleves (
  id bigint generated always as identity primary key,
  classe_id text,
  eleve_id bigint,
  matiere text,
  note numeric,
  created_at timestamptz default now()
);

alter table classes enable row level security;
alter table eleves_classe enable row level security;
alter table absences enable row level security;
alter table notes_eleves enable row level security;

create policy "Autoriser tout pour demarrer" on classes for all using (true) with check (true);
create policy "Autoriser tout pour demarrer" on eleves_classe for all using (true) with check (true);
create policy "Autoriser tout pour demarrer" on absences for all using (true) with check (true);
create policy "Autoriser tout pour demarrer" on notes_eleves for all using (true) with check (true);
```

Cliquez sur **"Run"** — vous devriez obtenir "Success. No rows returned", comme la première fois.

## Étape 2 (ter) — Rendre l'Espace Enseignant payant

Pour activer le système de paiement (Wave/Orange Money + code d'accès), collez ce bloc supplémentaire dans **"SQL Editor" → "New query"** :

```sql
alter table classes add column if not exists actif boolean default false;

create table codes_activation (
  code text primary key,
  utilise boolean default false,
  classe_id text,
  date_utilisation timestamptz,
  created_at timestamptz default now()
);

alter table codes_activation enable row level security;
create policy "Autoriser tout pour demarrer" on codes_activation for all using (true) with check (true);
```

Cliquez sur **"Run"**.

### Comment générer un code à donner à un enseignant qui a payé
1. Un enseignant vous envoie 2 000 FCFA via Wave/Orange Money.
2. Allez sur Supabase → **"Table Editor"** → table **`codes_activation`**.
3. Cliquez sur **"Insert row"** (ou "+").
4. Dans le champ `code`, inventez un code unique, par exemple **`SJANG-A3F9-2026`** (le format n'a pas d'importance, tant qu'il est unique).
5. Laissez `utilise` sur **false**, laissez les autres champs vides.
6. Sauvegardez, puis envoyez ce code à l'enseignant (par SMS/WhatsApp).
7. L'enseignant colle ce code dans l'app pour débloquer son espace — le code passe alors automatiquement à `utilise = true` et ne pourra plus être réutilisé par quelqu'un d'autre.

### Personnaliser votre numéro de paiement dans l'app
Ouvrez `index.html`, cherchez **`[VOTRE NUMÉRO ICI]`**, et remplacez par votre numéro Wave ou Orange Money réel. Enregistrez, puis redéployez sur Netlify.

### L'Espace Enseignant est gratuit pour le moment
L'accès à l'Espace Enseignant (élèves, points, absences, notes, bulletins) ne demande plus de code d'activation — un enseignant qui crée son profil y accède directement. Si vous voulez remettre le paiement en place plus tard, dites-le-moi.

## Étape 2 (bis-bis) — Activer les points de la classe (nouvelle fonctionnalité)

L'onglet **Élèves** de l'Espace Enseignant permet maintenant de donner des points à chaque élève (comportement, participation, devoirs faits...), avec un petit badge qui évolue — 🌱 Jeune pousse, 🌿 En pleine croissance, 🌳 Bel arbre, 🏆 Champion de la classe. Pour que ces points soient sauvegardés en ligne (et pas seulement pendant la session en cours), ajoutez cette colonne dans **SQL Editor → New query** :

```sql
alter table eleves_classe add column if not exists points integer default 0;
```

Cliquez sur **"Run"**. Sans cette étape, les boutons +/− fonctionnent quand même à l'écran, mais les points ne seront pas conservés d'une session à l'autre.

## Étape 2 (bis-ter) — Activer le parcours « Franco-arabe » (nouvelle fonctionnalité)

L'écran de connexion propose maintenant un choix de parcours à la création du profil élève : **École classique** (par défaut) ou **Franco-arabe**. Seuls les élèves ayant choisi « Franco-arabe » voient apparaître, sur leur écran d'accueil, une nouvelle tuile **« القسم العربي » (Espace Arabe)** menant à un espace séparé de leçons d'Arabe et d'Éducation islamique — entièrement rédigées en arabe — classées par niveau (CI à Terminale). Les élèves en parcours classique ne voient jamais cette tuile ni ce contenu.

Pour que ce choix soit sauvegardé en ligne (et pas seulement sur l'appareil de l'élève), ajoutez cette colonne dans **SQL Editor → New query** :

```sql
alter table eleves add column if not exists track text default 'classique';
```

Cliquez sur **"Run"**. Sans cette étape, le choix du parcours fonctionne quand même sur l'appareil de l'élève (via la mémoire locale), mais ne sera pas conservé si l'élève change d'appareil.

## Étape 2 (bis-quater) — Activer l'Espace Directeur (nouvelle fonctionnalité)

Un nouveau bouton **« Espace Directeur »** (gratuit) apparaît sur l'écran de connexion, à côté de l'Espace Enseignant. Un chef d'établissement peut y créer un espace pour son école, ce qui génère un **code établissement** (ex. `SJANG-ETB-A3F9`) à partager avec ses enseignants. Quand un enseignant crée sa classe, il peut coller ce code dans le champ optionnel « Code établissement » — sa classe apparaît alors automatiquement dans le tableau de bord du directeur, avec le nombre d'élèves et les points moyens de chaque classe.

Pour activer cette fonctionnalité, collez ce bloc dans **SQL Editor → New query** :

```sql
create table etablissements (
  code text primary key,
  nom text,
  directeur_nom text,
  created_at timestamptz default now()
);

alter table etablissements enable row level security;
create policy "Autoriser tout pour demarrer" on etablissements for all using (true) with check (true);

alter table classes add column if not exists code_etablissement text;
```

Cliquez sur **"Run"**. Sans cette étape, le bouton Espace Directeur affiche un message indiquant que la base de données n'est pas encore configurée.

### Comment ça fonctionne, concrètement
1. Le directeur clique sur **« Créer mon espace »**, entre son nom et le nom de l'établissement — un code est généré automatiquement et affiché en haut du tableau de bord.
2. Le directeur partage ce code avec ses enseignants (SMS, WhatsApp, tableau d'affichage...).
3. Chaque enseignant colle ce code dans le champ optionnel de l'écran « Espace Enseignant » en créant sa classe.
4. Le tableau de bord du directeur se met à jour automatiquement : nombre de classes, nombre total d'élèves, points moyens, et le détail par classe.
5. Si le directeur change d'appareil, il retrouve son espace en cliquant sur **« J'ai déjà un code »** et en entrant le code établissement.

## Étape 2 (quinquies) — Activer l'Espace Parent (nouvelle fonctionnalité)

Un nouveau bouton **« Espace Parent »** (gratuit) apparaît sur l'écran de connexion. Dans l'Espace Enseignant, onglet **Élèves**, chaque élève a maintenant un bouton **« Générer »** un code parent (ex. `SJANG-ELV-A3F9K`), avec un bouton **« Partager »** pour l'envoyer directement par WhatsApp. Le parent entre ce code dans l'Espace Parent et voit — en lecture seule — les notes, l'assiduité et le bulletin de son enfant, avec un bouton pour l'imprimer.

Pour activer cette fonctionnalité, collez ce bloc dans **SQL Editor → New query** :

```sql
alter table eleves_classe add column if not exists code_parent text;
```

Cliquez sur **"Run"**. Sans cette étape, le bouton "Générer" un code parent ne fonctionnera pas (l'écran affichera une erreur générique).

## Étape 2 (sexies) — Activer le Classement de classe (nouvelle fonctionnalité)

Une nouvelle tuile **« Classement de classe »** apparaît sur l'accueil des élèves. Dans l'Espace Enseignant, un nouvel onglet **« Classement »** permet de générer un code de classe (ex. `SJANG-CLS-A3F9`) et de le partager par WhatsApp. Les élèves entrent ce code pour voir le classement des points (top 3 + leur propre position), sans avoir accès à rien d'autre.

Pour activer cette fonctionnalité, collez ce bloc dans **SQL Editor → New query** :

```sql
alter table classes add column if not exists code_classe text;
```

Cliquez sur **"Run"**. Sans cette étape, le bouton "Générer le code" dans l'onglet Classement ne fonctionnera pas.

## Étape 2 (septies) — Activer l'Espace Inscription (nouvelle fonctionnalité)

Un nouveau bouton **« Espace Inscription »** apparaît sur l'écran de connexion. Un parent y entre le **code établissement** de l'école (donné par le directeur), choisit une classe existante, remplit les informations de l'enfant (nom, âge, niveau) et les siennes, puis voit les instructions de paiement (numéro Wave/Orange Money et montant définis par le directeur, dans son tableau de bord, onglet **« Inscriptions »**). Le parent entre sa référence de paiement et envoie la demande. Le directeur retrouve toutes les demandes en attente dans ce même onglet et clique **« Accepter »** (l'enfant est ajouté à la classe choisie et un code parent est généré automatiquement) ou **« Refuser »**.

Pour activer cette fonctionnalité, collez ce bloc dans **SQL Editor → New query** :

```sql
create table demandes_inscription (
  id bigint generated always as identity primary key,
  code_etablissement text,
  classe_id text,
  classe_nom text,
  enfant_nom text,
  enfant_age integer,
  enfant_niveau text,
  parent_nom text,
  parent_telephone text,
  reference_paiement text,
  statut text default 'en_attente',
  created_at timestamptz default now()
);

alter table demandes_inscription enable row level security;
create policy "Autoriser tout pour demarrer" on demandes_inscription for all using (true) with check (true);

alter table etablissements add column if not exists frais_inscription text;
alter table etablissements add column if not exists paiement_numero text;
```

Cliquez sur **"Run"**. Sans cette étape, le bouton Espace Inscription affiche un message indiquant que la base de données n'est pas encore configurée, et l'onglet Inscriptions du Directeur reste vide.

### Comment ça fonctionne, concrètement
1. Le directeur ouvre son tableau de bord → onglet **« Inscriptions »** → renseigne les frais d'inscription et son numéro Wave/Orange Money (facultatif, mais recommandé pour que les parents sachent quoi payer).
2. Un parent clique sur **« Espace Inscription »**, entre le code établissement, choisit la classe de son enfant parmi celles déjà créées par les enseignants, remplit le formulaire, paie via le numéro affiché, entre sa référence de paiement et envoie.
3. La demande apparaît dans l'onglet Inscriptions du directeur, avec toutes les informations et la référence de paiement à vérifier.
4. En cliquant **« Accepter »**, l'enfant est ajouté directement au registre de la classe choisie (comme s'il avait été ajouté à la main par l'enseignant) et un code parent est généré et affiché, à partager avec la famille pour qu'elle puisse suivre les résultats dans l'Espace Parent.
5. **« Refuser »** marque simplement la demande comme refusée, sans rien ajouter à la classe.

## Étape 2 (quater) — Rendre l'Espace Exercices payant (élèves)

L'Espace Exercices (500 FCFA/mois, accessible aux élèves) réutilise la même table `codes_activation`. Il faut juste ajouter une colonne à la table `eleves` et une colonne à `codes_activation` pour distinguer les codes élèves des codes enseignants :

```sql
alter table eleves add column if not exists actif boolean default false;
alter table codes_activation add column if not exists eleve_id text;
```

Cliquez sur **"Run"**.

### Comment générer un code pour un élève qui a payé
1. Un élève (ou son parent) vous envoie 500 FCFA via Wave/Orange Money.
2. Allez sur Supabase → **"Table Editor"** → table **`codes_activation`**.
3. Cliquez sur **"Insert row"**.
4. Dans le champ `code`, inventez un code unique, par exemple **`SJANG-EXO-B7K2`**.
5. Laissez `utilise` sur **false**, laissez les autres champs vides.
6. Envoyez ce code à l'élève.
7. L'élève colle ce code dans l'app (via "Exercices +" sur l'écran d'accueil) pour débloquer l'Espace Exercices.

**Astuce pour ne pas confondre les codes enseignants et élèves :** donnez-leur un format différent, par exemple `SJANG-ENS-XXXX` pour les enseignants et `SJANG-EXO-XXXX` pour les élèves — ce n'est pas obligatoire techniquement, mais ça vous évite toute confusion en les générant.

## Étape 4 — Activer SMN, l'assistant IA (gratuit avec Google Gemini)

1. Allez sur **aistudio.google.com/apikey** et connectez-vous avec un compte Google (aucune carte bancaire nécessaire).
2. Cliquez sur **"Create API key"**, puis copiez la clé obtenue.
3. Ouvrez `index.html`, cherchez `VOTRE_CLE_GEMINI_ICI`, et remplacez par votre vraie clé (gardez les guillemets).
4. Enregistrez, puis redéployez sur Netlify.

**Coût réel : 0 FCFA.** Le niveau gratuit de Gemini permet environ 1500 questions par jour, largement suffisant pour démarrer — aucun paiement requis.

**À savoir :** avec l'offre gratuite, Google peut utiliser les questions posées pour améliorer ses produits (ce n'est pas totalement privé). Pour un usage d'aide aux devoirs, ce n'est généralement pas un problème, mais c'est bon à savoir.

## Étape 3 — Copier vos 2 clés
1. Dans le menu de gauche, allez dans **"Project Settings"** (icône ⚙️) → **"API"**.
2. Copiez la **"Project URL"** (ressemble à `https://xxxxx.supabase.co`).
3. Copiez la clé **"anon public"** (une longue chaîne de caractères).

## Étape 4 — Coller ces 2 valeurs dans l'app
1. Ouvrez `index.html` avec un éditeur de texte.
2. Cherchez ce bloc, en haut du `<script>` :
```js
const supabaseUrl = "VOTRE_PROJECT_URL";
const supabaseKey = "VOTRE_CLE_ANON_PUBLIC";
```
3. Remplacez les deux valeurs par celles copiées à l'étape 3 (gardez les guillemets).
4. Enregistrez, puis redéposez le dossier `pwa` sur Netlify.

## Ce qui fonctionne une fois configuré
- **Écran de connexion** (prénom + classe) au premier lancement.
- **Sauvegarde automatique** de chaque quiz terminé.
- **Mode hors-ligne** : si pas d'internet au moment de finir un quiz, le résultat est gardé sur l'appareil et envoyé automatiquement dès que la connexion revient (dès que l'app détecte le retour du réseau).
- **Écran Progrès** qui lit les vraies données sauvegardées à chaque ouverture.

## Si vous ne configurez rien
L'app continue de fonctionner normalement en local, simplement sans partage de la progression entre appareils.

## Pourquoi c'est plus simple que Firebase
- 2 valeurs à copier au lieu de 6.
- Les tables se créent en collant un seul bloc SQL, au lieu de cliquer dans plusieurs écrans.
- L'interface Supabase permet de voir et modifier les données directement dans un tableau, comme un tableur — pratique pour vérifier que tout fonctionne.
