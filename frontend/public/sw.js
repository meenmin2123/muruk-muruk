// 무럭무럭 서비스워커 — kill-switch.
// 개발 중 캐시로 옛 버전이 박히는 문제 때문에 SW 캐싱을 비활성화한다.
// 이미 설치된(옛) SW가 이 파일로 갱신되면: 모든 캐시를 비우고, 자기 자신을 등록 해제하고,
// 열린 화면을 한 번 새로고침해 최신본으로 교체한다. fetch 가로채기 없음 → 항상 네트워크.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch {
        /* ignore */
      }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((c) => "navigate" in c && c.navigate(c.url));
      } catch {
        /* ignore */
      }
    })(),
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
    }),
  );
});
