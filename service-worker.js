const CACHE_NAME = "skpo-op-litar-20261019-print-view-003";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./css/index.css",
  "./js/api-config.js",
  "./js/supabase-client.js",
  "./js/index.js",
  "./js/walkie-petugas.js",
  "./js/pwa-install.js",
  "./images/logo-utama.png",
  "./images/logo-gabungan.png",
  "./images/peta.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of APP_SHELL) {
        try { await cache.add(url); } catch (e) { console.warn("Tidak dapat cache:", url); }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Supabase / API sentiasa utamakan network supaya status semasa tidak basi.
  if (
    /supabase/i.test(url.hostname) ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/functions/v1/")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigasi: network dahulu, fallback cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Asset statik: cache dahulu.
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
    )
  );
});
