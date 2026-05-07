/* ==========================================
   极简记账本 V1.9.0 — Service Worker
   缓存优先 (Cache First) 策略
   自动更新：install 跳过等待 + activate 接管页面 +
   controllerchange 页面自动刷新
========================================== */

// 自动生成缓存版本号（每次 SW 更新时自动产生新版本）
const CACHE_VERSION = 'cache-v' + new Date().getTime();

// 需要预缓存的核心文件
var CORE_FILES = [
  "./",
  "index.html",
  "stats.html",
  "manifest.json",
  "icon.png",
  "update-v1.9.0"
];

/* ---------- install：预缓存核心文件（带版本号查询参数），立即激活 ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // 为每个文件 URL 附加 ?v=CACHE_VERSION 查询参数，确保缓存的是最新版本
      var requests = CORE_FILES.map(function (url) {
        return new Request(url + "?v=" + CACHE_VERSION);
      });
      return cache.addAll(requests);
    })
  );
  // 跳过等待，让新的 SW 检测到更新后立即激活，不等待旧 SW 释放
  self.skipWaiting();
});

/* ---------- activate：清理旧缓存 → 接管页面 ---------- */
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
    })
  );
});

/* ---------- message：页面可主动触发 skipWaiting ---------- */
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ---------- fetch：缓存优先策略 ---------- */
self.addEventListener("fetch", function (event) {
  // 将请求 URL 中的 v= 查询参数剥离，以便匹配缓存
  var requestUrl = new URL(event.request.url);
  var hasVersionParam = requestUrl.searchParams.has("v");

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      // 缓存命中：直接返回缓存
      if (cachedResponse) {
        return cachedResponse;
      }
      // 如果带 v 参数的请求未命中，尝试去掉 v 参数再匹配
      if (hasVersionParam) {
        var urlWithoutV = requestUrl.origin + requestUrl.pathname;
        return caches.match(urlWithoutV).then(function (altCached) {
          if (altCached) return altCached;
          // 仍未命中则发起网络请求
          return fetchAndCache(event.request);
        });
      }
      // 缓存未命中：发起网络请求
      return fetchAndCache(event.request);
    })
  );

  function fetchAndCache(request) {
    return fetch(request).then(function (networkResponse) {
      // 仅缓存成功的 GET 请求
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        request.method === "GET"
      ) {
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(request, responseToCache);
        });
      }
      return networkResponse;
    });
  }
});