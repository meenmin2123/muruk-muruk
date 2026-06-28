"use client";

import { useState } from "react";
import { coachMessage } from "@/lib/api";
import type { AppActions } from "@/lib/store";
import { AppState, dateStr, daysSinceLastDone, findGoal, todayStr, SLUMP_FALLBACK } from "@/lib/state";
import { todayTreeSVG } from "@/lib/trees";
import { Icon } from "../Icon";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function TodayTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(todayStr()); // 보고 있는 날짜
  const [slump, setSlump] = useState("");
  const [slumpLoading, setSlumpLoading] = useState(false);

  const today = todayStr();
  const isToday = sel === today;
  const selDate = new Date(sel + "T00:00:00");
  const shift = (n: number) => {
    const d = new Date(sel + "T00:00:00");
    d.setDate(d.getDate() + n);
    setSel(dateStr(d));
  };

  const gap = daysSinceLastDone(state);
  const showSlump = isToday && gap >= 3; // 오늘 화면에서만, 3일 이상 쉰 경우

  async function careForSlump() {
    setSlumpLoading(true);
    const ctx = JSON.stringify({ 마지막완료로부터일수: gap, 누적완료: state.totalDone, 목표수: state.dreams.length });
    setSlump(await coachMessage("slumpCare", ctx, SLUMP_FALLBACK));
    setSlumpLoading(false);
  }

  const all = state.todos.filter((t) => t.date === sel);
  const done = all.filter((t) => t.done).length;

  function add() {
    const v = text.trim();
    if (!v) return;
    actions.addTodo(v, null, sel);
    setText("");
  }

  const treeCap = all.length === 0
    ? (isToday ? "오늘의 나무 · 할 일을 더하면 칸이 생겨요" : "이 날은 기록된 할 일이 없어요")
    : done >= all.length
    ? `${isToday ? "오늘 " : ""}다 했어요! 🎉 (${done}/${all.length})`
    : done === 0
    ? (isToday ? "오늘의 나무 · 하나씩 완료하면 스티커가 붙어요" : `${done}/${all.length} 완료`)
    : `${isToday ? "오늘 " : ""}${done}/${all.length} 완료`;

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
      <div className="datenav">
        <button className="dn-arrow" onClick={() => shift(-1)} aria-label="이전 날">
          <Icon name="back" size={18} />
        </button>
        <button className="dn-date" onClick={() => setSel(today)} title="오늘로">
          <span className="dn-md">{selDate.getMonth() + 1}월 {selDate.getDate()}일</span>
          <span className={"dn-wd" + (isToday ? " today" : "")}>{isToday ? "오늘" : WD[selDate.getDay()]}</span>
        </button>
        <button className="dn-arrow" onClick={() => shift(1)} disabled={isToday} aria-label="다음 날">
          <Icon name="back" size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

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
        <div className="today-tree-cap">{treeCap}</div>
      </div>

      <div className="addbox today-add">
        <div className="addbar">
          <input
            value={text}
            placeholder={isToday ? "오늘 할 일 적기" : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 할 일 적기`}
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
          {isToday ? (
            <>
              오늘 할 일이 없어요.
              <br />
              위 입력칸에 바로 적거나 ‘나의 목표’에서 할 일을 더해요.
            </>
          ) : (
            "이 날은 기록된 할 일이 없어요."
          )}
        </div>
      ) : (
        rows(all)
      )}
    </section>
  );
}
