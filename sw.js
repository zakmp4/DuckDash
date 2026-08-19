/* Offline cache, so the game keeps working after the first visit. */
const CACHE = "duckdash-v1";
const FILES = [
  "./", "./index.html", "./manifest.json",
  "./css/style.css",
  "./js/config.js", "./js/save.js", "./js/game.js", "./js/ui.js", "./js/main.js",
  "./img/duck_sheet.png", "./img/anvil.png", "./img/grass_top.png",
  "./img/dirt.png", "./img/backdrop.png", "./img/icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
