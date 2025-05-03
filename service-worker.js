self.addEventListener("install", function (e) {
    e.waitUntil(
      caches.open("guia-rapido").then(function (cache) {
        return cache.addAll(["index.html", "cadastro.html", "style.css", "app.js"]);
      })
    );
  });
  
  self.addEventListener("fetch", function (e) {
    e.respondWith(
      caches.match(e.request).then(function (response) {
        return response || fetch(e.request);
      })
    );
  });
  