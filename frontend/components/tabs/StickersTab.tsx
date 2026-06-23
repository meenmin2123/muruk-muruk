"use client";

import { AppState, BOARD, totalStickers } from "@/lib/state";
import { boardSVG, stampSVG } from "@/lib/trees";

export function StickersTab({ state }: { state: AppState }) {
  // 칭찬판은 목표(꿈) 단위 — 할 일이 하나라도 있는 목표마다 나무 한 그루.
  const items = state.dreams.filter((d) => d.goals.length > 0);

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
          const len = dream.stickers?.length ?? 0;
          const gold = len >= BOARD;
          return (
            <div className={"tree-card" + (gold ? " done" : "")} key={dream.id}>
              <div className="tree-title">
                {dream.emoji} {dream.title}
                <span>{gold ? "완성 🎉" : `${len} / ${BOARD}`}</span>
              </div>
              {dream.stamps ? <div className="tree-from">도장 {dream.stamps}</div> : null}
              <div style={{ position: "relative", lineHeight: 0 }}>
                <div dangerouslySetInnerHTML={{ __html: boardSVG(dream, dream.theme || "tree") }} />
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
