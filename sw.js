/* ==========================================
   极简记账本 V1.7.1 — Service Worker
   缓存优先 (Cache First) 策略
   强化自动更新：激活后自动刷新所有页面
========================================== */

// 自动生成缓存版本号（每次 SW 更新时自动产生新版本）
const CACHE_VERSION = 'cache-v' + new Date().getTime();

// 需要预缓存的核心文件
var CORE_FILES = [
  "./",
  "index.html",
  "stats.html",
  "manifest.json",
  "icon.png"
];

/* ---------- install：预缓存核心文件，立即激活 ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CORE_FILES);
    })
  );
  // 跳过等待，让新的 SW 检测到更新后立即激活，不等待旧 SW 释放
  self.skipWaiting();
});

/* ---------- activate：清理旧缓存 → 接管页面 → 自动刷新 ---------- */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      // 删除所有旧版本缓存
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== CACHE_VERSION) {
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      // 立即接管所有已打开的页面（不等待用户关闭标签页）
      return self.clients.claim();
    }).then(function () {
      // 遍历所有已打开的客户端标签页，发送刷新指令
      return self.clients.matchAll({ type: "window" }).then(function (clients) {
        clients.forEach(function (client) {
          // navigate 到自身 URL 实现页面自动刷新
          client.navigate(client.url);
        });
      });
    })
  );
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
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});