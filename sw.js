/* Elyx для iPhone: программа сохраняется на телефоне и открывается без интернета. Данные бизнеса здесь не хранятся —
   только файлы программы с этого сайта. Новая версия подхватывается при следующем открытии. */
const CACHE = "elyx-2.9.22-8e5e8cd6d1ff";
const B = "?v=8e5e8cd6d1ff";
const CORE = ["app.js", "app.css", "style.css", "web_native.js", "py/pyodide.js", "guard.js"].map((f) => f + B);
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...CORE, "./"].map((u) => new Request(u, { cache: "reload" }))))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // чужие адреса не кэшируем и не трогаем
  // файлы с номером сборки в адресе неизменны — их берём из кэша; всё остальное (страница, файлы Python) — сначала из сети,
  // без интернета — из кэша. Так старая версия файла не может попасть в новую страницу.
  if (u.search.startsWith("?v=")) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  // страницу и файлы Python — всегда сверяем с сайтом (no-cache): после обновления сайта старая страница не покажется
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === "navigate" ? caches.match("./") : Response.error()))));
});
