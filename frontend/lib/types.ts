export interface MurukUser {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  isAdmin?: boolean;
}

/** 관리자 전체 데이터 조회 결과의 사용자 1명. */
export interface AdminUserState {
  userId: string;
  email: string;
  name: string;
  picture?: string | null;
  lastSeenAt: string | null;
  updatedAt: string | null;
  version: number;
  data: AppState | null;
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

export type CoachKind = "encourage" | "weeklyReview" | "slumpCare" | "suggestTasks" | "celebrate";
