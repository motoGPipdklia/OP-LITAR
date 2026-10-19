const CACHE_NAME = "skpo-op-litar-20261019-002";

const APP_SHELL = [
  "./", "./index.html", "./admin.html", "./manifest.json",
  "./css/style.css", "./css/index.css", "./css/admin.css",
  "./js/api-config.js", "./js/supabase-client.js", "./js/index.js", "./js/admin.js",
  "./js/walkie-petugas.js", "./js/pwa-install.js",
  "./images/logo-utama.png", "./images/logo-gabungan.png", "./images/background.jpg",
  "./images/peta.png", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    for (const url of APP_SHELL) {
      try { await cache.add(new Request(url, {cache:"reload"})); } catch (_) {}
    }
  }));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html")))
  );
});
