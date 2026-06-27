// 기존 PWA(index.html)의 데이터 모델·로직을 TS로 이식.

export type Repeat = "once" | "daily";

export interface Goal {
  id: string;
  title: string;
  repeat: Repeat;
}

export interface Dream {
  id: string;
  title: string;
  emoji: string;
  cat: string;
  color: string;
  theme: string;
  targetDate: string | null;
  ddayStart?: string; // 디데이를 설정한 날(시작일)
  collapsed?: boolean;
  goals: Goal[];
  // 사용자가 직접 고른 아이콘(아이콘 이름) 또는 이모지. 없으면 카테고리 기본/emoji 사용.
  icon?: string;
  // 칭찬판은 목표(꿈) 단위 — 이 목표의 할 일을 완료할 때마다 스티커가 쌓인다.
  stickers?: string[];
  earned?: number;
  stamps?: number;
  // 칭찬판 칸 수. 디데이 있으면 날짜로 자동 설정, 없으면 사용자가 직접 지정. 없으면 BOARD(10).
  boardSize?: number;
}

/** 스티커판을 가진 대상(목표). */
export interface StickerBoard {
  stickers?: string[];
  earned?: number;
  stamps?: number;
}

export interface Todo {
  id: string;
  text: string;
  date: string;
  done: boolean;
  goalId: string | null;
}

export interface CustomCat {
  key: string;
  emoji: string;
  label: string;
  ph: string;
  dday: boolean;
  color: string;
  goals: string[];
  custom?: true;
}

export interface AppState {
  totalDone: number;
  bestStreak: number;
  dreams: Dream[];
  todos: Todo[];
  customCats: CustomCat[];
  settings: Record<string, unknown>;
  lastSeen: string | null;
}

export interface Template {
  emoji: string;
  label: string;
  ph: string;
  dday: boolean;
  ddayLabel?: string;
  color: string;
  goals: string[];
}

export const BOARD = 10;

export const TEMPLATES: Record<string, Template> = {
  travel: { emoji: "✈️", label: "여행", ph: "어디로 떠날까요? (예: 제주도)", dday: true, ddayLabel: "출발", color: "#36C5D8", goals: ["항공권/교통 예약", "숙소 예약", "일정·동선 짜기", "맛집 리스트업", "환전·결제 준비", "짐 싸기 체크"] },
  study: { emoji: "📚", label: "공부", ph: "무엇을 배울까요? (예: 영어 회화)", dday: false, color: "#5B8DEF", goals: ["강의 1개 듣기", "30분 복습", "오늘 배운 것 정리", "문제 10개 풀기", "단어 20개 외우기"] },
  cert: { emoji: "📜", label: "자격증", ph: "어떤 자격증인가요? (예: 정보처리기사)", dday: true, ddayLabel: "시험", color: "#9B7BE8", goals: ["인강 1강 듣기", "기출 1회분 풀기", "오답노트 정리", "개념 1단원 정리", "모의고사 1회"] },
  job: { emoji: "💼", label: "취업", ph: "목표를 적어요 (예: 첫 취업)", dday: true, ddayLabel: "목표일", color: "#FF9F43", goals: ["채용공고 5개 확인", "이력서 업데이트", "자소서 1개 작성", "포트폴리오 정리", "면접 예상질문 준비"] },
  career: { emoji: "🔄", label: "이직", ph: "어떤 이직인가요? (예: 더 좋은 회사로)", dday: false, color: "#7C9A5B", goals: ["이력서 최신화", "링크드인 정리", "관심 공고 탐색", "네트워킹 1명", "커리어 회고 작성"] },
  health: { emoji: "💪", label: "건강", ph: "어떤 건강 목표예요? (예: 활기차게 살기)", dday: false, color: "#3FC58A", goals: ["물 2L 마시기", "30분 걷기", "스쿼트 20개", "11시 전에 자기", "채소 챙겨 먹기"] },
  happy: { emoji: "🌷", label: "소소한 행복", ph: "어떤 행복을 챙길까요? (예: 매일 한 줌의 여유)", dday: false, color: "#FF6B8A", goals: ["좋아하는 음악 듣기", "10분 산책", "감사한 일 3가지", "일기 한 줄", "따뜻한 차 한 잔"] },
  free: { emoji: "🎯", label: "자유", ph: "이루고 싶은 무엇이든…", dday: false, color: "#46B97C", goals: [] },
};

export const CAT_ORDER = ["travel", "study", "cert", "job", "career", "health", "happy", "free"];
export const PALETTE = ["#46B97C", "#8CD06A", "#FFC233", "#3FC58A", "#36C5D8", "#5B8DEF", "#9B7BE8", "#FF6B8A", "#7C9A5B", "#FF9F43"];
export const THEMES = [
  { key: "tree", emoji: "🌳", label: "나무" },
  { key: "grape", emoji: "🍇", label: "포도" },
  { key: "star", emoji: "⭐", label: "별" },
  { key: "flower", emoji: "🌸", label: "꽃밭" },
  { key: "balloon", emoji: "🎈", label: "풍선" },
  { key: "rainbow", emoji: "🌈", label: "무지개" },
];
export const STICKERS = ["⭐", "🌟", "💖", "🌸", "🍀", "🐣", "🦋", "🌈", "🍓", "🐻", "😊", "👍", "🏵️", "🌻", "🧁", "🐥", "🎈", "💪"];
export const CHEERS = ["한 걸음 더 나아갔어요!", "오늘의 나, 멋지네요 ✨", "작은 실천이 쌓여요", "이게 바로 꾸준함이에요", "미래의 내가 고마워할 거예요", "잘하고 있어요, 정말로", "한 걸음 더 갔어요 🔥", "오늘도 해냈네요!"];
export const GREETS = ["오늘도 만나서 반가워요 ☀️", "딱 하나만 해도 성공이에요", "무리하지 말아요, 작게 시작해요", "어제의 나보다 한 걸음 더"];

// AI 코칭 실패/키 미설정 시 보여줄 하드코딩 폴백 멘트들 (랜덤).
export const ENCOURAGE_FALLBACK = [
  "오늘 하나만 해내도 충분해요. 작은 한 걸음이 쌓여요 🌿",
  "완벽하지 않아도 괜찮아요. 시작한 당신이 멋져요 ✨",
  "어제의 나보다 오늘 한 걸음. 그거면 돼요.",
  "지치면 쉬어가도 돼요. 다시 돌아오면 그게 꾸준함이에요 🤍",
  "지금 앱을 연 것도 실천이에요. 잘하고 있어요!",
  "작게, 그러나 자주. 오늘도 가볍게 시작해봐요.",
  "조급해하지 말아요. 당신의 속도가 맞아요 🌱",
];
export const SLUMP_FALLBACK = [
  "괜찮아요. 쉬어간 만큼 또 가면 돼요. 오늘은 딱 하나만 🤍",
  "멈춘 게 아니라 잠깐 숨 고른 거예요. 가장 쉬운 것부터 다시.",
  "며칠 비워도 목표는 그대로 기다려요. 5분이면 충분해요.",
  "자책은 그만, 토닥토닥. 작은 한 가지만 다시 시작해봐요 🌿",
];
export const REVIEW_FALLBACK = [
  "이번 주도 당신만의 속도로 잘 걸어왔어요. 다음 주는 딱 하나만 더 가볍게 🌿",
  "완료한 것에 집중해봐요. 작은 성취들이 분명 쌓이고 있어요 ✨",
  "꾸준함은 점수가 아니라 방향이에요. 계속 가고 있다는 게 중요해요.",
];
export const CELEBRATE_FALLBACK = [
  "해냈어요! 이 한 걸음이 다음 걸음을 더 쉽게 만들어요 🎉",
  "축하해요! 꾸준함이 모여 만든 결실이에요 ✨",
  "정말 잘했어요. 이 기쁨, 충분히 누리세요 🌟",
];

export const uid = () => Math.random().toString(36).slice(2, 9);
/** 로컬 시간대 기준 YYYY-MM-DD. (UTC인 toISOString 사용 금지 — 한국 오전 시간대 오동작) */
export const dateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const todayStr = () => dateStr(new Date());
export const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function defaultState(): AppState {
  return { totalDone: 0, bestStreak: 0, dreams: [], todos: [], customCats: [], settings: {}, lastSeen: todayStr() };
}

export function template(cat: string): Template {
  return TEMPLATES[cat] ?? TEMPLATES.free;
}

export function streakCount(s: AppState): number {
  const days = new Set(s.todos.filter((t) => t.done).map((t) => t.date));
  let count = 0;
  const d = new Date();
  if (!days.has(todayStr())) d.setDate(d.getDate() - 1);
  while (days.has(dateStr(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** 마지막으로 무언가 완료한 날로부터 며칠 지났는지. 한 번도 없으면 -1. */
export function daysSinceLastDone(s: AppState): number {
  const dates = s.todos.filter((t) => t.done).map((t) => t.date).sort();
  if (dates.length === 0) return -1;
  const last = dates[dates.length - 1];
  return Math.round((+new Date(todayStr()) - +new Date(last)) / 86400000);
}

export function totalStickers(s: AppState): number {
  let n = 0;
  s.dreams.forEach((d) => (n += d.earned ?? 0));
  return n;
}

export function findGoal(s: AppState, gid: string): { goal: Goal; dream: Dream } | null {
  for (const d of s.dreams) {
    const g = d.goals.find((x) => x.id === gid);
    if (g) return { goal: g, dream: d };
  }
  return null;
}

/** 오늘로부터 해당 날짜까지 남은 일수. */
export function daysUntil(date: string): number {
  return Math.round((+new Date(date) - +new Date(todayStr())) / 86400000);
}

/** 목표의 칭찬판 칸 수 = 그 목표의 할 일(세부목표) 개수. 할 일을 추가하면 칸이 늘어난다. 디데이는 카운트다운 표시 전용. */
export function boardCap(d: Dream): number {
  return Math.min(100, Math.max(1, d.goals.length));
}

export function ddayText(date: string | null): string | null {
  if (!date) return null;
  const diff = Math.round((+new Date(date) - +new Date(todayStr())) / 86400000);
  if (diff > 0) return "D-" + diff;
  if (diff === 0) return "D-DAY";
  return "D+" + -diff;
}

/** 할일 완료 시 목표(꿈) 칭찬판에 스티커 적립. 판(cap칸)을 채우면 도장 +1 후 true. */
export function awardSticker(b: StickerBoard, cap: number = BOARD): boolean {
  b.stickers = b.stickers ?? [];
  if (b.stickers.length >= cap) b.stickers = [];
  b.stickers.push(rand(STICKERS));
  b.earned = (b.earned ?? 0) + 1;
  if (b.stickers.length >= cap) {
    b.stamps = (b.stamps ?? 0) + 1;
    return true;
  }
  return false;
}

export function removeSticker(b: StickerBoard, cap: number = BOARD): void {
  b.stickers = b.stickers ?? [];
  if (b.stickers.length > 0) b.stickers.pop();
  else if ((b.stamps ?? 0) > 0) {
    b.stamps = (b.stamps ?? 0) - 1;
    b.stickers = Array.from({ length: Math.max(0, cap - 1) }, () => rand(STICKERS));
  }
  b.earned = Math.max(0, (b.earned ?? 0) - 1);
}

/**
 * 할일을 오늘 기준으로 정리한다.
 * - 매일(daily): 오늘 할일이 없으면 새로 생성한다. 어제 못한 건 이월되지 않는다(매일 새로 시작).
 * - 한 번(once): 아직 완료하지 않았다면 미완료 할일을 오늘로 이월(같은 할일이 날짜만 이동 → 중복 없음).
 *   완료한 적이 없고 할일도 없으면 오늘 새로 만든다.
 */
export function ensureDailyTodos(s: AppState): AppState {
  const today = todayStr();
  const todos = s.todos.map((t) => ({ ...t }));
  s.dreams.forEach((d) =>
    d.goals.forEach((g) => {
      const mine = todos.filter((t) => t.goalId === g.id);
      if (g.repeat === "daily") {
        if (!mine.some((t) => t.date === today)) {
          todos.push({ id: uid(), text: g.title, date: today, done: false, goalId: g.id });
        }
        return;
      }
      // 한 번(once): 이미 완료한 적이 있으면 그대로 둔다.
      if (mine.some((t) => t.done)) return;
      const incomplete = mine.filter((t) => !t.done).sort((a, b) => a.date.localeCompare(b.date));
      if (incomplete.length === 0) {
        // 아직 할일이 없으면 오늘 만든다.
        todos.push({ id: uid(), text: g.title, date: today, done: false, goalId: g.id });
      } else {
        // 미완료 할일 하나를 오늘로 이월(과거 날짜면 오늘로 당김). 중복은 제거.
        const keep = incomplete[0];
        if (keep.date < today) keep.date = today;
        incomplete.slice(1).forEach((dup) => {
          const idx = todos.indexOf(dup);
          if (idx >= 0) todos.splice(idx, 1);
        });
      }
    }),
  );
  return { ...s, todos };
}
