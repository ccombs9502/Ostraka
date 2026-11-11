// Ostraka offline support: keeps a copy of the app so it opens without internet.
// Bump VERSION whenever the app files change so phones pick up the update.
const VERSION = "ostraka-web-11";
const FILES = [
  "./", "index.html", "styles.css", "manifest.webmanifest",
  "js/paradigms.js", "js/logic.js", "data/practice.js", "js/tengine.js", "js/translate.js", "js/app.js",
  "data/gnt.js", "fonts/Montserrat.woff2", "fonts/Montserrat-Italic.woff2",
  "icon.png", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Open instantly from the saved copy, and refresh that copy in the background
// so the next launch has any updates.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
