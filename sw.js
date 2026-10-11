/* ============================================================================
 * Service Worker · 离线缓存
 * 策略：安装时把整站（主站 + YOLO 子站）全部缓存进手机，之后优先读缓存，
 *       有网时后台顺便更新。改 CACHE_VERSION 数字可强制全量刷新。
 * ==========================================================================*/
var CACHE_VERSION = 'learning-hub-v2';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/app.js',
  './data/hub-data.js',
  './assets/icons/favicon-64.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './yolo11-atlas/index.html',
  './yolo11-atlas/learn.js',
  './yolo11-atlas/learn-demos.js',
  './yolo11-atlas/data-modules-a.js',
  './yolo11-atlas/data-modules-b.js',
  './yolo11-atlas/trace-data.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  /* 站外请求（YouTube、字体等）直接走网络，不缓存 */
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        /* 有缓存：先返回缓存，后台静默更新 */
        e.waitUntil(
          fetch(e.request).then(function (res) {
            if (res && res.ok) {
              return caches.open(CACHE_VERSION).then(function (c) { return c.put(e.request, res); });
            }
          }).catch(function () {})
        );
        return hit;
      }
      /* 无缓存：走网络并顺手缓存 */
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { return c.put(e.request, clone); });
        }
        return res;
      });
    })
  );
});
