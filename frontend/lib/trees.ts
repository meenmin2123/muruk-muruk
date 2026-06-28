// 칭찬판 SVG 렌더러 (index.html에서 이식). 문자열을 반환 → dangerouslySetInnerHTML로 렌더.
import type { StickerBoard } from "./state";

type Goal = StickerBoard;
const stk = (g: Goal) => g.stickers ?? [];

// ── 커스텀 스티커(얼굴 없음, 100x100 기준) ──
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

// 개수-적응형 슬롯 배치 → [x, y, r]
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

// 매끈한 덤불 실루엣(플랫, 단일 패스)
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

// 플랫 일러스트 나무 + 개수-적응형 슬롯 (n칸 중 filledCount칸을 스티커로 채움)
function renderTree(n: number, filledCount: number): string {
  const W = 320, H = 300;
  const ax = 42, ay = 64, aw = W - 84, ah = H - 132;
  const slots = packSlots(Math.max(0, n), ax, ay, aw, ah);
  const ecx = W / 2, ecy = ay + ah / 2, rx = aw / 2 + 28, ry = ah / 2 + 26;
  const canopy = cloudPath(ecx, ecy, rx, ry, 11);
  const baseY = H - 24, half = 15, topY = ecy + ry * 0.5, midY = (topY + baseY) / 2;
  const trunk = `<path d="M${ecx - half} ${topY} C ${ecx - half - 1} ${midY}, ${ecx - half - 4} ${baseY - 20}, ${ecx - half - 13} ${baseY} L ${ecx - half - 2} ${baseY} C ${ecx - 3} ${baseY - 14}, ${ecx - 3} ${baseY - 13}, ${ecx} ${baseY - 13} C ${ecx + 3} ${baseY - 13}, ${ecx + 3} ${baseY - 14}, ${ecx + half + 2} ${baseY} L ${ecx + half + 13} ${baseY} C ${ecx + half + 4} ${baseY - 20}, ${ecx + half + 1} ${midY}, ${ecx + half} ${topY} Z" fill="#B5895C" stroke="#8a5d38" stroke-width="2.6" stroke-linejoin="round"/>`;
  const shadow = `<ellipse cx="${ecx}" cy="${baseY + 6}" rx="${half + 24}" ry="8" fill="#3a5a40" opacity="0.09"/>`;
  const body = `<path d="${canopy}" fill="#9AD27C" stroke="#5da64a" stroke-width="3" stroke-linejoin="round"/>`;
  const slotSvg = slots.map(([x, y, r], i) =>
    i < filledCount
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 2.5).toFixed(1)}" fill="#fff"/>${sticker(FILL[i % FILL.length], x, y, r * 1.95)}`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#ffffff" stroke="#4E9E45" stroke-width="2.2" stroke-dasharray="3.5 3.5" opacity="0.85"/>`
  ).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block"><rect width="${W}" height="${H}" fill="#f4faf0"/>${shadow}${trunk}${body}${slotSvg}</svg>`;
}

export function treeSVG(g: Goal, cap = 10): string {
  const n = Math.min(60, Math.max(1, Math.round(cap)));
  return renderTree(n, Math.min(stk(g).length, n));
}

/** 오늘의 나무 — 오늘 할 일 개수(total)만큼 칸을 그리고 완료한(done)만큼 스티커로 채운다. */
export function todayTreeSVG(done: number, total: number): string {
  const n = Math.min(60, Math.max(0, total));
  return renderTree(n, Math.min(Math.max(0, done), n));
}

function starPts(cx: number, cy: number, r: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + "," + (cy + Math.sin(a) * rr).toFixed(1);
  }
  return d + "Z";
}

export function grapeSVG(g: Goal, cap = 10): string {
  const n = stk(g).length;
  const c = Math.min(10, Math.max(1, Math.round(cap)));
  const pos = [[104, 92], [138, 92], [172, 92], [206, 92], [121, 122], [155, 122], [189, 122], [138, 152], [172, 152], [155, 182]].slice(0, c);
  const grapes = pos
    .map((p, i) => {
      const f = i < n;
      return `<circle cx="${p[0]}" cy="${p[1]}" r="17" fill="${f ? "#9B6FD6" : "#fff"}" stroke="${f ? "#7A4FB8" : "#DDCBEF"}" stroke-width="2"/>` + (f ? `<circle cx="${p[0] - 5}" cy="${p[1] - 6}" r="3" fill="#fff" opacity=".5"/>` : "");
    })
    .join("");
  return `<svg viewBox="0 0 304 220" style="width:100%;display:block"><rect width="304" height="220" fill="#F2ECFB"/><path d="M155,74 C150,58 150,50 158,44" fill="none" stroke="#7A5B36" stroke-width="4" stroke-linecap="round"/><ellipse cx="176" cy="50" rx="16" ry="9" fill="#6FB46F" stroke="#4E9D5E" stroke-width="2" transform="rotate(20 176 50)"/>${grapes}</svg>`;
}

export function starSVG(g: Goal, cap = 10): string {
  const n = stk(g).length;
  const c = Math.min(10, Math.max(1, Math.round(cap)));
  const pos = [[52, 82], [108, 82], [164, 82], [220, 82], [276, 82], [276, 166], [220, 166], [164, 166], [108, 166], [52, 166]].slice(0, c);
  const stars = pos.map((p, i) => `<path d="${starPts(p[0], p[1], 16)}" fill="${i < n ? "#FFC83D" : "#fff"}" stroke="${i < n ? "#E0A11F" : "#E3D6C2"}" stroke-width="2" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="0 0 304 210" style="width:100%;display:block"><rect width="304" height="210" fill="#FFF7EC"/><path d="M52,82 H276 V166 H52" fill="none" stroke="#EAD9C2" stroke-width="3" stroke-dasharray="5 7" stroke-linecap="round"/>${stars}<text x="52" y="56" text-anchor="middle" font-size="11" font-weight="800" fill="#C2922E">시작</text><text x="52" y="196" text-anchor="middle" font-size="11" font-weight="800" fill="#C2922E">완성!</text></svg>`;
}

export function flowerSVG(g: Goal, cap = 10): string {
  const s = stk(g);
  const c = Math.min(10, Math.max(1, Math.round(cap)));
  const slots = [[104, 84], [152, 78], [200, 84], [78, 124], [127, 118], [177, 118], [226, 124], [104, 160], [152, 166], [200, 160]].slice(0, c);
  const cells = slots
    .map((p, i) => {
      const f = s[i];
      const petals = [0, 1, 2, 3, 4].map((k) => {
        const a = (k / 5) * 6.283 - 1.57;
        return `<circle cx="${(p[0] + Math.cos(a) * 14).toFixed(1)}" cy="${(p[1] + Math.sin(a) * 14).toFixed(1)}" r="9" fill="${f ? "#FF9FC0" : "#ECDDE6"}"/>`;
      }).join("");
      return petals + `<circle cx="${p[0]}" cy="${p[1]}" r="12.5" fill="#fff"/>` + (f ? `<text x="${p[0]}" y="${p[1] + 5}" text-anchor="middle" font-size="15">${f}</text>` : `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#F0D7E2"/>`);
    })
    .join("");
  return `<svg viewBox="0 0 304 214" style="width:100%;display:block"><rect width="304" height="214" fill="#FBF0F6"/><rect x="0" y="180" width="304" height="34" fill="#A6D67E"/><circle cx="40" cy="40" r="15" fill="#FFE08A"/>${cells}</svg>`;
}

export function balloonSVG(g: Goal, cap = 10): string {
  const n = stk(g).length;
  const c = Math.min(10, Math.max(1, Math.round(cap)));
  const COL = ["#FF8FA3", "#7FB0F0", "#8FD08C", "#FFC861", "#C9A0E8", "#FF8FA3", "#7FB0F0", "#8FD08C", "#FFC861", "#C9A0E8"];
  const slots = [[104, 68], [152, 62], [200, 68], [80, 102], [128, 96], [176, 96], [224, 102], [120, 132], [184, 132], [152, 158]].slice(0, c);
  const tieX = 152, tieY = 200;
  const strings = slots.map((p) => `<path d="M${p[0]},${p[1] + 18} Q${(((p[0] + tieX) / 2) | 0)},${(((p[1] + tieY) / 2) | 0)} ${tieX},${tieY}" fill="none" stroke="#CBB89A" stroke-width="1"/>`).join("");
  const balloons = slots
    .map((p, i) => {
      const f = i < n;
      return `<path d="M${p[0] - 3},${p[1] + 16} L${p[0] + 3},${p[1] + 16} L${p[0]},${p[1] + 21} Z" fill="${f ? COL[i] : "#E2DAE8"}"/>` + `<ellipse cx="${p[0]}" cy="${p[1]}" rx="15" ry="18" fill="${f ? COL[i] : "#fff"}" stroke="${f ? "rgba(0,0,0,.06)" : "#E2DAE8"}" stroke-width="2"/>` + (f ? `<ellipse cx="${p[0] - 5}" cy="${p[1] - 6}" rx="3" ry="4.5" fill="#fff" opacity=".55"/>` : "");
    })
    .join("");
  return `<svg viewBox="0 0 304 214" style="width:100%;display:block"><rect width="304" height="214" fill="#F3F7FC"/>${strings}${balloons}<circle cx="${tieX}" cy="${tieY}" r="3" fill="#9A8463"/></svg>`;
}

export function rainbowSVG(g: Goal, cap = 10): string {
  const n = stk(g).length;
  const cc = Math.min(10, Math.max(1, Math.round(cap)));
  const COL = ["#FF6B6B", "#FF9F43", "#FFC233", "#3FC58A", "#36C5D8", "#5B8DEF", "#9B7BE8", "#FF6B8A", "#FFA94D", "#63C97A"];
  const cx = 152, cy = 206;
  let arcs = "";
  ["#FF8FA3", "#FFC861", "#8FD08C", "#7FB0F0", "#C9A0E8"].forEach((c, k) => {
    const r = 96 + k * 14;
    arcs += `<path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="${c}" stroke-width="11" opacity=".45"/>`;
  });
  const sr = 124;
  const slots: number[][] = [];
  for (let i = 0; i < cc; i++) {
    const a = Math.PI - (i / (cc > 1 ? cc - 1 : 1)) * Math.PI;
    slots.push([cx + Math.cos(a) * sr, cy - Math.sin(a) * sr]);
  }
  const cells = slots
    .map((p, i) => {
      const f = i < n;
      return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="13" fill="${f ? COL[i] : "#fff"}" stroke="${f ? "rgba(0,0,0,.06)" : "#D9E4F0"}" stroke-width="2"/>` + (f ? `<circle cx="${(p[0] - 4).toFixed(1)}" cy="${(p[1] - 5).toFixed(1)}" r="2.6" fill="#fff" opacity=".5"/>` : "");
    })
    .join("");
  return `<svg viewBox="0 0 304 224" style="width:100%;display:block"><rect width="304" height="224" fill="#EAF4FD"/>${arcs}${cells}<ellipse cx="46" cy="190" rx="30" ry="15" fill="#fff"/><ellipse cx="258" cy="190" rx="30" ry="15" fill="#fff"/></svg>`;
}

/** 임의의 칸 수(cap)를 격자(도장 카드)로 그린다. 채운 칸은 테마 이모지로 채운다. */
export function gridBoardSVG(holder: Goal, cap: number, accent: string, fillEmoji: string): string {
  const filled = stk(holder).length;
  const n = Math.min(100, Math.max(1, Math.round(cap)));
  // 칸이 많아지면 열을 늘려 세로로 너무 길어지지 않게 (최대 ~8줄 목표).
  const cols = Math.min(n, Math.max(7, Math.ceil(n / 8)));
  const rows = Math.ceil(n / cols);
  const cell = 42;
  const pad = 16;
  const r = 16;
  const w = pad * 2 + cols * cell;
  const h = pad * 2 + rows * cell;
  let cells = "";
  for (let i = 0; i < n; i++) {
    const cx = pad + (i % cols) * cell + cell / 2;
    const cy = pad + Math.floor(i / cols) * cell + cell / 2;
    const on = i < filled;
    cells +=
      `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${r}" fill="#fff" stroke="${on ? accent : "#dfe9da"}" stroke-width="2.5"/>` +
      (on ? `<text x="${cx}" y="${(cy + 6).toFixed(1)}" text-anchor="middle" font-size="19">${fillEmoji}</text>` : "");
  }
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;display:block"><rect width="${w}" height="${h}" rx="18" fill="#f6fbf4"/>${cells}</svg>`;
}

export function boardSVG(g: Goal, theme: string, cap = 10, accent = "#46B97C"): string {
  switch (theme) {
    case "grape": return cap <= 10 ? grapeSVG(g, cap) : gridBoardSVG(g, cap, accent, "🍇");
    case "star": return cap <= 10 ? starSVG(g, cap) : gridBoardSVG(g, cap, accent, "⭐");
    case "flower": return cap <= 10 ? flowerSVG(g, cap) : gridBoardSVG(g, cap, accent, "🌸");
    case "balloon": return cap <= 10 ? balloonSVG(g, cap) : gridBoardSVG(g, cap, accent, "🎈");
    case "rainbow": return cap <= 10 ? rainbowSVG(g, cap) : gridBoardSVG(g, cap, accent, "🌈");
    default: return treeSVG(g, cap); // 나무: 개수-적응형 일러스트(어떤 칸 수든 OK)
  }
}

export function stampSVG(px: number): string {
  let petals = "";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.2832;
    petals += `<circle cx="${(50 + Math.cos(a) * 34).toFixed(1)}" cy="${(50 + Math.sin(a) * 34).toFixed(1)}" r="7" fill="#DA3A3A"/>`;
  }
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100">${petals}<circle cx="50" cy="50" r="35" fill="#DA3A3A"/><circle cx="50" cy="50" r="31" fill="#fff"/><circle cx="50" cy="50" r="29" fill="none" stroke="#DA3A3A" stroke-width="2"/><text x="50" y="58" text-anchor="middle" font-size="10.5" font-weight="800" fill="#DA3A3A">참 잘했어요</text></svg>`;
}
