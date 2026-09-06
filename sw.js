// Service worker — Sunu Jàng
// Met l'application en cache pour qu'elle fonctionne hors-ligne après la première visite.

const CACHE_NAME = "sunu-jang-cache-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png"
];

// Installation : on met en cache les fichiers essentiels de l'application
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activation : on supprime les anciennes versions du cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Une réponse "opaque" (status 0) vient d'une requête cross-origin sans CORS
// (police Google Fonts, script Supabase depuis un CDN, etc.) : on ne peut pas
// lire son contenu, mais on peut quand même la mettre en cache pour le hors-ligne.
function isCacheableResponse(response) {
  return response && (response.status === 200 || response.type === "opaque");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isAppPage =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/");

  if (isAppPage) {
    // Page principale de l'appli : on essaie toujours le réseau en premier,
    // pour que les élèves aient la dernière version dès qu'ils sont connectés.
    // On ne retombe sur le cache qu'en l'absence de connexion.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Tout le reste (icônes, polices, script Supabase, etc.) : on sert le cache
  // en priorité pour la rapidité et le hors-ligne, et on met à jour le cache
  // en arrière-plan quand le réseau répond.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // hors-ligne : on retombe sur le cache

      return cached || networkFetch;
    })
  );
});
