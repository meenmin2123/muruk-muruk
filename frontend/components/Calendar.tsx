"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { dateStr, todayStr } from "@/lib/state";
import { Icon } from "./Icon";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

/** 디데이 선택용 커스텀 달력 팝업. 과거 날짜는 비활성, onPick은 YYYY-MM-DD. */
export function Calendar({
  value,
  color,
  onPick,
  onClose,
}: {
  value: string | null;
  color: string;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const today = todayStr();
  const init = value ? new Date(value + "T00:00:00") : new Date();
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });
  if (typeof document === "undefined") return null;

  const startDow = new Date(ym.y, ym.m, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const next = () => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  const fmt = (d: number) => dateStr(new Date(ym.y, ym.m, d));
  // 과거 달로는 못 가게
  const atCurMonth = ym.y === init.getFullYear() && ym.m === init.getMonth() && fmt(1) <= today;
  const canPrev = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}` > today.slice(0, 7);

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="calpop" onClick={(e) => e.stopPropagation()}>
        <div className="cal-head">
          <button className="cal-nav" onClick={prev} disabled={!canPrev} aria-label="이전 달">
            <Icon name="back" size={16} />
          </button>
          <div className="cal-title">{ym.y}년 {ym.m + 1}월</div>
          <button className="cal-nav" onClick={next} aria-label="다음 달">
            <Icon name="back" size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button className="ipick-x" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="cal-grid cal-wd">
          {WD.map((w, i) => (
            <div key={w} className={"cal-wd-c" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{w}</div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const ds = fmt(d);
            const isToday = ds === today;
            const isSel = ds === value;
            const isPast = ds < today;
            return (
              <button
                key={i}
                className={"cal-day" + (isSel ? " sel" : "") + (isToday ? " today" : "")}
                disabled={isPast}
                style={isSel ? { background: color, borderColor: color } : isToday ? { color } : undefined}
                onClick={() => onPick(ds)}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="cal-foot">
          <button className="link" onClick={() => onPick(today)}>오늘로</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
