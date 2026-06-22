"use client";

import { useState } from "react";
import type { AppActions } from "@/lib/store";
import { AppState, findGoal, todayStr } from "@/lib/state";

export function TodayTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState("");

  const all = state.todos.filter((t) => t.date === todayStr());
  const done = all.filter((t) => t.done).length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const C = 188.5;

  const hasGoals = state.dreams.some((d) => d.goals.length);
  const visible = all.slice(0, 3);
  const overflow = all.slice(3);

  function add() {
    const v = text.trim();
    if (!v) return;
    if (!goalId) return;
    actions.addTodo(v, goalId);
    setText("");
  }

  const rows = (list: typeof all) =>
    list.map((t) => {
      const fg = t.goalId ? findGoal(state, t.goalId) : null;
      return (
        <div className={"task" + (t.done ? " done" : "")} key={t.id}>
          <div className={"check" + (t.done ? " done" : "")} onClick={() => actions.toggleTodo(t.id)}>
            {t.done ? "✓" : ""}
          </div>
          <div className="body">
            <div className="txt">{t.text}</div>
            {fg && (
              <div className="meta">
                {fg.goal.title} · {fg.dream.title}
                {fg.goal.repeat === "daily" && <span className="meta-tag">매일</span>}
              </div>
            )}
          </div>
          {!t.done && (
            <button className="later" onClick={() => actions.tomorrow(t.id)}>
              내일로
            </button>
          )}
          <button className="x" onClick={() => actions.removeTodo(t.id)}>
            ✕
          </button>
        </div>
      );
    });

  return (
    <section>
      <div className="greet">
        오늘도 한 걸음 어때요? ☀️<small>오늘은 딱 3개까지만. 무리하지 않는 게 꾸준함의 비결이에요.</small>
      </div>

      <div className="ringwrap">
        <div className="ring">
          <svg width="72" height="72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#D6F0DA" strokeWidth="8" />
            <circle cx="36" cy="36" r="30" fill="none" stroke="#46B97C" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} style={{ transition: "stroke-dashoffset .5s" }} />
          </svg>
          <div className="pct">{pct}%</div>
        </div>
        <div className="ringtxt">
          {all.length === 0 ? (
            <>
              <div className="t">오늘의 할 일</div>
              <div className="s">작은 것 하나면 충분해요</div>
            </>
          ) : done === all.length ? (
            <>
              <div className="t">오늘 다 해냈어요! 🎉</div>
              <div className="s">대단해요, 푹 쉬어요</div>
            </>
          ) : (
            <>
              <div className="t">
                {done} / {all.length} 완료
              </div>
              <div className="s">{all.length - done}개 남았어요, 천천히</div>
            </>
          )}
        </div>
      </div>

      <div className="addbar">
        <input
          value={text}
          placeholder="오늘 할 일 하나 적기…"
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
          }}
        />
        <button onClick={add}>추가</button>
      </div>

      <select className="goalpick" value={goalId} onChange={(e) => setGoalId(e.target.value)} disabled={!hasGoals}>
        {!hasGoals ? (
          <option value="">먼저 ‘나의 목표’에서 할 일을 만들어주세요</option>
        ) : (
          <>
            <option value="">연결할 할 일을 골라요</option>
            {state.dreams
              .filter((d) => d.goals.length)
              .map((d) => (
                <optgroup key={d.id} label={`${d.emoji} ${d.title}`}>
                  {d.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </optgroup>
              ))}
          </>
        )}
      </select>

      {all.length === 0 ? (
        <div className="empty">아직 오늘 할 일이 없어요.<br />딱 하나만 적어볼까요? 그거면 충분해요.</div>
      ) : (
        <>
          {rows(visible)}
          {overflow.length > 0 && (
            <div className="muted" style={{ textAlign: "center", margin: "4px 0 14px" }}>
              오늘은 위 3가지에 집중해요. 나머지 {overflow.length}개는 잠시 접어둘게요 🤍
            </div>
          )}
          {rows(overflow)}
        </>
      )}
    </section>
  );
}
