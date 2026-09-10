"use client";

import { useState } from "react";
import { coachMessage } from "@/lib/api";
import type { AppActions } from "@/lib/store";
import { AppState, dateStr, daysSinceLastDone, daysUntil, findGoal, todayStr, SLUMP_FALLBACK } from "@/lib/state";
import { todayTreeSVG } from "@/lib/trees";
import { Icon } from "../Icon";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function TodayTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(todayStr()); // 보고 있는 날짜
  const [slump, setSlump] = useState("");
  const [slumpLoading, setSlumpLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // 수정 중인 할 일
  const [editText, setEditText] = useState("");

  const startEdit = (id: string, cur: string) => {
    setEditId(id);
    setEditText(cur);
  };
  const saveEdit = () => {
    if (editId) actions.editTodo(editId, editText);
    setEditId(null);
    setEditText("");
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditText("");
  };

  const today = todayStr();
  const isToday = sel === today;
  const selDate = new Date(sel + "T00:00:00");
  const ahead = daysUntil(sel); // 오늘=0, 내일=1, 모레=2, 과거는 음수
  const AHEAD_MAX = 366; // 약 1년 앞까지 미리 적기(달력으로 아무 날이나 점프)
  const isFuture = ahead > 0;
  const maxStr = (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + AHEAD_MAX);
    return dateStr(d);
  })();
  const shift = (n: number) => {
    const d = new Date(sel + "T00:00:00");
    d.setDate(d.getDate() + n);
    setSel(dateStr(d));
  };
  const wdLabel = isToday ? "오늘" : ahead === 1 ? "내일" : ahead === 2 ? "모레" : WD[selDate.getDay()];

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

  // 이 달에 3번 이상 '직접' 적은 할 일 → 추천(한 번에 다시 추가). 목표 연결 할 일은 제외.
  const monthPrefix = sel.slice(0, 7); // YYYY-MM
  const selTexts = new Set(all.map((t) => t.text.trim()));
  const freq = new Map<string, number>();
  for (const t of state.todos) {
    if (t.goalId) continue; // 자동 생성되는 목표 할 일 제외
    if (!t.date.startsWith(monthPrefix)) continue;
    const key = t.text.trim();
    if (key) freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const suggestions = [...freq.entries()]
    .filter(([txt, n]) => n >= 3 && !selTexts.has(txt)) // 이미 이 날에 있는 건 제외
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([txt]) => txt);

  function add() {
    const v = text.trim();
    if (!v) return;
    actions.addTodo(v, null, sel);
    setText("");
  }

  const treeCap = all.length === 0
    ? (isToday ? "오늘의 나무 · 할 일을 더하면 칸이 생겨요" : isFuture ? `${wdLabel} 할 일을 미리 적어둘 수 있어요` : "이 날은 기록된 할 일이 없어요")
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
          className={"task" + (t.done ? " done" : "") + (fg ? " gtask" : "")}
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
            {editId === t.id ? (
              <input
                className="task-edit"
                autoFocus
                value={editText}
                maxLength={60}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) saveEdit();
                  else if (e.key === "Escape") cancelEdit();
                }}
                onBlur={saveEdit}
              />
            ) : (
              <div className="txt" onClick={() => startEdit(t.id, t.text)} title="눌러서 수정">
                {t.text}
              </div>
            )}
          </div>
          {editId !== t.id && !t.done && !(fg && fg.goal.repeat === "daily") && (
            <button className="later" onClick={() => actions.tomorrow(t.id)}>
              내일로
            </button>
          )}
          {editId !== t.id && (
            <button className="x" aria-label="할 일 삭제" onClick={() => actions.removeTodo(t.id)}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      );
    });

  return (
    <section>
      <div className="datenav">
        <button className="dn-arrow" onClick={() => shift(-1)} aria-label="이전 날">
          <Icon name="back" size={18} />
        </button>
        <label className="dn-date" title="날짜 선택">
          <span className="dn-md">{selDate.getMonth() + 1}월 {selDate.getDate()}일</span>
          <span className={"dn-wd" + (isToday ? " today" : "") + (isFuture ? " ahead" : "")}>{wdLabel}</span>
          <Icon name="calendar" size={14} className="dn-cal" />
          <input
            type="date"
            className="dn-pick"
            value={sel}
            max={maxStr}
            onChange={(e) => e.target.value && setSel(e.target.value)}
            aria-label="날짜 선택"
          />
        </label>
        <button className="dn-arrow" onClick={() => shift(1)} disabled={ahead >= AHEAD_MAX} aria-label="다음 날">
          <Icon name="back" size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>
      {!isToday && (
        <button className="dn-reset" onClick={() => setSel(today)}>오늘로 돌아가기</button>
      )}

      {showSlump && (
        <div className="card" style={{ background: "#fff7ee", border: "1px solid #ffe0b8" }}>
          <div style={{ fontWeight: "var(--fw-medium)" }}>{gap}일 만이에요</div>
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
        {suggestions.length > 0 && (
          <div className="suggest">
            <span className="suggest-label">자주 적은 할 일</span>
            {suggestions.map((s) => (
              <button key={s} className="suggest-chip" onClick={() => actions.addTodo(s, null, sel)} title="눌러서 추가">
                + {s}
              </button>
            ))}
          </div>
        )}
        <div className="addbar">
          <input
            value={text}
            placeholder={(ahead === 1 || ahead === 2 ? wdLabel : isToday ? "오늘" : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일`) + " 할 일 적기"}
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
          ) : isFuture ? (
            <>
              아직 할 일이 없어요.
              <br />
              위 입력칸에 미리 적어두면 그날 오늘 목록에 떠요.
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
