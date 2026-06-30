"use client";

// 홈 화면 위젯(iOS WidgetKit)으로 보낼 "오늘 스냅샷"을 만들고, 네이티브 공유 저장소
// (App Group)에 기록한다. 웹/브라우저에서는 아무 일도 하지 않는다(Capacitor 네이티브에서만 동작).
//
// 데이터 흐름:  앱 상태 변경 → buildSnapshot() → WidgetBridge.save(JSON)
//   → (네이티브) App Group UserDefaults 에 저장 + WidgetCenter 새로고침 → 위젯이 다시 그림.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { AppState, boardCap, findGoal, totalStickers, todayStr } from "./state";

interface WidgetBridgePlugin {
  /** data = JSON.stringify(WidgetSnapshot) */
  save(options: { data: string }): Promise<void>;
}

// 네이티브에 같은 이름("WidgetBridge")으로 등록된 플러그인과 연결.
// 웹에서는 호출 시 reject 되므로 pushWidgetSnapshot 에서 무시한다.
const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

export interface WidgetTask {
  text: string;
  done: boolean;
  /** 목표에 연결된 할 일이면 목표 색, 아니면 null(오늘의 일반 할 일). */
  color: string | null;
}

export interface WidgetBoard {
  title: string;
  color: string;
  /** 현재 칭찬판에 붙은 스티커 수(0~cap). */
  stickers: number;
  /** 완성한 도장 수. */
  stamps: number;
  /** 칭찬판 칸 수. */
  cap: number;
}

export interface WidgetSnapshot {
  date: string; // YYYY-MM-DD (스냅샷 기준일)
  doneCount: number;
  totalCount: number;
  tasks: WidgetTask[];
  totalStickers: number;
  totalStamps: number;
  boards: WidgetBoard[];
  updatedAt: string; // ISO
}

/** 현재 앱 상태에서 '오늘' 기준 위젯 스냅샷을 만든다. */
export function buildSnapshot(s: AppState): WidgetSnapshot {
  const today = todayStr();
  const todays = s.todos.filter((t) => t.date === today);
  const tasks: WidgetTask[] = todays.map((t) => {
    const fg = t.goalId ? findGoal(s, t.goalId) : null;
    return { text: t.text, done: t.done, color: fg?.dream.color ?? null };
  });
  const doneCount = tasks.filter((t) => t.done).length;

  let totalStamps = 0;
  const boards: WidgetBoard[] = [];
  for (const d of s.dreams) {
    if (d.done) continue; // 보관된 목표는 위젯에 안 띄움
    totalStamps += d.stamps ?? 0;
    if (d.goals.length > 0) {
      boards.push({
        title: d.title,
        color: d.color,
        stickers: d.stickers?.length ?? 0,
        stamps: d.stamps ?? 0,
        cap: boardCap(d),
      });
    }
  }

  return {
    date: today,
    doneCount,
    totalCount: tasks.length,
    tasks,
    totalStickers: totalStickers(s),
    totalStamps,
    boards: boards.slice(0, 8),
    updatedAt: new Date().toISOString(),
  };
}

/** 네이티브(iOS/Android 앱)일 때만 위젯 저장소에 스냅샷을 기록한다. */
export async function pushWidgetSnapshot(s: AppState): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.save({ data: JSON.stringify(buildSnapshot(s)) });
  } catch {
    // 위젯 브릿지가 없는 환경(예: 안드로이드 위젯 미구현)에서는 조용히 무시.
  }
}
