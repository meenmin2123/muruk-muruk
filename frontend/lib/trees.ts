// 칭찬판 SVG 렌더러. 문자열 반환 → dangerouslySetInnerHTML로 렌더.
//
// 일러스트 규칙(테마 6종·스티커 8종이 모두 따른다)
//  1. 외곽선을 쓰지 않는다. 형태는 '한 겹 어두운 면'(emb/embG)으로 만든다.
//     선(줄기·끈·무지개 호·풀잎)은 외곽선이 아니라 그 자체가 형태라서 예외.
//  2. 색은 팔레트 두 벌에서만 가져온다 — 장면은 P(채도 낮춤), 스티커는 S(한 단 위).
//  3. 장면은 back(하늘·빛) / mid(주인공·칸) / front(지면·부유물) 3층으로 쌓는다.
//     성장 축소(오늘의 나무)는 mid 에만 걸린다. 하늘과 땅은 줄지 않는다.
//  4. 빈 칸만 예외로 가느다란 점선을 쓴다 — '몇 칸 남았나'를 읽히게 하는 유일한 선.
//  5. 난수는 반드시 시드를 고정한다. SSR과 클라이언트가 같은 문자열을 내야 한다.
import type { StickerBoard } from "./state";

type Goal = StickerBoard;
const stk = (g: Goal) => g.stickers ?? [];

// ── 팔레트 ──
// 장면(P)은 채도를 낮춰 뒤로 물러나게 하고, 스티커(S)는 한 단 위에 둔다.
// 보드에서 가장 진한 자리는 늘 스티커여야 한다 — 그게 보상이니까.
const P = {
  leaf: "#a6cd95", leafD: "#8bbd79", leafL: "#bedcae",
  stem: "#8fb87f", stemD: "#74a564",
  bark: "#c2a98e", barkD: "#a78c71",
  lilac: "#cbb9e4", lilacD: "#ab96cd",
  skyD: "#7ba3d4",
  gold: "#f2c75e", goldD: "#d9a93c",
  rose: "#eda4b2", roseD: "#d8808f",
  shade: "#6b7a6e",
};
const S = {
  gold: "#f5c23f", goldD: "#d9a11c", cream: "#fbeec4",
  rose: "#f193a5", roseD: "#da6a82",
  berry: "#ec6f6d", berryD: "#cc4a48",
  // 수관(#a6cd95)보다 반드시 진해야 한다 — 같으면 새싹·클로버가 나무에 묻힌다.
  grass: "#86c76e", grassD: "#55934a",
  beak: "#e79246",
  sky: "#8fb6e4", roseR: "#e98ba0",
};

// ── 시드 고정 난수 / 문자열 해시 ──
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
/** defs id 충돌 방지용. 한 페이지에 칭찬판이 여러 개 떠도 서로의 그라데이션을 가져가지 않는다. */
function uid(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
function mix(a: string, b: string, t: number): string {
  const rgb = (s: string) => {
    const v = s.length === 4 ? s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s.slice(1);
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

// ── 형태 만들기: 외곽선 대신 같은 모양을 살짝 줄여 겹친다(빛은 왼쪽 위에서 온다) ──
const embG = (
  draw: (c: string) => string, dark: string, light: string,
  cx = 50, cy = 50, s = 0.945, dx = -2, dy = -2.4,
) => `${draw(dark)}<g transform="translate(${cx} ${cy}) scale(${s}) translate(${-cx + dx} ${-cy + dy})">${draw(light)}</g>`;
const emb = (d: string, dark: string, light: string, cx = 50, cy = 50, s = 0.945, dx = -2, dy = -2.4) =>
  embG((c) => `<path d="${d}" fill="${c}"/>`, dark, light, cx, cy, s, dx, dy);

// ── 커스텀 스티커(얼굴 없음, 100x100) ──
const D_STAR = "M50 12 L60 38.3 L88 39.6 L66.2 57.3 L73.5 84.4 L50 69 L26.5 84.4 L33.8 57.3 L12 39.6 L40 38.3 Z";
const D_HEART = "M50 84 C 18 62 16 38 31 29 C 43 22 50 33 50 38 C 50 33 57 22 69 29 C 84 38 82 62 50 84 Z";
const D_BERRY = "M50 40 C 71 39 80 55 71 71 C 64 83 54 89 50 89 C 46 89 36 83 29 71 C 20 55 29 39 50 40 Z";
const D_PETAL = "M50 50 C 37 41 37 23 50 21 C 63 23 63 41 50 50 Z";
/** D_STAR 를 원점 기준으로 옮긴 것(메달 안쪽 별). */
const D_STAR0 = "M0 -38 L10 -11.7 L38 -10.4 L16.2 7.3 L23.5 34.4 L0 19 L-23.5 34.4 L-16.2 7.3 L-38 -10.4 L-10 -11.7 Z";
const D_SPROUT = "M50 63 C 32 63 23 49 26 35 C 43 36 51 51 50 63 Z M50 55 C 68 55 77 41 74 27 C 57 28 49 42 50 55 Z";

const STK: Record<string, string> = {
  star: emb(D_STAR, S.goldD, S.gold, 50, 50, 0.93, -2.2, -2.6),
  heart: emb(D_HEART, S.roseD, S.rose, 50, 54, 0.93, -2.2, -2.6),
  sprout:
    `<path d="M50 88 L50 54" stroke="${S.grassD}" stroke-width="4.5" stroke-linecap="round"/>` +
    emb(D_SPROUT, S.grassD, S.grass, 50, 45, 0.9, -1.4, -1.8),
  clover:
    `<path d="M50 50 L53 85" stroke="${S.grassD}" stroke-width="3.5" stroke-linecap="round"/>` +
    embG((c) => [0, 90, 180, 270].map((r) => `<path transform="rotate(${r} 50 50)" d="${D_PETAL}" fill="${c}"/>`).join(""),
      S.grassD, S.grass, 50, 50, 0.9, -1.6, -1.8),
  rainbow:
    ["#ed8f8f", "#f0b874", "#edd283", "#92c878"].map((c, k) =>
      `<path d="M${16 + k * 7} 72 A${34 - k * 7} ${34 - k * 7} 0 0 1 ${84 - k * 7} 72" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`).join("") +
    embG((c) => `<ellipse cx="16" cy="74" rx="11" ry="8" fill="${c}"/><ellipse cx="84" cy="74" rx="11" ry="8" fill="${c}"/>`,
      "#cfdbd4", "#ffffff", 50, 74, 0.92, 0, -2.4),
  // 얼굴은 그리지 않는다. 형태는 뒤쪽 날개·머리깃·앞 날개·부리로만 세운다.
  // 꼬리깃이나 긴 부리를 밖으로 빼면 몸에서 뿔이 솟은 것처럼 읽혀 쓰지 않는다.
  chick:
    `<ellipse cx="30" cy="61" rx="9" ry="13" fill="${S.goldD}"/>` +
    embG((c) => `<circle cx="52" cy="56" r="27" fill="${c}"/>`, S.goldD, S.gold, 52, 56, 0.93, -2.2, -2.6) +
    `<path d="M46 30 q6 -11 11 -1 q-6 4 -11 1 Z" fill="${S.goldD}"/>` +
    `<ellipse cx="45" cy="64" rx="14" ry="9.5" fill="${S.goldD}" opacity="0.42" transform="rotate(-14 45 64)"/>` +
    `<path d="M67 54 L82 51 L70 63 Z" fill="${S.beak}"/>`,
  // 꼭지는 emb 를 쓰지 않는다 — 뾰족한 끝에서 어두운 면이 머리카락처럼 삐져나온다.
  strawberry:
    embG((c) => `<path d="${D_BERRY}" fill="${c}"/>`, S.berryD, S.berry, 50, 64, 0.93, -2.2, -2.6) +
    `<g fill="${S.cream}"><circle cx="42" cy="58" r="1.9"/><circle cx="58" cy="58" r="1.9"/><circle cx="50" cy="66" r="1.9"/><circle cx="38" cy="71" r="1.9"/><circle cx="62" cy="71" r="1.9"/><circle cx="50" cy="79" r="1.9"/></g>` +
    `<path d="M36 44 L50 28 L64 44 C 57 50 43 50 36 44 Z" fill="${S.grassD}"/>` +
    `<path d="M41 43 L50 33 L59 43 C 54 47 46 47 41 43 Z" fill="${S.grass}"/>`,
  medal:
    `<path d="M30 12 L41 12 L48 50 L39 55 Z" fill="${S.sky}"/><path d="M70 12 L59 12 L52 50 L61 55 Z" fill="${S.roseR}"/>` +
    embG((c) => `<circle cx="50" cy="64" r="22" fill="${c}"/>`, S.goldD, S.gold, 50, 64, 0.91, -1.8, -2.2) +
    `<path transform="translate(50 65) scale(0.45)" d="${D_STAR0}" fill="${S.cream}"/>`,
};
const FILL = ["star", "heart", "sprout", "clover", "strawberry", "rainbow", "chick", "medal"];
const sticker = (name: string, cx: number, cy: number, size: number) =>
  `<g transform="translate(${(cx - size / 2).toFixed(1)} ${(cy - size / 2).toFixed(1)}) scale(${(size / 100).toFixed(3)})">${STK[name]}</g>`;

/** 스티커 한 장 — 칭찬판 밖(로그인 장식 등)에서 쓸 때. */
export function stickerSVG(name: string, px: number): string {
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100" style="display:block" aria-hidden="true">${STK[name] ?? STK.star}</svg>`;
}

// ── 공통 부품 ──
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
const D_LEAF = "M0 0 C 16 -3 25 -15 22 -28 C 7 -25 -2 -12 0 0 Z";
/** 잎 하나 — 외곽선 없이 두 겹으로 두께를 준다. */
const leaf = (x: number, y: number, rot: number, s: number, c = P.leaf, cd = P.stemD) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="${D_LEAF}" fill="${cd}"/>` +
  `<g transform="translate(1.6 1.8) scale(0.86)"><path d="${D_LEAF}" fill="${c}"/></g></g>`;
const sparkle = (x: number, y: number, s: number, c = P.gold, op = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" fill="${c}" opacity="${op}"/>`;
/** 초승달 — 바탕색으로 덮어 깎지 않고 한 덩어리 path 로 그린다(하늘이 그라데이션이라 덮기가 안 맞는다). */
function crescent(cx: number, cy: number, R: number, r: number, d: number, fill: string): string {
  const x = (R * R - r * r + d * d) / (2 * d), y = Math.sqrt(Math.max(0, R * R - x * x));
  const px = (cx + x).toFixed(1);
  return `<path d="M${px} ${(cy - y).toFixed(1)} A${R} ${R} 0 1 0 ${px} ${(cy + y).toFixed(1)} A${r} ${r} 0 1 1 ${px} ${(cy - y).toFixed(1)} Z" fill="${fill}"/>`;
}
/** 지면의 풀 — 높이·기울기·농도를 흩어 놓는다. 규칙적인 톱니로 보이면 장면이 죽는다. */
function grassRow(seed: number, y: number, x0: number, x1: number, c: string): string {
  const r = rng(seed);
  let out = "", x = x0;
  while (x < x1) {
    const h = 8 + r() * 9, lean = (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2.5);
    out += `<path d="M${x.toFixed(0)} ${y} q ${lean.toFixed(1)} ${(-h * 0.6).toFixed(1)} ${(lean * 1.8).toFixed(1)} ${(-h).toFixed(1)}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="${(0.4 + r() * 0.35).toFixed(2)}"/>`;
    x += 9 + r() * 10;
  }
  return out;
}
/** 구름 한 덩이 — 매끈한 타원은 접시처럼 보여서 쓰지 않는다. 아래쪽에 그늘을 한 겹 깐다. */
const cloud = (cx: number, cy: number, rx: number, ry: number, op = 1, m = 9) =>
  `<g opacity="${op}"><path d="${cloudPath(cx, cy + 2.2, rx, ry, m, 1.08)}" fill="#dbe4ee"/>` +
  `<path d="${cloudPath(cx, cy, rx, ry, m, 1.08)}" fill="#ffffff"/></g>`;

// ── 테마 ──
type Area = { ax: number; ay: number; aw: number; ah: number };
type Slot = [number, number, number];
type Ctx = { W: number; H: number; cx: number; area: Area; slots: Slot[]; id: string };
type Scene = { back?: string; mid?: string; front?: string };
type ThemeDef = {
  area: Area;
  sky: [string, string, string];
  glow: string;
  glowAt: [number, number, number];
  /** 빈 칸 — 그 테마에서 칸 뒤에 깔리는 색을 기준으로 정한다. */
  slot: { fill: string; op: number; ring: string };
  scene: (c: Ctx) => Scene;
};

const THEME: Record<string, ThemeDef> = {
  tree: {
    area: { ax: 42, ay: 56, aw: 216, ah: 146 },
    sky: ["#edf4f7", "#f4f8f3", "#e8f0e3"],
    glow: "#fdf0c8",
    glowAt: [42, 44, 46],
    slot: { fill: "#ffffff", op: 0.5, ring: "#ffffff" },
    scene: ({ H, cx, area }) => {
      const ecy = area.ay + area.ah / 2, rx = area.aw / 2 + 28, ry = area.ah / 2 + 28;
      const baseY = H - 12, topY = ecy + ry * 0.5;
      const trunk = (x: number, half: number, ty: number, by: number, fill: string) => {
        const my = (ty + by) / 2;
        return `<path d="M${x - half} ${ty} C ${x - half - 1} ${my}, ${x - half - 4} ${by - 20}, ${x - half - 13} ${by} L ${x - half - 2} ${by} C ${x - 3} ${by - 14}, ${x - 3} ${by - 13}, ${x} ${by - 13} C ${x + 3} ${by - 13}, ${x + 3} ${by - 14}, ${x + half + 2} ${by} L ${x + half + 13} ${by} C ${x + half + 4} ${by - 20}, ${x + half + 1} ${my}, ${x + half} ${ty} Z" fill="${fill}"/>`;
      };
      return {
        back: `<circle cx="42" cy="44" r="13" fill="#f6e3a4"/>`,
        mid:
          `<ellipse cx="${cx}" cy="${baseY + 5}" rx="40" ry="7.5" fill="${P.shade}" opacity="0.11"/>` +
          trunk(cx, 18, topY, baseY, P.barkD) + trunk(cx - 1.5, 14, topY + 3, baseY - 1, P.bark) +
          `<path d="${cloudPath(cx, ecy, rx, ry, 11)}" fill="${P.leafD}"/>` +
          `<path d="${cloudPath(cx - 4, ecy - 6, rx * 0.95, ry * 0.94, 11)}" fill="${P.leaf}"/>`,
        // 떨어지는 잎은 칸이 놓이는 구역(area) 밖에만 둔다 — 스티커 위에 얹히면 지저분해진다.
        front:
          grassRow(7, 291, 18, 284, "#9cc98b") +
          leaf(64, 240, 28, 0.36, P.leafL, P.leaf) + leaf(228, 250, 146, 0.3, P.leafL, P.leaf) +
          leaf(280, 196, -32, 0.26, P.leafL, P.leaf),
      };
    },
  },

  grape: {
    area: { ax: 34, ay: 74, aw: 232, ah: 162 },
    sky: ["#f8f3fd", "#f4eefa", "#eee6f6"],
    glow: "#f0e2ff",
    glowAt: [250, 48, 54],
    slot: { fill: "#ffffff", op: 0.55, ring: "#c3b0de" },
    scene: ({ W, cx, area }) => {
      const ecy = area.ay + area.ah / 2;
      return {
        mid:
          `<ellipse cx="${cx}" cy="${ecy + 6}" rx="${area.aw / 2 + 6}" ry="${area.ah / 2 + 14}" fill="${P.lilacD}" opacity="0.3"/>` +
          `<ellipse cx="${cx - 5}" cy="${ecy}" rx="${area.aw / 2}" ry="${area.ah / 2 + 6}" fill="${P.lilac}" opacity="0.5"/>` +
          `<path d="M30 52 Q${cx} 26 ${W - 30} 48" fill="none" stroke="${P.stemD}" stroke-width="6" stroke-linecap="round"/>` +
          `<path d="M30 52 Q${cx} 28 ${W - 30} 48" fill="none" stroke="${P.stem}" stroke-width="3" stroke-linecap="round"/>` +
          leaf(72, 54, 165, 0.78) + leaf(cx + 6, 42, 185, 0.84) + leaf(W - 74, 56, 205, 0.78) +
          `<path d="M${W - 42} 50 q12 10 20 2 q-6 -12 -16 -4" fill="none" stroke="${P.stem}" stroke-width="2.4" stroke-linecap="round"/>`,
      };
    },
  },

  star: {
    area: { ax: 34, ay: 74, aw: 232, ah: 162 },
    sky: ["#e7ecfa", "#eef1fc", "#f5f6fd"],
    glow: "#fff4d2",
    glowAt: [52, 58, 50],
    slot: { fill: "#ffffff", op: 0.5, ring: "#c0cbe8" },
    scene: ({ W, H, area }) => {
      // 반짝임은 칸이 놓이는 구역 위아래 띠에만 흩는다 — 스티커 뒤에 깔려 사라지지 않게.
      const r = rng(19);
      let sp = "";
      for (let i = 0; i < 10; i++) {
        const top = i % 2 === 0;
        sp += sparkle(
          26 + r() * (W - 52),
          top ? 34 + r() * (area.ay - 46) : area.ay + area.ah + 8 + r() * (H - area.ay - area.ah - 26),
          0.5 + r() * 0.6, P.gold, +(0.45 + r() * 0.45).toFixed(2),
        );
      }
      return {
        back: crescent(54, 56, 23, 18, 10, "#f7dd95") + sp,
        mid:
          cloud(206, H - 36, 52, 15, 0.8) + cloud(76, H - 22, 40, 12, 0.7),
      };
    },
  },

  flower: {
    area: { ax: 40, ay: 70, aw: 220, ah: 150 },
    sky: ["#fdf3f8", "#fbeef4", "#f7ecf0"],
    // 분홍 하늘 위에 분홍 빛을 두면 얼룩으로 읽힌다 — 빛은 따뜻한 크림으로.
    glow: "#fdf0cf",
    glowAt: [44, 44, 42],
    slot: { fill: "#ffffff", op: 0.55, ring: "#ecc4d6" },
    scene: ({ W, H }) => {
      const fl = (x: number, y: number, c: string, cd: string) =>
        `<g transform="translate(${x} ${y})"><rect x="-2.5" y="0" width="5" height="46" rx="2.5" fill="${P.stem}"/>` +
        leaf(-2, 26, 205, 0.5) +
        embG((cc) => [0, 60, 120, 180, 240, 300].map((a) =>
          `<circle cx="${(11 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(11 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="8" fill="${cc}"/>`).join(""),
          cd, c, 0, 0, 0.93, -1.4, -1.6) +
        `<circle cx="0" cy="0" r="7.5" fill="${P.goldD}"/><circle cx="-0.6" cy="-0.8" r="6.4" fill="${P.gold}"/></g>`;
      return {
        mid:
          `<rect x="14" y="${H - 34}" width="${W - 28}" height="18" rx="9" fill="${P.stemD}" opacity="0.45"/>` +
          `<rect x="14" y="${H - 34}" width="${W - 28}" height="14" rx="7" fill="#bfe0ab"/>` +
          fl(36, H - 74, P.rose, P.roseD) + fl(W - 36, H - 78, P.gold, P.goldD) +
          leaf(24, H - 46, 150, 0.5) + leaf(W - 24, H - 50, 210, 0.5),
        front: grassRow(13, H - 22, 20, 280, "#a4cf8e"),
      };
    },
  },

  balloon: {
    area: { ax: 34, ay: 74, aw: 232, ah: 162 },
    sky: ["#f4fafe", "#eef5fc", "#e7eff8"],
    glow: "#fff6d8",
    glowAt: [44, 44, 46],
    // 풍선 테마에서는 빈 칸이 곧 '아직 안 분 풍선'이라, 다른 테마보다 면을 또렷하게 둔다.
    slot: { fill: "#dce9f6", op: 1, ring: "#a4c4e0" },
    scene: ({ W, H, cx, slots }) => {
      const kx = cx, ky = H - 18;
      return {
        mid:
          cloud(52, 62, 30, 13, 0.9) + cloud(W - 50, 92, 24, 10, 0.75) +
          slots.map(([x, y, r]) =>
            `<path d="M${x.toFixed(1)} ${(y + r).toFixed(1)} Q ${((x + kx) / 2).toFixed(1)} ${((y + ky) / 2).toFixed(1)} ${kx} ${ky}" fill="none" stroke="#bdd2e6" stroke-width="1.4"/>`).join("") +
          `<circle cx="${kx}" cy="${ky}" r="3.5" fill="${P.skyD}"/>`,
      };
    },
  },

  rainbow: {
    area: { ax: 40, ay: 110, aw: 220, ah: 132 },
    sky: ["#f0f8fd", "#eaf3fb", "#e3edf7"],
    glow: "#fff6d8",
    glowAt: [252, 46, 50],
    slot: { fill: "#ffffff", op: 0.55, ring: "#bfd6ea" },
    scene: ({ cx }) => {
      const rcy = 118;
      return {
        mid: ["#eda0a0", "#f0c791", "#ecdca2", "#abd296", "#a3c4e4"].map((c, k) => {
          const rr = 92 - k * 13;
          return `<path d="M${cx - rr} ${rcy} A${rr} ${rr} 0 0 1 ${cx + rr} ${rcy}" fill="none" stroke="${c}" stroke-width="11"/>`;
        }).join("") +
          cloud(cx - 92, rcy, 34, 15) + cloud(cx + 92, rcy, 34, 15),
      };
    },
  },
};

const ACCENT: Record<string, string> = { tree: "#4E9E45", grape: "#8E6FC0", star: "#5B8DEF", flower: "#FF7DA3", balloon: "#5C9BE0", rainbow: "#5B8DEF" };

// 성장 축소의 기준점(지면)과 가장 작을 때의 배율.
const GROUND_Y = 288;
const MIN_SCALE = 0.68;

/**
 * 테마별 칭찬판 SVG. n칸 중 filled칸을 커스텀 스티커로 채우고, 빈칸은 옅은 점선 자리로 둔다.
 *
 * @param growth 0~1. 1이면 원래 크기(칭찬판). 1보다 작으면 지면을 축으로 주인공과 칸만 축소해
 *               '자라는' 느낌을 준다 — 오늘의 나무에서만 쓴다. 하늘·지면은 줄지 않는다.
 * @param accentOverride 빈칸 테두리 색. 없으면 테마 기본색. 테마 색과 섞어 장면을 해치지 않게 쓴다.
 */
function renderBoard(theme: string, n: number, filled: number, growth = 1, accentOverride?: string): string {
  const W = 300, H = 300, cx = W / 2;
  const t = THEME[theme] || THEME.tree;
  const accent = accentOverride || ACCENT[theme] || ACCENT.tree;
  const slots = packSlots(Math.max(0, n), t.area.ax, t.area.ay, t.area.aw, t.area.ah);
  const id = uid(`${theme}|${n}|${filled}|${accent}|${growth.toFixed(3)}`);
  const sc = t.scene({ W, H, cx, area: t.area, slots, id });

  const [s0, s1, s2] = t.sky;
  const [gx, gy, gr] = t.glowAt;
  const defs =
    `<defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${s0}"/><stop offset="0.52" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>` +
    `<radialGradient id="glow-${id}"><stop offset="0" stop-color="${t.glow}" stop-opacity="0.9"/>` +
    `<stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient></defs>`;
  const back =
    `<rect width="${W}" height="${H}" rx="20" fill="url(#sky-${id})"/>` +
    `<circle cx="${gx}" cy="${gy}" r="${gr}" fill="url(#glow-${id})"/>` + (sc.back || "");

  // 빈 칸 테두리는 테마 색에 목표 색을 조금만 섞는다 — 목표마다 달라 보이되 장면과 싸우지 않게.
  const ring = mix(t.slot.ring, accent, 0.28);
  const slotSvg = slots.map(([x, y, r], i) => {
    const X = x.toFixed(1), Y = y.toFixed(1);
    if (i < filled) {
      const R = (r + 2.5).toFixed(1);
      return `<circle cx="${X}" cy="${(y + 2).toFixed(1)}" r="${R}" fill="${P.shade}" opacity="0.1"/>` +
        `<circle cx="${X}" cy="${Y}" r="${R}" fill="#fff"/>${sticker(FILL[i % FILL.length], x, y, r * 1.95)}`;
    }
    return `<circle cx="${X}" cy="${Y}" r="${r.toFixed(1)}" fill="${t.slot.fill}" opacity="${t.slot.op}"/>` +
      `<circle cx="${X}" cy="${Y}" r="${r.toFixed(1)}" fill="none" stroke="${ring}" stroke-width="1.6" stroke-dasharray="2.5 4" opacity="0.95"/>`;
  }).join("");

  // 주인공과 칸을 함께 지면 기준으로 축소한다. 함께 줄여야 스티커가 수관 밖으로 튀지 않는다.
  const g = Math.min(1, Math.max(0, growth));
  const body = (sc.mid || "") + slotSvg;
  const mid = g >= 0.999
    ? body
    : `<g transform="translate(${cx} ${GROUND_Y}) scale(${(MIN_SCALE + (1 - MIN_SCALE) * g).toFixed(3)}) translate(${-cx} ${-GROUND_Y})">${body}</g>`;

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${defs}${back}${mid}${sc.front || ""}</svg>`;
}

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
// 도장은 일러스트가 아니라 '찍힌 자국'이라 외곽선 규칙에서 뺀다 — 선이 곧 형태다.
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
