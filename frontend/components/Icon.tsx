"use client";

import type { CSSProperties } from "react";

/**
 * 무럭무럭 아이콘 세트.
 * - filled:true → 통통(채움) 스타일 (네비/카테고리/통계)
 * - filled:false → 라인 스타일 (조작 버튼)
 * render(c)는 24x24 viewBox 기준 내부 SVG 문자열. c는 아이콘 색.
 */
const ICONS: Record<string, { filled?: boolean; render: (c: string) => string }> = {
  // ── 네비 (통통) ──
  goal: { filled: true, render: (c) => `<circle cx="12" cy="12" r="9.5" fill="${c}"/><circle cx="12" cy="12" r="6" fill="#fff"/><circle cx="12" cy="12" r="2.9" fill="${c}"/>` },
  today: { filled: true, render: (c) => `<circle cx="12" cy="12" r="4.8" fill="${c}"/><g stroke="${c}" stroke-width="3" stroke-linecap="round"><line x1="12" y1="2.6" x2="12" y2="4.7"/><line x1="12" y1="19.3" x2="12" y2="21.4"/><line x1="2.6" y1="12" x2="4.7" y2="12"/><line x1="19.3" y1="12" x2="21.4" y2="12"/><line x1="5.6" y1="5.6" x2="7" y2="7"/><line x1="17" y1="17" x2="18.4" y2="18.4"/><line x1="5.6" y1="18.4" x2="7" y2="17"/><line x1="17" y1="7" x2="18.4" y2="5.6"/></g>` },
  records: { filled: true, render: (c) => `<rect x="3.8" y="13" width="4.3" height="7" rx="1.7" fill="${c}"/><rect x="9.85" y="9" width="4.3" height="11" rx="1.7" fill="${c}"/><rect x="15.9" y="5" width="4.3" height="15" rx="1.7" fill="${c}"/>` },

  // ── 통계 (통통) ──
  streak: { filled: true, render: (c) => `<path d="M12.5 2.5 C 13 7, 17 8.5, 16 13.5 C 15.3 17.2, 13.2 19.6, 12 19.6 C 9.8 19.6, 7.5 17.6, 7.8 13.8 C 8 11, 10 10.2, 10 7.4 C 11 8.6, 11.8 5.5, 12.5 2.5 Z" fill="${c}"/><path d="M12.2 10.5 C 12.5 12.7, 13.8 13.3, 13.3 15.5 C 12.95 17, 12.55 17.6, 12 17.6 C 11.1 17.6, 10.2 16.7, 10.4 15 C 10.55 13.8, 11.6 13.2, 12.2 10.5 Z" fill="#fff"/>` },
  best: { filled: true, render: (c) => `<path d="M7.4 4 H16.6 V8.4 A4.6 4.6 0 0 1 7.4 8.4 Z" fill="${c}"/><path d="M7.6 5 H5 A2 2 0 0 0 7.8 9.4" fill="none" stroke="${c}" stroke-width="2"/><path d="M16.4 5 H19 A2 2 0 0 1 16.2 9.4" fill="none" stroke="${c}" stroke-width="2"/><rect x="10.7" y="12" width="2.6" height="4.2" fill="${c}"/><rect x="7.8" y="19.4" width="8.4" height="2.4" rx="1.2" fill="${c}"/><rect x="9.4" y="16" width="5.2" height="2.2" rx="1.1" fill="${c}"/>` },
  total: { filled: true, render: (c) => `<circle cx="12" cy="12" r="9" fill="${c}"/><polyline points="8,12.3 11,15.3 16.2,9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` },

  // ── 카테고리 (통통, 목표 색) ──
  cat_travel: { filled: true, render: (c) => `<path d="M3 12.5 L21 4 L13.8 20.5 L11 13.3 Z" fill="${c}"/><path d="M11 13.3 L21 4" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>` },
  cat_study: { filled: true, render: (c) => `<path d="M3.6 5.5 C 7 4, 10.5 4, 12 6 C 13.5 4, 17 4, 20.4 5.5 L20.4 18 C 17 16.5, 13.5 16.5, 12 18.4 C 10.5 16.5, 7 16.5, 3.6 18 Z" fill="${c}"/><path d="M12 6 V18.4" stroke="#fff" stroke-width="1.4"/>` },
  cat_cert: { filled: true, render: (c) => `<circle cx="12" cy="9.5" r="5.3" fill="${c}"/><circle cx="12" cy="9.5" r="2.2" fill="#fff"/><path d="M9.2 13.6 L7.4 21 L12 18.3 L16.6 21 L14.8 13.6 Z" fill="${c}"/>` },
  cat_job: { filled: true, render: (c) => `<rect x="3.5" y="7.6" width="17" height="12" rx="2.4" fill="${c}"/><path d="M8.8 7.6 V6 a1.6 1.6 0 0 1 1.6-1.6 h3.2 a1.6 1.6 0 0 1 1.6 1.6 V7.6" fill="none" stroke="${c}" stroke-width="2"/><rect x="9.3" y="11.6" width="5.4" height="2.6" rx="1.3" fill="#fff"/>` },
  cat_career: { filled: true, render: (c) => `<g stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9 H16.5"/><path d="M14 6.2 L17 9 L14 11.8"/><path d="M19 15 H7.5"/><path d="M10 12.2 L7 15 L10 17.8"/></g>` },
  cat_health: { filled: true, render: (c) => `<path d="M12 20.6 C 2.5 14, 4 6.8, 8.6 6.3 C 11 6.05, 12 8.7, 12 8.7 C 12 8.7, 13 6.05, 15.4 6.3 C 20 6.8, 21.5 14, 12 20.6 Z" fill="${c}"/>` },
  cat_happy: { filled: true, render: (c) => `<g fill="${c}"><circle cx="12" cy="7.6" r="3"/><circle cx="8.4" cy="10.6" r="3"/><circle cx="15.6" cy="10.6" r="3"/><circle cx="9.9" cy="14.2" r="3"/><circle cx="14.1" cy="14.2" r="3"/></g><circle cx="12" cy="11.2" r="2.5" fill="#fff"/><path d="M12 14 V20.5" stroke="${c}" stroke-width="2" stroke-linecap="round" fill="none"/>` },
  cat_free: { filled: true, render: (c) => `<path d="M6 3.5 V20.5" stroke="${c}" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M6 4.6 H18 L15 8.2 L18 11.8 H6 Z" fill="${c}"/>` },
  sprout: { filled: true, render: (c) => `<path d="M12 21 V11" stroke="${c}" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M12 13.2 C 7.8 13.2, 5.8 10, 6.4 7.3 C 10.2 7.6, 12 10.5, 12 13.2 Z" fill="${c}"/><path d="M12 11 C 15.6 11, 17.4 8.6, 16.9 6.1 C 13.6 6.4, 12 8.8, 12 11 Z" fill="${c}"/>` },

  // ── 조작 (라인) ──
  settings: {
    filled: true,
    render: (c) => {
      let t = "";
      for (let i = 0; i < 8; i++) t += `<rect x="10.7" y="1.6" width="2.6" height="4.1" rx="1" transform="rotate(${i * 45} 12 12)" fill="${c}"/>`;
      return t + `<circle cx="12" cy="12" r="6.3" fill="${c}"/><circle cx="12" cy="12" r="2.7" fill="#fff"/>`;
    },
  },
  add: { render: () => `<line x1="12" y1="5.5" x2="12" y2="18.5"/><line x1="5.5" y1="12" x2="18.5" y2="12"/>` },
  edit: { render: () => `<path d="M4.5 19.5 L4.5 15.7 L14.8 5.4 L18.6 9.2 L8.3 19.5 Z"/><line x1="13" y1="7.2" x2="16.8" y2="11"/>` },
  close: { render: () => `<line x1="6.5" y1="6.5" x2="17.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="6.5" y2="17.5"/>` },
  check: { render: () => `<polyline points="5,12.5 10,17.5 19,7" fill="none"/>` },
  once: { render: () => `<circle cx="12" cy="12" r="8.5"/><polyline points="8,12.3 11,15.3 16.2,9" fill="none"/>` },
  daily: { render: () => `<path d="M5.5 10 A7 7 0 0 1 18 7.5" fill="none"/><polyline points="17.5,3.5 18.6,7.7 14.3,7.6" fill="none"/><path d="M18.5 14 A7 7 0 0 1 6 16.5" fill="none"/><polyline points="6.5,20.5 5.4,16.3 9.7,16.4" fill="none"/>` },
  ai: { render: (c) => `<path d="M12 3 L13.7 9.4 L20 12 L13.7 14.6 L12 21 L10.3 14.6 L4 12 L10.3 9.4 Z" fill="none"/><path d="M18.6 3.5 L19.2 5.6 L21.2 6.2 L19.2 6.8 L18.6 8.9 L18 6.8 L16 6.2 L18 5.6 Z" fill="${c}" stroke="none"/>` },
  back: { render: () => `<polyline points="14,6 8,12 14,18" fill="none"/>` },
  flip: { render: () => `<path d="M18.5 12 A6.5 6.5 0 1 0 16.5 16.8" fill="none"/><polyline points="18.7,7.5 18.9,12 14.4,11.6" fill="none"/>` },
  calendar: { render: () => `<rect x="4" y="5.5" width="16" height="15" rx="2.6"/><line x1="4" y1="9.7" x2="20" y2="9.7"/><line x1="8" y1="3.5" x2="8" y2="6.6"/><line x1="16" y1="3.5" x2="16" y2="6.6"/>` },

  // ── 추가 픽 가능 아이콘 (통통) ──
  star: { filled: true, render: (c) => `<path d="M12 3 L14.6 9.2 L21.2 9.7 L16.2 14 L17.8 20.5 L12 16.9 L6.2 20.5 L7.8 14 L2.8 9.7 L9.4 9.2 Z" fill="${c}"/>` },
  music: { filled: true, render: (c) => `<ellipse cx="8" cy="17" rx="3" ry="2.4" fill="${c}"/><rect x="10.4" y="5.5" width="2" height="11" fill="${c}"/><path d="M10.4 5.5 L18 3.8 V7 L12.4 8.4 Z" fill="${c}"/>` },
  coffee: { filled: true, render: (c) => `<path d="M5 8.5 H16.5 V14 a4 4 0 0 1 -4 4 H9 a4 4 0 0 1 -4 -4 Z" fill="${c}"/><path d="M16.5 9.5 H18.5 a2 2 0 0 1 0 4 H16.5" fill="none" stroke="${c}" stroke-width="2"/><rect x="7" y="3.5" width="1.6" height="3" rx="0.8" fill="${c}"/><rect x="11" y="3.5" width="1.6" height="3" rx="0.8" fill="${c}"/><rect x="5" y="19" width="11.5" height="2" rx="1" fill="${c}"/>` },
  dumbbell: { filled: true, render: (c) => `<rect x="2.4" y="9.4" width="3" height="5.2" rx="1" fill="${c}"/><rect x="5.4" y="10.8" width="2" height="2.4" fill="${c}"/><rect x="7.4" y="10.5" width="9.2" height="3" fill="${c}"/><rect x="16.6" y="10.8" width="2" height="2.4" fill="${c}"/><rect x="18.6" y="9.4" width="3" height="5.2" rx="1" fill="${c}"/>` },
  gift: { filled: true, render: (c) => `<rect x="4" y="9.5" width="16" height="11" rx="1.6" fill="${c}"/><rect x="3" y="7" width="18" height="3.8" rx="1.2" fill="${c}"/><rect x="11" y="7" width="2" height="13.5" fill="#fff"/><path d="M12 7 C 9.5 3, 6 4.5, 8.5 7 Z M12 7 C 14.5 3, 18 4.5, 15.5 7 Z" fill="${c}"/>` },
  home: { filled: true, render: (c) => `<path d="M3.5 11.5 L12 4 L20.5 11.5" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10 V20 H18 V10 L12 5 Z" fill="${c}"/><rect x="10.2" y="14" width="3.6" height="6" fill="#fff"/>` },
  leaf: { filled: true, render: (c) => `<path d="M5 19 C 3.5 9.5, 11 4, 20 5 C 20.5 14.5, 14 20.5, 5 19 Z" fill="${c}"/><path d="M8.5 16 C 12 12, 15 10, 18.5 8.2" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>` },
  moon: { filled: true, render: (c) => `<path d="M20.5 14.8 A8.7 8.7 0 1 1 9.8 4 A6.8 6.8 0 0 0 20.5 14.8 Z" fill="${c}"/>` },
  bolt: { filled: true, render: (c) => `<path d="M13.2 2 L5 13 H11 L9.8 22 L19 9.5 H12.6 Z" fill="${c}"/>` },
  pin: { filled: true, render: (c) => `<path d="M12 22 C 7 15, 5 12, 5 8.5 a7 7 0 0 1 14 0 C 19 12, 17 15, 12 22 Z" fill="${c}"/><circle cx="12" cy="8.5" r="2.6" fill="#fff"/>` },
  camera: { filled: true, render: (c) => `<rect x="3" y="7.5" width="18" height="12" rx="2.6" fill="${c}"/><path d="M8.5 7.5 L9.8 5.4 H14.2 L15.5 7.5 Z" fill="${c}"/><circle cx="12" cy="13.6" r="3.4" fill="#fff"/><circle cx="12" cy="13.6" r="1.7" fill="${c}"/>` },
  tree: { filled: true, render: (c) => `<rect x="10.8" y="13" width="2.4" height="8" rx="1.1" fill="${c}"/><circle cx="12" cy="8.5" r="5.6" fill="${c}"/><circle cx="7.7" cy="11.5" r="4" fill="${c}"/><circle cx="16.3" cy="11.5" r="4" fill="${c}"/>` },
};

/** 아이콘 피커에 노출할 아이콘 목록. */
export const PICK_ICONS = [
  "goal", "sprout", "star", "cat_health", "cat_happy", "leaf",
  "cat_travel", "cat_study", "cat_cert", "cat_job", "cat_career", "cat_free",
  "streak", "best", "today", "moon", "bolt", "music",
  "coffee", "dumbbell", "gift", "home", "pin", "camera",
];

export function hasIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

/** 카테고리 키 → 아이콘 이름. 커스텀(또는 매핑 없음)이면 null → 이모지로 폴백. */
export function catIconName(cat: string): string | null {
  const m: Record<string, string> = {
    travel: "cat_travel",
    study: "cat_study",
    cert: "cat_cert",
    job: "cat_job",
    career: "cat_career",
    health: "cat_health",
    happy: "cat_happy",
    free: "cat_free",
  };
  return m[cat] ?? null;
}

export function Icon({
  name,
  size = 20,
  color = "currentColor",
  className,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ic = ICONS[name];
  if (!ic) return null;
  const base = ic.filled
    ? { fill: color, stroke: "none" }
    : { fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      {...base}
      dangerouslySetInnerHTML={{ __html: ic.render(color) }}
    />
  );
}
