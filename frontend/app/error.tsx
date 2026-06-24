"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  async function recover() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    location.reload();
  }

  return (
    <div className="errwrap">
      <div className="err-emoji">🌿</div>
      <h2 style={{ margin: "0 0 6px" }}>잠깐 문제가 생겼어요</h2>
      <p className="muted" style={{ margin: "0 0 18px" }}>새로고침하면 대부분 해결돼요.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={recover}>새로고침</button>
        <button className="btn btn-soft" onClick={() => reset()}>다시 시도</button>
      </div>
      <pre className="err-detail">{error?.message || "Unknown error"}{error?.digest ? `\n(${error.digest})` : ""}</pre>
    </div>
  );
}
