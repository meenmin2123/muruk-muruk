// 칭찬판 SVG 렌더러 (index.html에서 이식). 문자열을 반환 → dangerouslySetInnerHTML로 렌더.
import type { StickerBoard } from "./state";

type Goal = StickerBoard;
const stk = (g: Goal) => g.stickers ?? [];

export function treeSVG(g: Goal): string {
  const s = stk(g);
  const slots = [[120, 72], [152, 68], [184, 72], [104, 108], [136, 106], [168, 106], [200, 108], [120, 144], [152, 148], [184, 144]];
  const fill = slots
    .map((p, i) => {
      const e = s[i];
      return `<circle cx="${p[0]}" cy="${p[1]}" r="15.5" fill="#fff" stroke="#BFE0A8" stroke-width="2"/>` + (e ? `<text x="${p[0]}" y="${p[1] + 6}" text-anchor="middle" font-size="18">${e}</text>` : "");
    })
    .join("");
  return `<svg viewBox="0 0 304 250" style="width:100%;display:block"><rect width="304" height="250" fill="#CDEAF8"/><rect x="0" y="214" width="304" height="36" fill="#A6D67E"/><ellipse cx="152" cy="214" rx="118" ry="13" fill="#93C96A"/><rect x="140" y="160" width="24" height="60" rx="10" fill="#A06E45" stroke="#6E4A2C" stroke-width="2"/><circle cx="100" cy="100" r="42" fill="#6FBF74"/><circle cx="204" cy="100" r="42" fill="#6FBF74"/><circle cx="126" cy="64" r="38" fill="#7ECB82"/><circle cx="178" cy="64" r="38" fill="#7ECB82"/><circle cx="152" cy="104" r="62" fill="#74C57A"/><circle cx="90" cy="132" r="5.5" fill="#E0463E"/><circle cx="216" cy="120" r="5.5" fill="#E0463E"/>${fill}</svg>`;
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

export function grapeSVG(g: Goal): string {
  const n = stk(g).length;
  const pos = [[104, 92], [138, 92], [172, 92], [206, 92], [121, 122], [155, 122], [189, 122], [138, 152], [172, 152], [155, 182]];
  const grapes = pos
    .map((p, i) => {
      const f = i < n;
      return `<circle cx="${p[0]}" cy="${p[1]}" r="17" fill="${f ? "#9B6FD6" : "#fff"}" stroke="${f ? "#7A4FB8" : "#DDCBEF"}" stroke-width="2"/>` + (f ? `<circle cx="${p[0] - 5}" cy="${p[1] - 6}" r="3" fill="#fff" opacity=".5"/>` : "");
    })
    .join("");
  return `<svg viewBox="0 0 304 220" style="width:100%;display:block"><rect width="304" height="220" fill="#F2ECFB"/><path d="M155,74 C150,58 150,50 158,44" fill="none" stroke="#7A5B36" stroke-width="4" stroke-linecap="round"/><ellipse cx="176" cy="50" rx="16" ry="9" fill="#6FB46F" stroke="#4E9D5E" stroke-width="2" transform="rotate(20 176 50)"/>${grapes}</svg>`;
}

export function starSVG(g: Goal): string {
  const n = stk(g).length;
  const pos = [[52, 82], [108, 82], [164, 82], [220, 82], [276, 82], [276, 166], [220, 166], [164, 166], [108, 166], [52, 166]];
  const stars = pos.map((p, i) => `<path d="${starPts(p[0], p[1], 16)}" fill="${i < n ? "#FFC83D" : "#fff"}" stroke="${i < n ? "#E0A11F" : "#E3D6C2"}" stroke-width="2" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="0 0 304 210" style="width:100%;display:block"><rect width="304" height="210" fill="#FFF7EC"/><path d="M52,82 H276 V166 H52" fill="none" stroke="#EAD9C2" stroke-width="3" stroke-dasharray="5 7" stroke-linecap="round"/>${stars}<text x="52" y="56" text-anchor="middle" font-size="11" font-weight="800" fill="#C2922E">시작</text><text x="52" y="196" text-anchor="middle" font-size="11" font-weight="800" fill="#C2922E">완성!</text></svg>`;
}

export function flowerSVG(g: Goal): string {
  const s = stk(g);
  const slots = [[104, 84], [152, 78], [200, 84], [78, 124], [127, 118], [177, 118], [226, 124], [104, 160], [152, 166], [200, 160]];
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

export function balloonSVG(g: Goal): string {
  const n = stk(g).length;
  const COL = ["#FF8FA3", "#7FB0F0", "#8FD08C", "#FFC861", "#C9A0E8", "#FF8FA3", "#7FB0F0", "#8FD08C", "#FFC861", "#C9A0E8"];
  const slots = [[104, 68], [152, 62], [200, 68], [80, 102], [128, 96], [176, 96], [224, 102], [120, 132], [184, 132], [152, 158]];
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

export function rainbowSVG(g: Goal): string {
  const n = stk(g).length;
  const COL = ["#FF6B6B", "#FF9F43", "#FFC233", "#3FC58A", "#36C5D8", "#5B8DEF", "#9B7BE8", "#FF6B8A", "#FFA94D", "#63C97A"];
  const cx = 152, cy = 206;
  let arcs = "";
  ["#FF8FA3", "#FFC861", "#8FD08C", "#7FB0F0", "#C9A0E8"].forEach((c, k) => {
    const r = 96 + k * 14;
    arcs += `<path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="${c}" stroke-width="11" opacity=".45"/>`;
  });
  const sr = 124;
  const slots: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI - (i / 9) * Math.PI;
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

/** 임의의 칸 수(cap)를 격자(도장 카드)로 그린다. 채운 칸은 적립된 스티커 이모지를 보여준다. */
export function gridBoardSVG(holder: Goal, cap: number, accent: string): string {
  const s = stk(holder);
  const n = Math.min(100, Math.max(1, Math.round(cap)));
  const cols = Math.min(7, n);
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
    const e = s[i];
    cells +=
      `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${r}" fill="#fff" stroke="${e ? accent : "#dfe9da"}" stroke-width="2.5"/>` +
      (e ? `<text x="${cx}" y="${(cy + 6).toFixed(1)}" text-anchor="middle" font-size="19">${e}</text>` : "");
  }
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;display:block"><rect width="${w}" height="${h}" rx="18" fill="#f6fbf4"/>${cells}</svg>`;
}

export function boardSVG(g: Goal, theme: string): string {
  switch (theme) {
    case "grape": return grapeSVG(g);
    case "star": return starSVG(g);
    case "flower": return flowerSVG(g);
    case "balloon": return balloonSVG(g);
    case "rainbow": return rainbowSVG(g);
    default: return treeSVG(g);
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
