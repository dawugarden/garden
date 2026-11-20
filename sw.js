/* 花园小程序 Service Worker：缓存核心资源，离线可用 */
const CACHE = "garden-v3";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "favicon.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(()=>{}));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener("message", e => { if(e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // 页面本身：始终走网络，保证打开就是最新版（离线时才回退缓存）
  if(e.request.mode === "navigate" || /\/$|\/index\.html$/.test(url.pathname)){
    const bust = e.request.url + (e.request.url.includes("?") ? "&" : "?") + "_t=" + Date.now();
    e.respondWith(
      fetch(bust, {cache:"reload"}).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match("index.html")))
    );
    return;
  }
  // photos/ 与图标：缓存优先
  if(url.pathname.includes("/photos/") || /\.(png|jpg|jpeg|webp|svg)$/.test(url.pathname)){
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(()=>hit))
    );
    return;
  }
  // HTML：网络优先，失败回退缓存
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match("index.html")))
  );
});
