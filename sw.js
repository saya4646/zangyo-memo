var CACHE_NAME = "zangyo-memo-v7";
var FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll はログインページなどの非200レスポンスが混ざると失敗するため、
      // 未認証状態で不正なキャッシュが作られることはない
      return cache.addAll(FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isPageRequest(request) {
  if (request.mode === "navigate") {
    return true;
  }
  var url = request.url;
  return url.indexOf("index.html") !== -1 || url.charAt(url.length - 1) === "/";
}

function fetchAndCache(request) {
  return fetch(request).then(function (response) {
    // ログインページ（401）やエラー応答はキャッシュしない
    if (response.ok) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, copy);
      });
    }
    return response;
  });
}

self.addEventListener("fetch", function (event) {
  // ログインフォームの送信（POST）には一切関与しない
  if (event.request.method !== "GET") {
    return;
  }

  if (isPageRequest(event.request)) {
    // キャッシュ優先で即座に表示し、裏でネットワークから更新する
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
        var network = fetchAndCache(event.request);
        if (cached) {
          event.waitUntil(network.catch(function () {}));
          return cached;
        }
        return network.catch(function () {
          return caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      if (cached) {
        return cached;
      }
      return fetchAndCache(event.request);
    })
  );
});
