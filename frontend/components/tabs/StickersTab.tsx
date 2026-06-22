"use client";

import { AppState, BOARD, totalStickers } from "@/lib/state";
import { boardSVG, stampSVG } from "@/lib/trees";

export function StickersTab({ state }: { state: AppState }) {
  const items: { g: AppState["dreams"][number]["goals"][number]; theme: string; dream: AppState["dreams"][number] }[] = [];
  state.dreams.forEach((d) => d.goals.forEach((g) => g.repeat === "daily" && items.push({ g, theme: d.theme || "tree", dream: d })));

  const total = totalStickers(state);
  const stamps = items.reduce((s, x) => s + (x.g.stamps ?? 0), 0);

  return (
    <section>
      <div className="sec-title">
        <h2>칭찬나무</h2>
        <span className="hint">스티커가 열매로 열려요</span>
      </div>

      {items.length > 0 && (
        <div className="muted" style={{ textAlign: "center", fontWeight: 700, margin: "2px 4px 14px" }}>
          🌟 모은 스티커 <b style={{ color: "var(--primary-d)" }}>{total}개</b>
          {stamps > 0 && ` · 🏅 참 잘했어요 도장 ${stamps}개`}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty">
          아직 나무가 없어요.
          <br />
          ‘나의 목표’에서 <b>매일 반복</b> 할 일을 추가하면
          <br />
          나무가 한 그루씩 자라요!
        </div>
      ) : (
        items.map(({ g, theme, dream }) => {
          const len = g.stickers?.length ?? 0;
          const gold = len >= BOARD;
          return (
            <div className={"tree-card" + (gold ? " done" : "")} key={g.id}>
              <div className="tree-title">
                {g.title}
                <span>{gold ? "다 채웠어요! 🎉" : `${len} / ${BOARD}`}</span>
              </div>
              <div className="tree-from">
                {dream.emoji} {dream.title}
                {g.stamps ? ` · 🏅 ${g.stamps}` : ""}
              </div>
              <div style={{ position: "relative", lineHeight: 0 }}>
                <div dangerouslySetInnerHTML={{ __html: boardSVG(g, theme) }} />
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
