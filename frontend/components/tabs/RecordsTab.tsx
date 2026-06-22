"use client";

import { AppState, streakCount, todayStr } from "@/lib/state";

export function RecordsTab({ state }: { state: AppState }) {
  const streak = streakCount(state);
  const counts: Record<string, number> = {};
  state.todos.filter((t) => t.done).forEach((t) => (counts[t.date] = (counts[t.date] ?? 0) + 1));

  const cells = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const n = counts[ds] ?? 0;
    const lvl = n === 0 ? "" : n === 1 ? "l1" : n === 2 ? "l2" : "l3";
    cells.push(<div className={`cell ${lvl} ${ds === todayStr() ? "today" : ""}`} key={ds} />);
  }

  return (
    <section>
      <div className="sec-title">
        <h2>나의 기록</h2>
        <span className="hint">꾸준함이 쌓이는 곳</span>
      </div>
      <div className="recards">
        <div className="recard">
          <div className="ic">🔥</div>
          <div className="v">{streak}</div>
          <div className="l">연속 일수</div>
        </div>
        <div className="recard">
          <div className="ic">🏆</div>
          <div className="v">{Math.max(state.bestStreak, streak)}</div>
          <div className="l">최고 기록</div>
        </div>
        <div className="recard">
          <div className="ic">✅</div>
          <div className="v">{state.totalDone}</div>
          <div className="l">누적 완료</div>
        </div>
      </div>
      <div className="cal-card">
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>최근 2주 잔디</h3>
        <div className="muted" style={{ marginBottom: 14 }}>하루 한 칸씩, 색이 진해질수록 많이 해낸 날</div>
        <div className="grass">{cells}</div>
      </div>
      <div className="card" style={{ background: "linear-gradient(135deg,#E8F6E6,#D6F0DA)", textAlign: "center", marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--primary-d)" }}>“작심삼일도 꾸준히 하면 됩니다”</div>
        <div className="muted" style={{ marginTop: 6 }}>며칠 쉬어도 괜찮아요. 다시 시작하는 것, 그게 진짜 꾸준함이에요.</div>
      </div>
    </section>
  );
}
