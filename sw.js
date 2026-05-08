/* ==========================================
极简记账本 V1.9.3 — Service Worker
   HTML 文件：网络优先 (Network First) 策略
   其他静态资源：缓存优先 (Cache First) 策略
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
  "update-v1.9.3"
];

// HTML 文件名列表（用于判断网络优先策略）
var HTML_FILES = ["index.html", "stats.html"];

/* ---------- 判断请求是否为 HTML 或目录请求 ---------- */
function isHtmlRequest(url) {
  var pathname = new URL(url).pathname;
  // 根目录或子目录请求（以 / 结尾）
  if (pathname === "/" || pathname.endsWith("/")) return true;
  // 匹配 HTML 文件名
  var filename = pathname.split("/").pop();
  return HTML_FILES.indexOf(filename) !== -1;
}

/* ---------- 网络优先策略（用于 HTML 文件） ---------- */
function networkFirst(request) {
  return fetch(request).then(function (networkResponse) {
    // 网络请求成功：将响应克隆一份存入缓存，返回新版给用户
    if (networkResponse && networkResponse.status === 200) {
      var responseToCache = networkResponse.clone();
      caches.open(CACHE_VERSION).then(function (cache) {
        cache.put(request, responseToCache);
      });
    }
    return networkResponse;
  }).catch(function () {
    // 网络请求失败（离线）：从缓存中读取旧版作为兜底
    return caches.match(request);
  });
}

/* ---------- 缓存优先策略（用于非 HTML 文件） ---------- */
function cacheFirst(request, hasVersionParam, requestUrl) {
  return caches.match(request).then(function (cachedResponse) {
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
        return fetchAndCache(request);
      });
    }
    // 缓存未命中：发起网络请求
    return fetchAndCache(request);
  });
}

/* ---------- 请求并缓存 ---------- */
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

/* ---------- install：预缓存核心文件，HTML 强制绕过 HTTP 缓存 ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // HTML 文件用 cache.add() 配合 cache: 'reload' 单独预缓存，确保拿到服务器最新版本
      var htmlPromises = [];
      var htmlUrls = ["./", "index.html", "stats.html"];
      for (var i = 0; i < htmlUrls.length; i++) {
        htmlPromises.push(
          cache.add(new Request(htmlUrls[i], { cache: "reload" }))
        );
      }

      // 其他文件用 cache.addAll() 正常预缓存
      var otherUrls = ["manifest.json", "icon.png"];
      var otherRequests = otherUrls.map(function (url) {
        return new Request(url);
      });

      return Promise.all(htmlPromises).then(function () {
        return cache.addAll(otherRequests);
      });
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

/* ---------- fetch：HTML 网络优先 / 其他缓存优先 ---------- */
self.addEventListener("fetch", function (event) {
  var requestUrl = new URL(event.request.url);
  var hasVersionParam = requestUrl.searchParams.has("v");

  if (isHtmlRequest(event.request.url)) {
    // HTML 文件：网络优先策略
    event.respondWith(networkFirst(event.request));
  } else {
    // 其他文件：缓存优先策略
    event.respondWith(cacheFirst(event.request, hasVersionParam, requestUrl));
  }
});