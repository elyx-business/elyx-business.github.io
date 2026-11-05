/* Elyx для iPhone: программа сохраняется на телефоне и открывается без интернета. Данные бизнеса здесь не хранятся —
   только файлы программы с этого сайта. Новая версия подхватывается при следующем открытии. */
const CACHE = "elyx-2.9.34-194a961387aa";
const B = "?v=194a961387aa";
const CORE = ["app.js", "app.css", "style.css", "web_native.js", "py/pyodide.js", "guard.js"].map((f) => f + B);
/* Файлы Python (Pyodide, колёса), шрифты и картинки внутри одной сборки не меняются: имя кэша содержит номер
   сборки, а старые кэши стираются при обновлении. Поэтому их берём из кэша и не качаем заново при каждом запуске —
   иначе первый запуск по мобильному интернету повторялся бы снова и снова (это десятки мегабайт). */
const FIXED = /^\/(py|fonts|img|ocr)\//;
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...CORE, "./"].map((u) => new Request(u, { cache: "reload" }))))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// страница присылает адреса уже скачанных файлов Python — кладём их в кэш (браузер отдаст их из своего кэша, без сети)
self.addEventListener("message", (e) => {
  const urls = e.data && Array.isArray(e.data.keep) ? e.data.keep.filter((u) => typeof u === "string" && u.startsWith(self.location.origin + "/py/")) : [];
  if (!urls.length) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.match(u, { ignoreSearch: true })
    .then((hit) => hit || fetch(u).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // чужие адреса не кэшируем и не трогаем
  // файлы с номером сборки в адресе и файлы Python неизменны — их берём из кэша; страницу — сначала из сети,
  // без интернета — из кэша. Так старая версия файла не может попасть в новую страницу.
  if (u.search.startsWith("?v=") || FIXED.test(u.pathname.replace(/^\/app\//, "/"))) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request, { ignoreSearch: !u.search.startsWith("?v=") });
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  // страницу — всегда сверяем с сайтом (no-cache): после обновления сайта старая страница не покажется
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === "navigate" ? caches.match("./") : Response.error()))));
});
