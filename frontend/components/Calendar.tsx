"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { dateStr, todayStr } from "@/lib/state";
import { Icon } from "./Icon";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 커스텀 달력 팝업. onPick 은 YYYY-MM-DD.
 *
 * 선택 가능 범위를 min/max 로 받는다. 쓰는 곳마다 방향이 반대라서다 —
 * 디데이는 과거를 막아야 하고(min=오늘), 오늘 탭은 과거를 보는 게 주 용도이고
 * 미래가 제한된다(max=오늘+N). 둘 다 생략하면 제한 없음.
 */
export function Calendar({
  value,
  color,
  onPick,
  onClose,
  min,
  max,
}: {
  value: string | null;
  color: string;
  onPick: (date: string) => void;
  onClose: () => void;
  /** 이 날짜보다 이전은 선택 불가 (YYYY-MM-DD) */
  min?: string;
  /** 이 날짜보다 이후는 선택 불가 (YYYY-MM-DD) */
  max?: string;
}) {
  const today = todayStr();
  const inRange = (ds: string) => (!min || ds >= min) && (!max || ds <= max);
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
  // 이동할 달에 고를 수 있는 날이 하나도 없으면 화살표를 막는다.
  // (예전엔 '오늘 이전 달'을 무조건 막아, 과거를 보는 화면에서는 쓸 수 없었다.)
  const monthHasPickable = (y: number, m: number) => {
    const first = dateStr(new Date(y, m, 1));
    const last = dateStr(new Date(y, m + 1, 0));
    return (!max || first <= max) && (!min || last >= min);
  };
  const canPrev = monthHasPickable(ym.m === 0 ? ym.y - 1 : ym.y, ym.m === 0 ? 11 : ym.m - 1);
  const canNext = monthHasPickable(ym.m === 11 ? ym.y + 1 : ym.y, ym.m === 11 ? 0 : ym.m + 1);

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="calpop" onClick={(e) => e.stopPropagation()}>
        <div className="cal-head">
          <button className="cal-nav" onClick={prev} disabled={!canPrev} aria-label="이전 달">
            <Icon name="back" size={16} />
          </button>
          <div className="cal-title">{ym.y}년 {ym.m + 1}월</div>
          <button className="cal-nav" onClick={next} disabled={!canNext} aria-label="다음 달">
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
            const off = !inRange(ds);
            return (
              <button
                key={i}
                className={"cal-day" + (isSel ? " sel" : "") + (isToday ? " today" : "")}
                disabled={off}
                style={isSel ? { background: color, borderColor: color } : isToday ? { color } : undefined}
                onClick={() => onPick(ds)}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="cal-foot">
          <button className="link" onClick={() => onPick(today)} disabled={!inRange(today)}>오늘로</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
