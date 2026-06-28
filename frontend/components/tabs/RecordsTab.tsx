"use client";

import { useState } from "react";
import { AppState, Dream, boardCap, dateStr, template, todayStr, totalStickers } from "@/lib/state";
import type { AppActions } from "@/lib/store";
import { boardSVG, stampSVG } from "@/lib/trees";
import { Icon, catIconName, hasIcon } from "../Icon";

export function RecordsTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const counts: Record<string, number> = {};
  state.todos.filter((t) => t.done).forEach((t) => (counts[t.date] = (counts[t.date] ?? 0) + 1));

  const cells = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    const n = counts[ds] ?? 0;
    const lvl = n === 0 ? "" : n === 1 ? "l1" : n === 2 ? "l2" : "l3";
    cells.push(
      <div className={`cell ${lvl} ${ds === todayStr() ? "today" : ""}`} key={ds} title={`${ds} · ${n}개 완료`}>
        <span className="cell-d">{d.getDate()}</span>
      </div>,
    );
  }

  // 이룬 목표(보관) — 최근 달성 순
  const archived = state.dreams
    .filter((d) => d.done)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const activeGoals = state.dreams.filter((d) => !d.done).length;
  const stickers = totalStickers(state);

  return (
    <section>
      <div className="sec-title">
        <h2>나의 기록</h2>
      </div>
      <div className="recards">
        <div className="recard">
          <div className="ic"><Icon name="goal" size={26} color="#E7B53A" /></div>
          <div className="v">{archived.length}</div>
          <div className="l">이룬 목표</div>
        </div>
        <div className="recard">
          <div className="ic"><Icon name="sprout" size={26} color="var(--primary)" /></div>
          <div className="v">{activeGoals}</div>
          <div className="l">진행 중 목표</div>
        </div>
        <div className="recard">
          <div className="ic"><Icon name="star" size={26} color="#FF8FB0" /></div>
          <div className="v">{stickers}</div>
          <div className="l">모은 스티커</div>
        </div>
      </div>
      <div className="cal-card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>최근 2주</h3>
        <div className="grass">{cells}</div>
      </div>

      <div className="sec-title" style={{ marginTop: 22 }}>
        <h3 style={{ margin: 0, fontSize: 16, display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="best" size={18} color="#E7B53A" /> 이룬 목표 {archived.length > 0 && <span className="muted" style={{ fontWeight: 800 }}>{archived.length}</span>}
        </h3>
      </div>
      {archived.length === 0 ? (
        <div className="empty">아직 이룬 목표가 없어요. 목표의 할 일을 모두 완료하면 여기에 모여요.</div>
      ) : (
        archived.map((d) => <ArchivedCard key={d.id} dream={d} state={state} actions={actions} />)
      )}
    </section>
  );
}

/** 보관된 목표 — 읽기 전용(수정·삭제 불가). 목표·할일·다 모은 칭찬판을 그대로 보여준다. */
function ArchivedCard({ dream: d, state, actions }: { dream: Dream; state: AppState; actions: AppActions }) {
  const [open, setOpen] = useState(false);
  const color = d.color || template(d.cat).color;
  const cap = boardCap(d);
  const boardLen = d.stickers?.length ?? 0;
  const boardGold = boardLen >= cap;
  const boardHtml = boardSVG(d, d.theme || "tree", cap, color);
  const md = (s?: string) => {
    if (!s) return "";
    const p = s.split("-");
    return p.length === 3 ? `${+p[0]}.${+p[1]}.${+p[2]}` : s;
  };

  return (
    <div className="arch-card" style={{ borderColor: color + "44" }}>
      <div className="arch-h" onClick={() => setOpen((o) => !o)}>
        <span className="dream-emoji sm" style={{ background: color + "22" }}>
          {(() => {
            const v = d.icon || catIconName(d.cat) || d.emoji || "🎯";
            return hasIcon(v) ? <Icon name={v} size={18} color={color} /> : <span>{v}</span>;
          })()}
        </span>
        <div className="arch-h-txt">
          <div className="arch-title">{d.title}</div>
          <div className="muted arch-date">{d.completedAt ? `${md(d.completedAt)} 달성` : "달성"}</div>
        </div>
        <span className="arch-badge" style={{ background: color + "1f", color }}>
          {d.stamps ? `도장 ${d.stamps} · ` : ""}스티커 {d.earned ?? boardLen}
        </span>
        <Icon name="back" size={16} className="arch-caret" style={{ transform: open ? "rotate(-90deg)" : "rotate(180deg)" }} />
      </div>

      {open && (
        <div className="arch-body">
          <div className="arch-board">
            <div dangerouslySetInnerHTML={{ __html: boardHtml }} />
            {boardGold && <div className="board-stamp" dangerouslySetInnerHTML={{ __html: stampSVG(54) }} />}
          </div>
          <div className="arch-tasks">
            {d.goals.map((g) => {
              const done = state.todos.some((t) => t.goalId === g.id && t.done);
              return (
                <div className="arch-task" key={g.id}>
                  <Icon name="check" size={13} color={done ? color : "var(--line)"} />
                  <span style={done ? undefined : { color: "var(--muted)" }}>{g.title}</span>
                  <span className={"gt-badge mini" + (g.repeat === "daily" ? " daily" : "")}>{g.repeat === "daily" ? "매일" : "한 번"}</span>
                </div>
              );
            })}
            {d.goals.length === 0 && <div className="muted" style={{ fontSize: 13 }}>등록된 할 일이 없어요.</div>}
          </div>
          <button className="link arch-restore" onClick={() => confirm(`‘${d.title}’을(를) 다시 진행할까요?`) && actions.restoreDream(d.id)}>
            다시 진행하기
          </button>
        </div>
      )}
    </div>
  );
}
