"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AppActions } from "@/lib/store";
import { AppState, daysSinceLastDone, findGoal, rand, todayStr, SLUMP_FALLBACK } from "@/lib/state";
import { todayTreeSVG } from "@/lib/trees";
import { Icon } from "../Icon";

export function TodayTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [text, setText] = useState("");
  const [slump, setSlump] = useState("");
  const [slumpLoading, setSlumpLoading] = useState(false);

  const gap = daysSinceLastDone(state);
  const showSlump = gap >= 3; // 3일 이상 쉰 경우 슬럼프 케어 노출

  async function careForSlump() {
    setSlumpLoading(true);
    try {
      const ctx = JSON.stringify({ 마지막완료로부터일수: gap, 누적완료: state.totalDone, 목표수: state.dreams.length });
      const { message } = await api.coach("slumpCare", ctx);
      setSlump(!message || message.includes("ANTHROPIC_API_KEY") ? rand(SLUMP_FALLBACK) : message);
    } catch {
      setSlump(rand(SLUMP_FALLBACK));
    } finally {
      setSlumpLoading(false);
    }
  }

  const all = state.todos.filter((t) => t.date === todayStr());
  const done = all.filter((t) => t.done).length;

  function add() {
    const v = text.trim();
    if (!v) return;
    actions.addTodo(v, null);
    setText("");
  }

  const rows = (list: typeof all) =>
    list.map((t) => {
      const fg = t.goalId ? findGoal(state, t.goalId) : null;
      const color = fg?.dream.color;
      return (
        <div
          className={"task" + (t.done ? " done" : "") + (fg ? " goal" : "")}
          key={t.id}
          style={color ? ({ "--accent": color } as React.CSSProperties) : undefined}
        >
          <button
            type="button"
            className={"check" + (t.done ? " done" : "")}
            onClick={() => actions.toggleTodo(t.id)}
            aria-pressed={t.done}
            aria-label={(t.done ? "완료 취소: " : "완료: ") + t.text}
          >
            {t.done && <Icon name="check" size={15} color="#fff" />}
          </button>
          <div className="body">
            <div className="txt">{t.text}</div>
            {fg && (
              <div className="meta">
                {fg.goal.title} · {fg.dream.title}
                <span className="meta-tag">{fg.goal.repeat === "daily" ? "매일" : "한 번"}</span>
              </div>
            )}
          </div>
          {!t.done && !(fg && fg.goal.repeat === "daily") && (
            <button className="later" onClick={() => actions.tomorrow(t.id)}>
              내일로
            </button>
          )}
          <button className="x" aria-label="할 일 삭제" onClick={() => actions.removeTodo(t.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      );
    });

  return (
    <section>
      {showSlump && (
        <div className="card" style={{ background: "#fff7ee", border: "1px solid #ffe0b8" }}>
          <div style={{ fontWeight: 700 }}>{gap}일 만이에요</div>
          {slump ? (
            <p style={{ marginTop: 8, lineHeight: 1.6, marginBottom: 0 }}>{slump}</p>
          ) : (
            <>
              <p className="muted" style={{ margin: "4px 0 12px" }}>쉬어가도 괜찮아요. 다시 시작해볼까요?</p>
              <button className="btn" onClick={careForSlump} disabled={slumpLoading}>
                {slumpLoading ? "…" : "다시 시작 응원받기"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="today-tree">
        <div dangerouslySetInnerHTML={{ __html: todayTreeSVG(done, all.length) }} />
        <div className="today-tree-cap">
          {all.length === 0
            ? "오늘의 나무 · 할 일을 더하면 자라기 시작해요"
            : done === 0
            ? "오늘의 나무 · 하나씩 완료하면 열매가 열려요"
            : done >= all.length
            ? `오늘 다 했어요! 🎉 (${done}/${all.length})`
            : `오늘 ${done}/${all.length} 완료`}
        </div>
      </div>

      <div className="addbox today-add">
        <div className="addbar">
          <input
            value={text}
            placeholder="오늘 할 일 적기"
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
            }}
          />
          <button onClick={add}>추가</button>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="empty">
          오늘 할 일이 없어요.
          <br />
          위 입력칸에 바로 적거나 ‘나의 목표’에서 할 일을 더해요.
        </div>
      ) : (
        rows(all)
      )}
    </section>
  );
}
