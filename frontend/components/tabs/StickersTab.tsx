"use client";

import { AppState, boardCap, totalStickers } from "@/lib/state";
import { boardSVG, gridBoardSVG, stampSVG } from "@/lib/trees";

export function StickersTab({ state }: { state: AppState }) {
  // 칭찬나무는 목표(꿈) 단위 — 스티커를 1개라도 받은 목표만 나무로 표시(빈 나무 숨김).
  const items = state.dreams.filter(
    (d) => (d.earned ?? 0) > 0 || (d.stamps ?? 0) > 0 || (d.stickers?.length ?? 0) > 0,
  );

  const total = totalStickers(state);
  const stamps = items.reduce((s, d) => s + (d.stamps ?? 0), 0);

  return (
    <section>
      <div className="sec-title">
        <h2>칭찬나무</h2>
      </div>

      {items.length > 0 && (
        <div className="muted" style={{ textAlign: "center", fontWeight: 700, margin: "2px 4px 14px" }}>
          스티커 <b style={{ color: "var(--primary-d)" }}>{total}</b>
          {stamps > 0 && ` · 도장 ${stamps}`}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty">
          ‘나의 목표’에서 목표를 만들고
          <br />
          할 일을 완료하면 나무가 자라요.
        </div>
      ) : (
        items.map((dream) => {
          const cap = boardCap(dream);
          const len = dream.stickers?.length ?? 0;
          const gold = len >= cap;
          // 10칸이면 테마 그림, 그 외엔 격자(도장 카드).
          const html = cap === 10 ? boardSVG(dream, dream.theme || "tree") : gridBoardSVG(dream, cap, dream.color || "#46b97c");
          return (
            <div className={"tree-card" + (gold ? " done" : "")} key={dream.id}>
              <div className="tree-title">
                {dream.emoji} {dream.title}
                <span>{gold ? "완성 🎉" : `${len} / ${cap}`}</span>
              </div>
              {dream.stamps ? <div className="tree-from">도장 {dream.stamps}{dream.targetDate ? " · 디데이까지" : ""}</div> : null}
              <div style={{ position: "relative", lineHeight: 0 }}>
                <div dangerouslySetInnerHTML={{ __html: html }} />
                {gold && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(70,78,70,.34)" }}>
                    <div dangerouslySetInnerHTML={{ __html: stampSVG(150) }} />
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
