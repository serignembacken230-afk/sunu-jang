# Sécuriser la clé Gemini (assistant SMN) — pas à pas

## Le problème, en clair

Jusqu'à maintenant, la clé qui permet d'appeler l'IA Gemini (utilisée par l'assistant **SMN**) était écrite en clair dans `index.html`. Concrètement, n'importe qui visitant le site pouvait faire clic-droit → "Afficher le code source" et récupérer cette clé — elle a donc été visible publiquement depuis que le site est en ligne.

**Ce que ça permettrait à quelqu'un de mal intentionné** : utiliser votre quota gratuit Gemini (1500 questions/jour) à votre place, ce qui pourrait bloquer SMN pour vos élèves. Ce n'est pas un risque financier direct (pas de carte bancaire liée), mais ça vaut la peine de corriger.

La correction déplace l'appel à Gemini vers une petite fonction serveur (une **Supabase Edge Function**), exactement comme on l'a fait pour les codes d'activation. La clé y sera stockée en secret, jamais envoyée au téléphone de l'utilisateur.

---

## Étape 0 — Révoquer l'ancienne clé (2 minutes, à faire en premier)

La clé actuellement utilisée par SMN a déjà été exposée publiquement dans le code source du site — il faut la considérer comme compromise, peu importe ce qu'on fait ensuite.

1. Allez sur **https://aistudio.google.com/apikey**
2. Trouvez cette clé dans la liste et **supprimez-la** (ou cliquez sur "Delete"/"Regenerate").
3. Cliquez sur **"Create API key"** pour en créer une toute nouvelle.
4. **Copiez cette nouvelle clé** et gardez-la de côté pour l'étape 2 — elle n'ira nulle part dans `index.html` cette fois.

---

## Étape 1 — Créer la fonction serveur qui appelle Gemini (5-10 minutes)

1. Dans votre projet Supabase, menu de gauche → **Edge Functions**.
2. Cliquez sur **"Deploy a new function"** (ou **"Create a new function"**).
3. Donnez-lui le nom exact : `smn-chat`
4. Choisissez l'éditeur dans le navigateur ("Via Editor"). Effacez le code d'exemple et collez celui-ci à la place :

```ts
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
const smnModel = 'gemini-3.6-flash'
const smnSystemPrompt = "Tu es SMN, un assistant d'étude sympathique pour des élèves sénégalais (du primaire au lycée), dans l'application Sunu Jàng. Réponds en français, de façon simple, claire et encourageante, adaptée à l'âge probable de l'élève. Aide à COMPRENDRE plutôt que de donner juste la réponse finale : explique le raisonnement, donne un exemple si utile. Reste bref (quelques phrases), sauf si l'élève demande plus de détails."

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { history } = await req.json()

    if (!Array.isArray(history) || history.length === 0) {
      return new Response(JSON.stringify({ error: "Message manquant." }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${smnModel}:generateContent?key=${geminiApiKey}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: smnSystemPrompt }] },
        contents: history.slice(-10),
      }),
    })
    const data = await resp.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (reply) {
      return new Response(JSON.stringify({ reply }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify({ error: data?.error?.message || "Réponse inattendue de Gemini." }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur serveur." }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

5. Cliquez sur **Deploy**.
6. Dans les réglages de la fonction, vérifiez qu'**"Enforce JWT verification"** (ou "Verify JWT") est **désactivé** — sinon l'app ne pourra pas l'appeler.

> Si le bouton "Via Editor" n'apparaît pas, c'est que votre projet demande la ligne de commande (Supabase CLI) pour déployer — dites-le-moi et je vous détaille cette option à la place.

---

## Étape 2 — Ajouter la clé Gemini comme secret (2 minutes)

C'est l'étape qui remplace "coller la clé dans index.html" par "la stocker en lieu sûr côté serveur".

1. Toujours dans **Edge Functions**, cherchez l'onglet **"Secrets"** (parfois sous "Manage secrets" ou dans les réglages du projet).
2. Cliquez sur **"Add new secret"**.
3. **Nom** : `GEMINI_API_KEY`
4. **Valeur** : collez la **nouvelle** clé créée à l'étape 0.
5. Enregistrez.

La fonction `smn-chat` va automatiquement pouvoir lire cette valeur via `Deno.env.get('GEMINI_API_KEY')` — sans qu'elle apparaisse jamais dans le code de l'app.

---

## Étape 3 — Le fichier `index.html` est déjà à jour

J'ai déjà modifié le fichier que je vous ai envoyé : il n'y a plus aucune clé Gemini dedans, il appelle simplement `smn-chat`. Vous n'avez rien à modifier vous-même dans le code — utilisez directement la nouvelle version fournie, et redéployez-la sur Netlify (et/ou GitHub) comme d'habitude.

---

## Étape 4 — Tester

1. Ouvrez l'app, allez sur l'assistant **SMN**, posez une question.
2. Vous devez recevoir une vraie réponse (pas un message d'erreur).
3. Si vous voyez "⚠️ Erreur technique", vérifiez :
   - que le secret `GEMINI_API_KEY` est bien enregistré (étape 2) ;
   - que "Enforce JWT verification" est bien désactivé sur `smn-chat` ;
   - que le nom de la fonction est exactement `smn-chat` (comme utilisé dans `index.html`).
4. Ouvrez les outils développeur du navigateur (F12) → onglet Réseau : vous devez voir un appel vers `.../functions/v1/smn-chat`, plus jamais vers `generativelanguage.googleapis.com` directement.
