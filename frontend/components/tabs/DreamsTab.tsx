"use client";

import { useState } from "react";
import type { AppActions } from "@/lib/store";
import { AppState, CAT_ORDER, Dream, PALETTE, Repeat, TEMPLATES, THEMES, ddayText, template, todayStr } from "@/lib/state";

export function DreamsTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("free");
  const [color, setColor] = useState(TEMPLATES.free.color);
  const [theme, setTheme] = useState("tree");
  const [title, setTitle] = useState("");

  function pickCat(c: string) {
    setCat(c);
    setColor(template(c).color);
  }
  function create() {
    const v = title.trim();
    if (!v) return;
    actions.addDream({ title: v, cat, color, theme });
    setTitle("");
    setOpen(false);
  }

  return (
    <section>
      <div className="sec-title">
        <h2>나의 목표</h2>
        <span className="hint">목표 → 할 일 → 오늘</span>
      </div>

      <button className="newdream-btn" onClick={() => setOpen((o) => !o)}>
        {open ? "✕ 닫기" : "＋ 새 목표 만들기"}
      </button>

      {open && (
        <div className="card">
          <div className="row-wrap">
            {CAT_ORDER.map((c) => (
              <div key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => pickCat(c)}>
                {TEMPLATES[c].emoji} {TEMPLATES[c].label}
              </div>
            ))}
          </div>
          <div className="row-wrap" style={{ alignItems: "center" }}>
            <span className="muted" style={{ fontWeight: 800 }}>색</span>
            {PALETTE.map((c) => (
              <div key={c} className={"sw" + (c.toLowerCase() === color.toLowerCase() ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="muted" style={{ margin: "2px 2px 8px", fontWeight: 700 }}>칭찬판 모양 (만든 뒤 바꿀 수 없어요)</div>
          <div className="row-wrap">
            {THEMES.map((t) => (
              <button key={t.key} className={"theme-opt" + (t.key === theme ? " on" : "")} onClick={() => setTheme(t.key)}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <div className="addbar">
            <input value={title} placeholder={template(cat).ph} maxLength={40} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && create()} />
            <button onClick={create}>추가</button>
          </div>
        </div>
      )}

      {state.dreams.length === 0 ? (
        <div className="empty">이루고 싶은 목표를 하나 세워볼까요?<br />거창하지 않아도 좋아요.</div>
      ) : (
        state.dreams.map((d) => <DreamCard key={d.id} dream={d} state={state} actions={actions} />)
      )}
    </section>
  );
}

function DreamCard({ dream: d, state, actions }: { dream: Dream; state: AppState; actions: AppActions }) {
  const [goalText, setGoalText] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("once");
  const color = d.color || template(d.cat).color;
  const tpl = template(d.cat);
  const linked = state.todos.filter((t) => t.goalId && d.goals.some((g) => g.id === t.goalId));
  const doneN = linked.filter((t) => t.done).length;
  const pct = linked.length ? Math.round((doneN / linked.length) * 100) : 0;
  const dd = ddayText(d.targetDate);
  const used = d.goals.map((g) => g.title);
  const sugg = (tpl.goals || []).filter((s) => !used.includes(s));

  function addGoal(t: string) {
    const v = t.trim();
    if (!v) return;
    actions.addGoal(d.id, v, repeat);
    setGoalText("");
  }

  return (
    <div className="dream">
      <div className="dream-h">
        <span className="dream-emoji" style={{ background: color + "22" }} onClick={() => actions.toggleCollapse(d.id)}>
          {d.emoji}
        </span>
        <span className="t" onClick={() => actions.toggleCollapse(d.id)}>
          {d.title}
        </span>
        {tpl.dday &&
          (dd && d.targetDate ? (
            <span className="muted" style={{ fontWeight: 800, color }}>
              {tpl.ddayLabel} {dd}
            </span>
          ) : (
            <input type="date" value={d.targetDate ?? ""} onChange={(e) => actions.setDday(d.id, e.target.value)} style={{ border: "1.5px dashed var(--line)", borderRadius: 9, padding: "4px 8px", fontSize: 11.5 }} />
          ))}
        <button className="x" onClick={() => confirm("이 목표와 할 일을 삭제할까요?") && actions.removeDream(d.id)}>
          ✕
        </button>
      </div>

      {!d.collapsed && (
        <>
          <div className="progress">
            <i style={{ width: pct + "%", background: `linear-gradient(90deg, ${color}88, ${color})` }} />
          </div>
          <div className="progress-l">{linked.length ? `${doneN}/${linked.length} 실천 · ${pct}%` : "추천 할 일을 눌러 시작해보세요"}</div>

          {d.goals.map((g) => {
            const added = state.todos.some((t) => t.goalId === g.id && t.date === todayStr());
            const isDone = g.repeat === "once" && state.todos.some((t) => t.goalId === g.id && t.done);
            return (
              <div className={"goal" + (isDone ? " done" : "")} key={g.id}>
                <span className="g-t">· {g.title}</span>
                <button className={"gt-badge" + (g.repeat === "daily" ? " daily" : "")} onClick={() => actions.toggleGoalRepeat(d.id, g.id)}>
                  {g.repeat === "daily" ? "🔁 매일" : "한 번"}
                </button>
                {g.repeat !== "daily" && (
                  <button className={"add-today" + (added ? " added" : "")} style={!added ? { background: color } : undefined} onClick={() => actions.goalToToday(g.id)}>
                    {added ? "추가됨 ✓" : "+ 오늘"}
                  </button>
                )}
                <button className="x" onClick={() => actions.removeGoal(d.id, g.id)}>
                  ✕
                </button>
              </div>
            );
          })}

          {sugg.length > 0 && (
            <div style={{ marginTop: 11 }}>
              <div className="muted" style={{ fontWeight: 700, marginBottom: 7 }}>💡 {tpl.label} 추천 — 눌러서 추가</div>
              <div className="row-wrap">
                {sugg.map((s) => (
                  <span key={s} className="chip" onClick={() => addGoal(s)}>
                    + {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="goal-add">
            <input value={goalText} placeholder="직접 할 일 추가" maxLength={40} onChange={(e) => setGoalText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addGoal(goalText)} />
            <button onClick={() => addGoal(goalText)}>추가</button>
          </div>
          <div className="row-wrap" style={{ marginTop: 8 }}>
            <button className={"theme-opt" + (repeat === "once" ? " on" : "")} style={{ flex: "0 0 auto" }} onClick={() => setRepeat("once")}>
              📌 한 번
            </button>
            <button className={"theme-opt" + (repeat === "daily" ? " on" : "")} style={{ flex: "0 0 auto" }} onClick={() => setRepeat("daily")}>
              🔁 매일 반복
            </button>
          </div>
        </>
      )}
    </div>
  );
}
