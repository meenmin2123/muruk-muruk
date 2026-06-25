"use client";

import { AppState, dateStr, streakCount, todayStr } from "@/lib/state";
import { Icon } from "../Icon";

export function RecordsTab({ state }: { state: AppState }) {
  const streak = streakCount(state);
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

  return (
    <section>
      <div className="sec-title">
        <h2>나의 기록</h2>
      </div>
      <div className="recards">
        <div className="recard">
          <div className="ic"><Icon name="streak" size={26} color="#FF8A3D" /></div>
          <div className="v">{streak}</div>
          <div className="l">연속 일수</div>
        </div>
        <div className="recard">
          <div className="ic"><Icon name="best" size={26} color="#E7B53A" /></div>
          <div className="v">{Math.max(state.bestStreak, streak)}</div>
          <div className="l">최고 기록</div>
        </div>
        <div className="recard">
          <div className="ic"><Icon name="total" size={26} color="var(--primary)" /></div>
          <div className="v">{state.totalDone}</div>
          <div className="l">누적 완료</div>
        </div>
      </div>
      <div className="cal-card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>최근 2주</h3>
        <div className="grass">{cells}</div>
      </div>
    </section>
  );
}
