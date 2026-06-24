"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AppActions } from "@/lib/store";
import { AppState, CAT_ORDER, Dream, PALETTE, Repeat, TEMPLATES, THEMES, boardCap, ddayText, template, todayStr } from "@/lib/state";

interface CatMeta {
  key: string;
  emoji: string;
  label: string;
  ph: string;
  color: string;
}

export function DreamsTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("free");
  const [color, setColor] = useState(TEMPLATES.free.color);
  const [theme, setTheme] = useState("tree");
  const [title, setTitle] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [ce, setCe] = useState("🎨");
  const [cl, setCl] = useState("");

  const presets: CatMeta[] = CAT_ORDER.map((c) => ({ key: c, emoji: TEMPLATES[c].emoji, label: TEMPLATES[c].label, ph: TEMPLATES[c].ph, color: TEMPLATES[c].color }));
  const customs: CatMeta[] = state.customCats.map((c) => ({ key: c.key, emoji: c.emoji, label: c.label, ph: c.ph, color: c.color }));
  const allCats = [...presets, ...customs];
  const meta = allCats.find((c) => c.key === cat) ?? presets[presets.length - 1];

  function pickCat(c: CatMeta) {
    setCat(c.key);
    setColor(c.color);
  }
  function create() {
    const v = title.trim();
    if (!v) return;
    actions.addDream({ title: v, cat, color, theme, emoji: meta.emoji });
    setTitle("");
    setOpen(false);
  }
  function addCustom() {
    const label = cl.trim();
    if (!label) return;
    actions.addCustomCat({ emoji: ce.trim() || "🎯", label, color });
    setCl("");
    setCe("🎨");
    setCatOpen(false);
  }

  return (
    <section>
      <div className="sec-title">
        <h2>나의 목표</h2>
      </div>
      <p className="muted" style={{ margin: "-4px 2px 12px", fontSize: 12.5, lineHeight: 1.5 }}>
        큰 목표와 할 일을 <b>계획</b>하는 곳이에요. 오늘 할 건 <b>+오늘</b>으로 담고, 완료 체크는 <b>오늘 할 일</b> 탭에서 해요.
      </p>

      <button className="newdream-btn" onClick={() => setOpen((o) => !o)}>
        {open ? "닫기" : "＋ 새 목표"}
      </button>

      {open && (
        <div className="card">
          <div className="row-wrap">
            {allCats.map((c) => (
              <div key={c.key} className={"chip" + (c.key === cat ? " on" : "")} onClick={() => pickCat(c)}>
                {c.emoji} {c.label}
              </div>
            ))}
            <div className="chip" onClick={() => setCatOpen((o) => !o)}>
              ＋ 직접
            </div>
          </div>

          {catOpen && (
            <div className="card" style={{ background: "#f6fbf4" }}>
              <div className="muted" style={{ fontWeight: 800, marginBottom: 8 }}>나만의 카테고리</div>
              <div className="addbar">
                <input style={{ flex: "0 0 64px", textAlign: "center" }} value={ce} maxLength={2} onChange={(e) => setCe(e.target.value)} />
                <input value={cl} placeholder="카테고리 이름 (예: 독서)" maxLength={10} onChange={(e) => setCl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addCustom()} />
                <button onClick={addCustom}>추가</button>
              </div>
            </div>
          )}

          <div className="row-wrap" style={{ alignItems: "center" }}>
            <span className="muted" style={{ fontWeight: 800 }}>색</span>
            {PALETTE.map((c) => (
              <div key={c} className={"sw" + (c.toLowerCase() === color.toLowerCase() ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="muted" style={{ margin: "2px 2px 8px", fontWeight: 700 }}>칭찬판 모양</div>
          <div className="row-wrap">
            {THEMES.map((t) => (
              <button key={t.key} className={"theme-opt" + (t.key === theme ? " on" : "")} onClick={() => setTheme(t.key)}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <div className="addbar">
            <input value={title} placeholder={meta.ph} maxLength={40} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && create()} />
            <button onClick={create}>추가</button>
          </div>
        </div>
      )}

      {state.dreams.length === 0 ? (
        <div className="empty">목표를 하나 세워보세요.</div>
      ) : (
        state.dreams.map((d) => <DreamCard key={d.id} dream={d} state={state} actions={actions} />)
      )}
    </section>
  );
}

function DreamCard({ dream: d, state, actions }: { dream: Dream; state: AppState; actions: AppActions }) {
  const [goalText, setGoalText] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [aiTasks, setAiTasks] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(d.title);
  const [editGoalId, setEditGoalId] = useState("");
  const [goalVal, setGoalVal] = useState("");
  const [editCap, setEditCap] = useState(false);
  const [ddayOpen, setDdayOpen] = useState(false);
  const color = d.color || template(d.cat).color;
  const tpl = template(d.cat);
  const linked = state.todos.filter((t) => t.goalId && d.goals.some((g) => g.id === t.goalId));
  const doneN = linked.filter((t) => t.done).length;
  const pct = linked.length ? Math.round((doneN / linked.length) * 100) : 0;
  const dd = ddayText(d.targetDate);
  const used = d.goals.map((g) => g.title);
  const sugg = (tpl.goals || []).filter((s) => !used.includes(s));

  // 직접 입력은 선택한 종류(repeat)를 따르고, 추천/AI 칩은 대부분 한 번짜리라 'once' 기본.
  function addGoal(t: string, rep: Repeat = repeat) {
    const v = t.trim();
    if (!v) return;
    actions.addGoal(d.id, v, rep);
    setGoalText("");
  }

  async function aiSuggest() {
    setAiLoading(true);
    setAiTasks([]);
    try {
      const ctx = JSON.stringify({ 목표: d.title, 카테고리: tpl.label, 이미있는할일: used });
      const { message } = await api.coach("suggestTasks", ctx);
      const lines = message
        .split("\n")
        .map((l) => l.replace(/^[\s\d.\-*•")(]+/, "").trim())
        .filter((l) => l.length > 0 && l.length <= 30 && !used.includes(l))
        .slice(0, 5);
      setAiTasks(lines);
    } catch {
      setAiTasks([]);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="dream">
      <div className="dream-h">
        <span className="dream-emoji" style={{ background: color + "22" }} onClick={() => actions.toggleCollapse(d.id)}>
          {d.emoji}
        </span>
        {editTitle ? (
          <input
            className="rename-input t"
            value={titleVal}
            autoFocus
            maxLength={40}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={() => { actions.renameDream(d.id, titleVal); setEditTitle(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { actions.renameDream(d.id, titleVal); setEditTitle(false); }
              if (e.key === "Escape") { setTitleVal(d.title); setEditTitle(false); }
            }}
          />
        ) : (
          <>
            <span className="t" onClick={() => actions.toggleCollapse(d.id)}>
              {d.title}
            </span>
            <button className="icon-btn" aria-label="목표 이름 수정" onClick={() => { setTitleVal(d.title); setEditTitle(true); }}>
              ✎
            </button>
          </>
        )}
        {!editTitle && d.targetDate && (
          <span className="muted" style={{ fontWeight: 800, color }}>
            {(tpl.ddayLabel || "디데이") + " "}{dd}
          </span>
        )}
        {!editTitle && (
          <button className="x" aria-label="목표 삭제" onClick={() => confirm("이 목표와 할 일을 삭제할까요?") && actions.removeDream(d.id)}>
            ✕
          </button>
        )}
      </div>

      {!d.collapsed && (
        <>
          <div className="progress">
            <i style={{ width: pct + "%", background: `linear-gradient(90deg, ${color}88, ${color})` }} />
          </div>
          <div className="progress-l">{linked.length ? `${doneN}/${linked.length} · ${pct}%` : ""}</div>

          <div className="board-cap">
            <span>🌳 칭찬판</span>
            {d.targetDate ? (
              <>
                <b style={{ color }}>{boardCap(d)}칸 · 디데이까지</b>
                <button className="link" onClick={() => { actions.setDday(d.id, ""); setDdayOpen(false); }}>디데이 해제</button>
              </>
            ) : editCap ? (
              <>
                <input type="number" min={1} max={100} autoFocus value={boardCap(d)} onChange={(e) => actions.setBoardSize(d.id, Number(e.target.value))} onBlur={() => setEditCap(false)} />
                <span>칸</span>
              </>
            ) : ddayOpen ? (
              <input type="date" autoFocus value="" onChange={(e) => { actions.setDday(d.id, e.target.value); setDdayOpen(false); }} />
            ) : (
              <>
                <button className="link" onClick={() => setEditCap(true)}>{boardCap(d)}칸 ✎</button>
                <button className="link" onClick={() => setDdayOpen(true)}>＋디데이로 자동</button>
              </>
            )}
          </div>

          {d.goals.map((g) => {
            const added = state.todos.some((t) => t.goalId === g.id && t.date === todayStr());
            const isDone = g.repeat === "once" && state.todos.some((t) => t.goalId === g.id && t.done);
            return (
              <div className={"goal" + (isDone ? " done" : "")} key={g.id}>
                {editGoalId === g.id ? (
                  <input
                    className="rename-input g-t"
                    value={goalVal}
                    autoFocus
                    maxLength={40}
                    onChange={(e) => setGoalVal(e.target.value)}
                    onBlur={() => { actions.renameGoal(d.id, g.id, goalVal); setEditGoalId(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) { actions.renameGoal(d.id, g.id, goalVal); setEditGoalId(""); }
                      if (e.key === "Escape") setEditGoalId("");
                    }}
                  />
                ) : (
                  <span className="g-t">· {g.title}</span>
                )}
                {editGoalId !== g.id && (
                  <>
                    <button className="icon-btn" aria-label="할 일 이름 수정" onClick={() => { setEditGoalId(g.id); setGoalVal(g.title); }}>
                      ✎
                    </button>
                    <button className={"gt-badge" + (g.repeat === "daily" ? " daily" : "")} onClick={() => actions.toggleGoalRepeat(d.id, g.id)} title="눌러서 '한 번 ↔ 매일' 전환">
                      {g.repeat === "daily" ? "🔁 매일" : "✓ 한 번"}
                    </button>
                    {g.repeat === "daily" ? (
                      <span className="add-today added" style={{ cursor: "default" }}>오늘에 있음</span>
                    ) : (
                      <button className={"add-today" + (added ? " added" : "")} style={!added ? { background: color } : undefined} onClick={() => actions.goalToToday(g.id)}>
                        {added ? "오늘에 있음" : "+ 오늘"}
                      </button>
                    )}
                    <button className="x" aria-label="할 일 삭제" onClick={() => actions.removeGoal(d.id, g.id)}>
                      ✕
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {sugg.length > 0 && (
            <div style={{ marginTop: 11 }}>
              <div className="muted" style={{ fontWeight: 700, marginBottom: 7 }}>추천</div>
              <div className="row-wrap">
                {sugg.map((s) => (
                  <span key={s} className="chip" onClick={() => addGoal(s, "once")}>
                    + {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiTasks.length > 0 && (
            <div style={{ marginTop: 11 }}>
              <div className="muted" style={{ fontWeight: 700, marginBottom: 7 }}>AI 추천</div>
              <div className="row-wrap">
                {aiTasks.map((s) => (
                  <span key={s} className="chip" onClick={() => { addGoal(s, "once"); setAiTasks((p) => p.filter((x) => x !== s)); }}>
                    + {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="muted" style={{ fontWeight: 700, margin: "14px 2px 6px" }}>할 일 추가 — 어떤 종류인가요?</div>
          <div className="repeat-pick">
            <button className={"rep-opt" + (repeat === "once" ? " on" : "")} onClick={() => setRepeat("once")}>
              <b>✓ 한 번만</b>
              <small>하면 끝나는 일 (예약·신청 등)</small>
            </button>
            <button className={"rep-opt" + (repeat === "daily" ? " on" : "")} onClick={() => setRepeat("daily")}>
              <b>🔁 매일</b>
              <small>매일 반복하는 습관 (운동·공부 등)</small>
            </button>
          </div>
          <div className="goal-add" style={{ marginTop: 8 }}>
            <input value={goalText} placeholder={repeat === "daily" ? "매일 할 습관 적기" : "한 번 할 일 적기"} maxLength={40} onChange={(e) => setGoalText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addGoal(goalText)} />
            <button onClick={() => addGoal(goalText)}>추가</button>
          </div>
          <button className="ai-btn" onClick={aiSuggest} disabled={aiLoading}>
            {aiLoading ? "AI가 생각 중…" : "✨ AI로 할 일 추천받기"}
          </button>
        </>
      )}
    </div>
  );
}
