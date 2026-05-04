/* ==========================================
   极简记账本 V1.5.0 — Service Worker
   缓存优先 (Cache First) 策略
========================================== */

// 缓存名称（带版本号，便于更新时清理旧缓存）
var CACHE_NAME = "minimal-ledger-v1.5.0";

// 需要预缓存的核心文件
var CORE_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "icon.png"
];

/* ---------- install：预缓存核心文件 ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_FILES);
    })
  );
  // 跳过等待，让新的 SW 立即激活
  self.skipWaiting();
});

/* ---------- activate：清理旧版本缓存 ---------- */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  // 立即接管所有页面
  return self.clients.claim();
});

/* ---------- fetch：缓存优先策略 ---------- */
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      // 缓存命中：直接返回缓存
      if (cachedResponse) {
        return cachedResponse;
      }
      // 缓存未命中：发起网络请求
      return fetch(event.request).then(function (networkResponse) {
        // 仅缓存成功的 GET 请求
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === "GET"
        ) {
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});