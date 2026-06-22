export interface MurukUser {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
}

/** 기존 PWA와 호환되는 앱 상태 형태 (백엔드는 이 JSON을 그대로 저장/반환). */
export interface AppState {
  totalDone?: number;
  bestStreak?: number;
  dreams?: unknown[];
  todos?: unknown[];
  customCats?: unknown[];
  settings?: Record<string, unknown>;
  lastSeen?: string | null;
  [key: string]: unknown;
}

export type CoachKind = "encourage" | "weeklyReview" | "slumpCare" | "suggestTasks";
