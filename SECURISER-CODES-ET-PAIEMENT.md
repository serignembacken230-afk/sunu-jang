# Sécuriser les codes d'activation et le paiement — pas à pas

## Le problème, en clair

Dans la version actuelle, l'application vérifie et valide les codes d'activation **directement depuis le téléphone de l'utilisateur**, avec la clé Supabase visible dans `index.html`. Concrètement, cela veut dire que n'importe qui d'un peu curieux (ouvrir les outils développeur du navigateur, ou même un simple appel avec cette clé) peut aujourd'hui :

- **lire tous les codes d'activation** dans la table `codes_activation`, y compris ceux qui n'ont jamais été vendus, et les utiliser gratuitement ;
- **activer un compte enseignant ou élève sans code du tout**, en appelant directement Supabase pour mettre `actif = true`, sans jamais passer par l'écran de paiement.

Ce n'est pas une négligence de votre part : c'est simplement que la « porte » du paiement est aujourd'hui posée côté téléphone (JavaScript), alors qu'elle doit être posée côté serveur pour être vraiment fermée. La correction ci-dessous déplace cette vérification vers une petite fonction serveur (une **Supabase Edge Function**), et verrouille les tables sensibles pour qu'on ne puisse plus les toucher directement depuis l'app.

**Ce que ça ne corrige pas** : les autres tables (`eleves_classe`, `absences`, `notes_eleves`, `resultats_quiz`) restent lisibles/modifiables par n'importe qui possédant la clé, car l'app n'utilise pas de vrai compte utilisateur (Supabase Auth) — les identifiants élève/classe sont de simples chaînes générées dans le téléphone, pas des comptes protégés. Ce n'est pas un risque financier (personne ne peut « voler » un cours), plutôt un risque de confidentialité (quelqu'un de déterminé pourrait lire les notes d'un autre élève). Le corriger proprement demande d'ajouter de vrais comptes (Supabase Auth) — une étape plus lourde, à envisager plus tard si l'app grandit. Ce guide se concentre sur le risque qui touche votre argent.

---

## Étape 1 — Verrouiller les tables sensibles (2 minutes)

Allez sur **supabase.com** → votre projet → **SQL Editor** → **New query**, collez ce bloc, puis cliquez sur **Run**.

```sql
-- 1) codes_activation : plus aucun accès direct depuis l'app.
--    (RLS reste activé ; sans policy, personne ne peut lire ni écrire
--    cette table avec la clé publique — seule la fonction serveur,
--    créée à l'étape 2, pourra encore y toucher.)
drop policy if exists "Autoriser tout pour démarrer" on codes_activation;
drop policy if exists "Autoriser tout pour demarrer" on codes_activation;

-- 2) classes : l'app peut encore créer une classe et lire si elle est
--    active, mais ne peut plus la rendre active elle-même.
drop policy if exists "Autoriser tout pour démarrer" on classes;
drop policy if exists "Autoriser tout pour demarrer" on classes;
create policy "Lecture classes" on classes for select using (true);
create policy "Création classes" on classes for insert with check (true);

-- 3) eleves : pareil : créer un profil et lire son statut restent
--    autorisés, mais plus moyen de s'auto-activer.
drop policy if exists "Autoriser tout pour démarrer" on eleves;
drop policy if exists "Autoriser tout pour demarrer" on eleves;
create policy "Lecture eleves" on eleves for select using (true);
create policy "Création eleves" on eleves for insert with check (true);
```

Vous devriez voir "Success. No rows returned".

> ⚠️ Une fois ce bloc exécuté, les écrans de paiement de l'app **ne fonctionneront plus** tant que vous n'avez pas fait l'étape 2 et 3 ci-dessous (c'est normal : c'est justement la porte qu'on vient de fermer côté client — il faut la rouvrir côté serveur).

---

## Étape 2 — Créer la fonction serveur qui valide les codes (5-10 minutes)

Cette fonction (une "Edge Function") tourne sur les serveurs de Supabase, jamais dans le téléphone de l'utilisateur — c'est elle, et elle seule, qui aura le droit de vérifier un code et d'activer un compte.

### Créer la fonction depuis le tableau de bord (pas de ligne de commande)

1. Dans votre projet Supabase, menu de gauche → **Edge Functions**.
2. Cliquez sur **"Deploy a new function"** (ou **"Create a new function"**).
3. Donnez-lui le nom exact : `activer-code`
4. Si on vous propose un éditeur dans le navigateur ("Via Editor"), choisissez-le. Effacez le code d'exemple et collez celui-ci à la place :

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, type, id } = await req.json()

    if (!code || !type || !id || (type !== 'enseignant' && type !== 'eleve')) {
      return new Response(JSON.stringify({ error: "Paramètres manquants ou invalides." }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const codeNormalise = String(code).trim().toUpperCase()

    const { data: codeRow, error: codeErr } = await admin
      .from('codes_activation')
      .select('*')
      .eq('code', codeNormalise)
      .single()

    if (codeErr || !codeRow) {
      return new Response(JSON.stringify({ error: "Ce code n'existe pas." }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (codeRow.utilise) {
      return new Response(JSON.stringify({ error: "Ce code a déjà été utilisé." }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'enseignant') {
      await admin.from('codes_activation').update({
        utilise: true, classe_id: id, date_utilisation: new Date().toISOString(),
      }).eq('code', codeNormalise)
      await admin.from('classes').update({ actif: true }).eq('id', id)
    } else {
      await admin.from('codes_activation').update({
        utilise: true, eleve_id: id, date_utilisation: new Date().toISOString(),
      }).eq('code', codeNormalise)
      await admin.from('eleves').update({ actif: true }).eq('id', id)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur serveur." }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

5. Cliquez sur **Deploy**.
6. Dans les réglages de la fonction, vérifiez qu'**"Enforce JWT verification"** (ou "Verify JWT") est **désactivé** — sinon l'app ne pourra pas l'appeler avec la clé publique. (`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà fournis automatiquement par Supabase à toutes les fonctions, rien à configurer pour ça.)

> Si le bouton "Via Editor" n'apparaît pas sur votre projet, c'est que votre projet demande le passage par la ligne de commande (Supabase CLI) pour déployer les fonctions — dites-le-moi et je vous détaille cette option-là à la place.

---

## Étape 3 — Faire appeler cette fonction par l'app (2 modifications dans `index.html`)

Ouvrez `index.html` avec un éditeur de texte, et faites les deux remplacements suivants.

### Modification A — activation enseignant

Cherchez la fonction `activateTeacherAccess`. À l'intérieur, remplacez ce bloc :

```js
  const { data: codeRow, error: codeErr } = await sb.from('codes_activation')
    .select('*').eq('code', code).single();

  if(codeErr || !codeRow){
    errorEl.textContent = "Ce code n'existe pas. Vérifiez qu'il est bien saisi.";
    errorEl.style.display = 'block';
    return;
  }
  if(codeRow.utilise){
    errorEl.textContent = "Ce code a déjà été utilisé.";
    errorEl.style.display = 'block';
    return;
  }

  await sb.from('codes_activation').update({
    utilise: true, classe_id: currentTeacher.classeId, date_utilisation: new Date().toISOString()
  }).eq('code', code);
  await sb.from('classes').update({ actif: true }).eq('id', currentTeacher.classeId);
```

par celui-ci :

```js
  const resp = await fetch(`${supabaseUrl}/functions/v1/activer-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ code, type: 'enseignant', id: currentTeacher.classeId }),
  });
  const result = await resp.json();
  if(!resp.ok){
    errorEl.textContent = result.error || "Ce code n'est pas valide.";
    errorEl.style.display = 'block';
    return;
  }
```

### Modification B — activation élève (Espace Exercices)

Cherchez la fonction `activateExercicesAccess`. Remplacez ce bloc :

```js
  const { data: codeRow, error: codeErr } = await sb.from('codes_activation')
    .select('*').eq('code', code).single();

  if(codeErr || !codeRow){
    errorEl.textContent = "Ce code n'existe pas. Vérifie qu'il est bien saisi.";
    errorEl.style.display = 'block';
    return;
  }
  if(codeRow.utilise){
    errorEl.textContent = "Ce code a déjà été utilisé.";
    errorEl.style.display = 'block';
    return;
  }

  await sb.from('codes_activation').update({
    utilise: true, eleve_id: currentStudent.id, date_utilisation: new Date().toISOString()
  }).eq('code', code);
  await sb.from('eleves').update({ actif: true }).eq('id', currentStudent.id);
```

par celui-ci :

```js
  const resp = await fetch(`${supabaseUrl}/functions/v1/activer-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ code, type: 'eleve', id: currentStudent.id }),
  });
  const result = await resp.json();
  if(!resp.ok){
    errorEl.textContent = result.error || "Ce code n'est pas valide.";
    errorEl.style.display = 'block';
    return;
  }
```

Enregistrez, puis redéployez le dossier `pwa` sur Netlify (ou GitHub Pages) comme d'habitude.

---

## Étape 4 — Tester

1. Créez un code de test dans **Table Editor → codes_activation** (comme d'habitude).
2. Sur l'app, essayez de l'entrer : ça doit activer normalement l'accès.
3. Réessayez le même code une deuxième fois : vous devez voir "Ce code a déjà été utilisé."
4. Essayez un code inventé : vous devez voir "Ce code n'existe pas."
5. Si vous voulez vérifier que le verrou tient, ouvrez les outils développeur du navigateur (F12) → onglet Réseau, et confirmez qu'aucune requête directe vers `codes_activation` n'apparaît plus — seule une requête vers `.../functions/v1/activer-code` doit apparaître.

---

## Et la clé Gemini (SMN) ?

Moins urgent (l'usage est gratuit, sans carte bancaire liée), mais le même principe s'applique : quelqu'un qui récupère la clé dans le code source pourrait épuiser vos 1500 requêtes/jour et bloquer SMN pour vos élèves. La solution est la même — une petite Edge Function qui appelle Gemini avec la clé côté serveur, jamais exposée. Dites-moi quand vous voulez ce guide-là, je vous l'écris sur le même modèle.
