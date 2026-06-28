// 무럭무럭 서비스워커.
// 핵심: HTML 문서는 "네트워크 우선" — 새 배포가 즉시 반영되도록.
// (캐시 우선으로 옛 HTML을 서빙하면, 바뀐 JS 청크 파일명을 못 찾아 앱이 크래시함)
const CACHE = "muruk-v4";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // 새 워커가 잡히면, 열려 있는(옛 캐시로 떠 있던) 화면을 강제로 새로고침해 최신으로 교체.
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => "navigate" in c && c.navigate(c.url)))
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  // HTML 문서(페이지 이동): 네트워크 우선 → 항상 최신, 오프라인이면 캐시 폴백.
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/")))
    );
    return;
  }

  // 그 외(_next 해시 자산, 이미지 등): 캐시 우선(내용이 바뀌면 파일명이 바뀌므로 안전).
  e.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached)
    )
  );
});

// 알림 클릭 시 앱 창으로 포커스(없으면 새로 연다).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cls) => {
      for (const c of cls) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
