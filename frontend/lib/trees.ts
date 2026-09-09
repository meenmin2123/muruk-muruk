// 칭찬판 SVG 렌더러. 문자열 반환 → dangerouslySetInnerHTML로 렌더.
// 모든 테마: 플랫 일러스트 + 개수-적응형 슬롯(할 일 개수만큼 자동 배치) + 커스텀 스티커.
import type { StickerBoard } from "./state";

type Goal = StickerBoard;
const stk = (g: Goal) => g.stickers ?? [];

// ── 커스텀 스티커(얼굴 없음, 100x100) ──
const STK: Record<string, string> = {
  star: `<path d="M50 12 L60 38.3 L88 39.6 L66.2 57.3 L73.5 84.4 L50 69 L26.5 84.4 L33.8 57.3 L12 39.6 L40 38.3 Z" fill="#FFD23E" stroke="#E8A300" stroke-width="3.4" stroke-linejoin="round"/>`,
  heart: `<path d="M50 84 C 18 62 16 38 31 29 C 43 22 50 33 50 38 C 50 33 57 22 69 29 C 84 38 82 62 50 84 Z" fill="#FF8FA3" stroke="#E96A85" stroke-width="3.4" stroke-linejoin="round"/>`,
  sprout: `<path d="M50 88 L50 50" stroke="#4E9E45" stroke-width="4.5" stroke-linecap="round"/><path d="M50 62 C 33 62 24 49 27 36 C 43 37 51 51 50 62 Z" fill="#7DC56A" stroke="#4E9E45" stroke-width="3.2" stroke-linejoin="round"/><path d="M50 54 C 67 54 76 41 73 28 C 57 29 49 43 50 54 Z" fill="#8ED27A" stroke="#4E9E45" stroke-width="3.2" stroke-linejoin="round"/>`,
  clover: `<path d="M50 50 L53 84" stroke="#4E9E45" stroke-width="3.5" stroke-linecap="round"/>${[0, 90, 180, 270].map((r) => `<path transform="rotate(${r} 50 50)" d="M50 50 C 37 41 37 23 50 21 C 63 23 63 41 50 50 Z" fill="#7DC56A" stroke="#4E9E45" stroke-width="3.2" stroke-linejoin="round"/>`).join("")}`,
  rainbow: `<path d="M16 72 A34 34 0 0 1 84 72" fill="none" stroke="#FF8A8A" stroke-width="6"/><path d="M23 72 A27 27 0 0 1 77 72" fill="none" stroke="#FFC06A" stroke-width="6"/><path d="M30 72 A20 20 0 0 1 70 72" fill="none" stroke="#FFE08A" stroke-width="6"/><path d="M37 72 A13 13 0 0 1 63 72" fill="none" stroke="#9BD67E" stroke-width="6"/><ellipse cx="16" cy="74" rx="11" ry="8" fill="#fff" stroke="#C7D6Cf" stroke-width="2.6"/><ellipse cx="84" cy="74" rx="11" ry="8" fill="#fff" stroke="#C7D6Cf" stroke-width="2.6"/>`,
  chick: `<ellipse cx="30" cy="60" rx="9" ry="13" fill="#FFD64D" stroke="#F2B100" stroke-width="3"/><circle cx="52" cy="55" r="27" fill="#FFE066" stroke="#F2B100" stroke-width="3.4"/><path d="M48 31 q4 -8 8 0" fill="none" stroke="#F2B100" stroke-width="3" stroke-linecap="round"/><path d="M66 55 L80 52 L70 62 Z" fill="#FF9F3D" stroke="#E07d20" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 70 q12 8 24 0" fill="none" stroke="#F2B100" stroke-width="2.6" stroke-linecap="round"/>`,
  strawberry: `<path d="M50 40 C 71 39 80 55 71 71 C 64 83 54 89 50 89 C 46 89 36 83 29 71 C 20 55 29 39 50 40 Z" fill="#FF6B6B" stroke="#DF4848" stroke-width="3.2" stroke-linejoin="round"/><g fill="#FFE9A8"><circle cx="42" cy="58" r="1.8"/><circle cx="58" cy="58" r="1.8"/><circle cx="50" cy="66" r="1.8"/><circle cx="38" cy="71" r="1.8"/><circle cx="62" cy="71" r="1.8"/><circle cx="50" cy="79" r="1.8"/></g><path d="M40 42 L50 31 L60 42 C 56 47 44 47 40 42 Z" fill="#7DC56A" stroke="#4E9E45" stroke-width="2.8" stroke-linejoin="round"/>`,
  medal: `<path d="M38 16 L47 50 L40 54 Z" fill="#7FB4F0" stroke="#5a8fd0" stroke-width="2.4" stroke-linejoin="round"/><path d="M62 16 L53 50 L60 54 Z" fill="#FF8A8A" stroke="#e06b6b" stroke-width="2.4" stroke-linejoin="round"/><circle cx="50" cy="64" r="22" fill="#FFD23E" stroke="#E8A300" stroke-width="3.4"/><path d="M50 53 L54 62 L63 62 L56 68 L58 77 L50 72 L42 77 L44 68 L37 62 L46 62 Z" fill="#FFE9A8" stroke="#F0BC3a" stroke-width="1.4" stroke-linejoin="round"/>`,
};
const FILL = ["star", "heart", "sprout", "clover", "strawberry", "rainbow", "chick", "medal"];
const sticker = (name: string, cx: number, cy: number, size: number) =>
  `<g transform="translate(${(cx - size / 2).toFixed(1)} ${(cy - size / 2).toFixed(1)}) scale(${(size / 100).toFixed(3)})">${STK[name]}</g>`;

// ── 공통 헬퍼 ──
function packSlots(n: number, ax: number, ay: number, aw: number, ah: number): [number, number, number][] {
  const cols = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(n * 1.45))));
  const rows = Math.ceil(n / cols) || 1;
  const cellW = aw / cols, cellH = ah / rows;
  const r = Math.min(34, Math.min(cellW, cellH) * 0.4);
  const pos: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), col = i - row * cols;
    pos.push([ax + (aw - inRow * cellW) / 2 + (col + 0.5) * cellW, ay + (row + 0.5) * cellH, r]);
  }
  return pos;
}
function cloudPath(cx: number, cy: number, rx: number, ry: number, m = 11, bulge = 1.12): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < m; i++) {
    const a = ((-90 + (i * 360) / m) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < m; i++) {
    const [x, y] = pts[(i + 1) % m];
    const [px, py] = pts[i];
    const r = (Math.hypot(x - px, y - py) / 2) * bulge;
    d += ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + " Z";
}
const leaf = (x: number, y: number, rot: number, s: number, c = "#86c869") =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 C 16 -3 25 -15 22 -28 C 7 -25 -2 -12 0 0 Z" fill="${c}" stroke="#5da64a" stroke-width="2.6" stroke-linejoin="round"/>`;
const sparkle = (x: number, y: number, s: number, c = "#FFD23E") =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" fill="${c}"/>`;

const ACCENT: Record<string, string> = { tree: "#4E9E45", grape: "#8E6FC0", star: "#5B8DEF", flower: "#FF7DA3", balloon: "#5C9BE0", rainbow: "#5B8DEF" };

/**
 * 테마별 칭찬판 SVG. n칸 중 filled칸을 커스텀 스티커로 채우고, 빈칸은 점선 동그라미.
 *
 * @param growth 0~1. 1이면 원래 크기(칭찬판). 1보다 작으면 지면을 축으로 전체를 축소해
 *               '자라는' 느낌을 준다 — 오늘의 나무에서만 쓴다.
 * @param accentOverride 빈칸 테두리 색. 없으면 테마 기본색.
 */
function renderBoard(theme: string, n: number, filled: number, growth = 1, accentOverride?: string): string {
  const W = 300, H = 300, cx = W / 2;
  const accent = accentOverride || ACCENT[theme] || ACCENT.tree;
  let area = { ax: 34, ay: 74, aw: W - 68, ah: H - 138 };
  if (theme === "tree") area = { ax: 42, ay: 56, aw: W - 84, ah: 146 };
  if (theme === "flower") area = { ax: 40, ay: 70, aw: W - 80, ah: H - 150 };
  if (theme === "rainbow") area = { ax: 40, ay: 110, aw: W - 80, ah: H - 168 };
  const slots = packSlots(Math.max(0, n), area.ax, area.ay, area.aw, area.ah);

  let bg = `<rect width="${W}" height="${H}" rx="20" fill="#fbfdfa"/>`;
  let scene = "";

  if (theme === "tree") {
    const ecx = cx, ecy = area.ay + area.ah / 2, rx = area.aw / 2 + 28, ry = area.ah / 2 + 28;
    const baseY = H - 12, half = 18, topY = ecy + ry * 0.5, midY = (topY + baseY) / 2;
    bg = `<rect width="${W}" height="${H}" rx="20" fill="#f4faf0"/>`;
    scene = `<ellipse cx="${ecx}" cy="${baseY + 6}" rx="40" ry="8" fill="#3a5a40" opacity="0.09"/>
      <path d="M${ecx - half} ${topY} C ${ecx - half - 1} ${midY}, ${ecx - half - 4} ${baseY - 20}, ${ecx - half - 13} ${baseY} L ${ecx - half - 2} ${baseY} C ${ecx - 3} ${baseY - 14}, ${ecx - 3} ${baseY - 13}, ${ecx} ${baseY - 13} C ${ecx + 3} ${baseY - 13}, ${ecx + 3} ${baseY - 14}, ${ecx + half + 2} ${baseY} L ${ecx + half + 13} ${baseY} C ${ecx + half + 4} ${baseY - 20}, ${ecx + half + 1} ${midY}, ${ecx + half} ${topY} Z" fill="#B5895C" stroke="#8a5d38" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="${cloudPath(ecx, ecy, rx, ry, 11)}" fill="#9AD27C" stroke="#5da64a" stroke-width="3" stroke-linejoin="round"/>`;
  } else if (theme === "grape") {
    bg = `<rect width="${W}" height="${H}" rx="20" fill="#f7f2fc"/>`;
    const ecx = cx, ecy = area.ay + area.ah / 2;
    scene = `<ellipse cx="${ecx}" cy="${ecy + 6}" rx="${area.aw / 2 + 6}" ry="${area.ah / 2 + 14}" fill="#ece2f8"/>
      <path d="M30 50 Q${cx} 26 ${W - 30} 46" fill="none" stroke="#7CB342" stroke-width="6" stroke-linecap="round"/>
      <path d="M${W - 36} 46 q14 -10 22 2 q-9 7 -22 -2 Z" fill="#8ED27A" stroke="#4E9E45" stroke-width="2.4"/>
      ${leaf(70, 52, 165, 0.8)}${leaf(cx + 6, 40, 185, 0.85)}${leaf(W - 72, 54, 205, 0.8)}`;
  } else if (theme === "star") {
    bg = `<rect width="${W}" height="${H}" rx="20" fill="#eef1ff"/>`;
    scene = `<circle cx="52" cy="58" r="17" fill="#FFE066" stroke="#F2C200" stroke-width="2.6"/><circle cx="59" cy="53" r="14" fill="#eef1ff"/>
      ${sparkle(W - 60, 58, 1.1)}${sparkle(W - 36, 80, 0.8)}${sparkle(W - 30, 50, 0.7)}${sparkle(40, H - 46, 0.8)}${sparkle(W - 54, H - 40, 1)}
      <ellipse cx="${W - 56}" cy="${H - 60}" rx="22" ry="11" fill="#fff" opacity="0.75"/>`;
  } else if (theme === "flower") {
    bg = `<rect width="${W}" height="${H}" rx="20" fill="#fdf0f7"/>`;
    const fl = (x: number, y: number, c: string) =>
      `<g transform="translate(${x} ${y})"><rect x="-2.5" y="0" width="5" height="46" rx="2.5" fill="#7DC56A"/>${leaf(-2, 26, 205, 0.55)}${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${(11 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(11 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="8" fill="${c}" stroke="#e58aa6" stroke-width="2"/>`).join("")}<circle cx="0" cy="0" r="7.5" fill="#FFD23E" stroke="#E8A300" stroke-width="2"/></g>`;
    scene = `<rect x="14" y="${H - 32}" width="${W - 28}" height="16" rx="8" fill="#bfe6a8" stroke="#9ED584" stroke-width="2"/>
      ${fl(36, H - 72, "#FF9DB6")}${fl(W - 36, H - 76, "#FFC06A")}${leaf(22, 66, 150, 0.6)}${leaf(W - 22, 62, 210, 0.6)}`;
  } else if (theme === "balloon") {
    bg = `<rect width="${W}" height="${H}" rx="20" fill="#f1f7fd"/>`;
    const knotX = cx, knotY = H - 18;
    scene = slots.map(([x, y, r]) => `<path d="M${x.toFixed(1)} ${(y + r).toFixed(1)} Q ${((x + knotX) / 2).toFixed(1)} ${((y + knotY) / 2).toFixed(1)} ${knotX} ${knotY}" fill="none" stroke="#bcd0e6" stroke-width="1.4"/>`).join("") +
      `<circle cx="${knotX}" cy="${knotY}" r="3.5" fill="#9bb4cd"/><ellipse cx="48" cy="64" rx="22" ry="11" fill="#fff" opacity="0.8"/><ellipse cx="${W - 50}" cy="84" rx="18" ry="9" fill="#fff" opacity="0.7"/>`;
  } else if (theme === "rainbow") {
    bg = `<rect width="${W}" height="${H}" rx="20" fill="#eaf5fd"/>`;
    const rcx = cx, rcy = 118;
    scene = ["#FF8A8A", "#FFC06A", "#FFE08A", "#9BD67E", "#86C0F0"].map((c, k) => { const rr = 92 - k * 13; return `<path d="M${rcx - rr} ${rcy} A${rr} ${rr} 0 0 1 ${rcx + rr} ${rcy}" fill="none" stroke="${c}" stroke-width="11"/>`; }).join("") +
      `<ellipse cx="${rcx - 92}" cy="${rcy}" rx="26" ry="13" fill="#fff" stroke="#dbe6f0" stroke-width="2"/><ellipse cx="${rcx + 92}" cy="${rcy}" rx="26" ry="13" fill="#fff" stroke="#dbe6f0" stroke-width="2"/>`;
  }

  const slotSvg = slots.map(([x, y, r], i) =>
    i < filled
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 2.5).toFixed(1)}" fill="#fff"/>${sticker(FILL[i % FILL.length], x, y, r * 1.95)}`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#ffffff" stroke="${accent}" stroke-width="2.2" stroke-dasharray="3.5 3.5" opacity="0.85"/>`
  ).join("");

  // 나무·슬롯을 함께 지면 기준으로 축소한다. 함께 줄여야 스티커가 수관 밖으로 튀지 않는다.
  const g = Math.min(1, Math.max(0, growth));
  const body = scene + slotSvg;
  const inner =
    g >= 0.999
      ? body
      : `<g transform="translate(${cx} ${GROUND_Y}) scale(${(MIN_SCALE + (1 - MIN_SCALE) * g).toFixed(3)}) translate(${-cx} ${-GROUND_Y})">${body}</g>`;

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${bg}${inner}</svg>`;
}

// 성장 축소의 기준점(지면)과 가장 작을 때의 배율.
const GROUND_Y = 288;
const MIN_SCALE = 0.68;

/** 칭찬판 — 목표 색(accent)이 있으면 빈칸 테두리에 반영한다. */
export function boardSVG(g: Goal, theme: string, cap = 10, accent?: string): string {
  const n = Math.min(60, Math.max(1, Math.round(cap)));
  return renderBoard(theme || "tree", n, Math.min(stk(g).length, n), 1, accent);
}

export function treeSVG(g: Goal, cap = 10): string {
  return boardSVG(g, "tree", cap);
}

/**
 * 오늘의 나무 — 오늘 할 일 개수(total)만큼 칸을 그리고 완료한(done)만큼 스티커로 채운다.
 * 완료 비율만큼 나무가 실제로 자란다(PRD 4.1 "완료 비율에 따라 자라는 시각 피드백").
 */
export function todayTreeSVG(done: number, total: number): string {
  const n = Math.min(60, Math.max(0, total));
  const filled = Math.min(Math.max(0, done), n);
  const growth = total > 0 ? filled / total : 0;
  return renderBoard("tree", n, filled, growth);
}

// ── 완성 도장(칭찬판을 가득 채우면 찍힌다) ──
// 아이콘은 (50,38) 기준으로 축소 래핑 → 항상 가운데 + 테두리 안쪽 여유.
const stampShrink = (inner: string, s = 0.78) => `<g transform="translate(50 38) scale(${s}) translate(-50 -38)">${inner}</g>`;
const stampThumb = (c: string) =>
  stampShrink(`<g fill="${c}"><rect x="30" y="27" width="7.5" height="20.4" rx="2.4"/><path transform="translate(30 18) scale(1.7)" d="M23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.6 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></g>`);
const stampCrown = (c: string) =>
  stampShrink(`<g fill="${c}"><path d="M30 52 L26 30 L39 40 L50 24 L61 40 L74 30 L70 52 Z" stroke="${c}" stroke-width="2" stroke-linejoin="round"/><circle cx="26" cy="28" r="3.4"/><circle cx="50" cy="21" r="3.8"/><circle cx="74" cy="28" r="3.4"/><rect x="30" y="50" width="40" height="5" rx="2.5"/></g>`);
const stampStars = (c: string) =>
  stampShrink(`<g fill="${c}">${[24, 37, 50, 63, 76].map((x, i) => `<path transform="translate(${x} ${38 + (i === 2 ? -3 : i === 1 || i === 3 ? -1 : 0)}) scale(0.42)" d="M0 -16 L4.7 -5 L16 -4.2 L7.5 3.4 L10 14.8 L0 8.8 L-10 14.8 L-7.5 3.4 L-16 -4.2 L-4.7 -5 Z"/>`).join("")}</g>`, 0.86);
const stampBigStar = (c: string) =>
  stampShrink(`<g fill="${c}"><path transform="translate(50 38) scale(1.05)" d="M0 -16 L4.7 -5 L16 -4.2 L7.5 3.4 L10 14.8 L0 8.8 L-10 14.8 L-7.5 3.4 L-16 -4.2 L-4.7 -5 Z"/></g>`);

// [색, 아이콘, 문구, 글자크기]
const STAMP_VARIANTS: [string, (c: string) => string, string, number][] = [
  ["#E25555", stampThumb, "참 잘했어요", 9.5],
  ["#E0A11F", stampCrown, "Best", 12],
  ["#3FA86E", stampStars, "Good", 12],
  ["#5B8DEF", stampBigStar, "축하해요", 10.5],
  ["#C9628E", stampThumb, "최고예요", 10.5],
  ["#7C6FD0", stampCrown, "대단해요", 10],
];

export const STAMP_COUNT = STAMP_VARIANTS.length;

/** 완성 도장 SVG — 꽃잎 테두리 + 가운데 아이콘 + 아래 문구. variant로 6종 순환. */
export function stampSVG(px: number, variant = 0): string {
  const [c, icon, text, fs] = STAMP_VARIANTS[((variant % STAMP_COUNT) + STAMP_COUNT) % STAMP_COUNT];
  let petals = "";
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI;
    petals += `<circle cx="${(50 + Math.cos(a) * 41).toFixed(1)}" cy="${(50 + Math.sin(a) * 41).toFixed(1)}" r="7" fill="${c}"/>`;
  }
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100">${petals}<circle cx="50" cy="50" r="42" fill="${c}"/><circle cx="50" cy="50" r="38.5" fill="#fff"/><circle cx="50" cy="50" r="37" fill="none" stroke="${c}" stroke-width="1.4"/><g transform="translate(0 1)">${icon(c)}</g><text x="50" y="73" text-anchor="middle" font-family="'Jua', sans-serif" font-size="${fs + 1.5}" fill="${c}">${text}</text></svg>`;
}
