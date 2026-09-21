"use client";

import type { MurukUser } from "./types";

const TOKEN_KEY = "muruk_id_token";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** 구글 클라이언트 ID가 실제 값으로 채워져 있는가(플레이스홀더 아님). */
export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("여기에");
}

// 관리자 이메일(개발용). 서버도 ADMIN_EMAILS로 별도 검증하므로 여기는 UI 노출용.
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "min1016alsrud@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

interface JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  exp: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(base))));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * 토큰 저장소
 * ------------------------------------------------------------------ */

/** 만료 여부와 무관한 원본 토큰. 신원(sub) 확인·로컬 캐시 키 계산에 쓴다. */
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* 사생활 보호 모드 등 — 무시 */
  }
  emit(tokenListeners, token);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** 토큰 만료 시각(ms). 토큰이 없거나 해독 불가면 null. */
export function tokenExpiresAt(): number | null {
  const t = getStoredToken();
  const p = t ? decodeJwt(t) : null;
  return p ? p.exp * 1000 : null;
}

/** marginMs 뒤까지 유효한가. */
export function isTokenFresh(marginMs = 5000): boolean {
  const exp = tokenExpiresAt();
  return exp !== null && exp > Date.now() + marginMs;
}

/**
 * 유효한 토큰만 반환(만료면 null).
 *
 * 주의: 예전에는 여기서 만료 토큰을 지웠다. 그러면 getUser()가 null이 되어
 * 로컬 캐시 키까지 사라지고, 만료 이후 편집이 캐시에도 남지 않아 통째로 유실됐다.
 * 지금은 지우지 않는다 — 신원은 getIdentity()로 계속 알 수 있다.
 */
export function getToken(): string | null {
  return isTokenFresh() ? getStoredToken() : null;
}

function toUser(p: JwtPayload): MurukUser {
  return {
    id: p.sub,
    email: p.email ?? "",
    name: p.name ?? p.email ?? "사용자",
    picture: p.picture ?? null,
  };
}

/**
 * 만료된 토큰이어도 신원을 돌려준다.
 * 토큰이 만료된 동안에도 로컬 캐시를 '그 사용자 것'으로 계속 읽고 쓰기 위한 용도.
 * 인증 판단에는 절대 쓰지 말 것(서버는 별도로 서명을 검증한다).
 */
export function getIdentity(): MurukUser | null {
  const t = getStoredToken();
  const p = t ? decodeJwt(t) : null;
  return p ? toUser(p) : null;
}

/** 유효한 토큰이 있을 때의 사용자. 로그인 상태 표시용. */
export function getUser(): MurukUser | null {
  const t = getToken();
  const p = t ? decodeJwt(t) : null;
  return p ? toUser(p) : null;
}

/* ------------------------------------------------------------------ *
 * 이벤트 — 토큰 갱신 성공 / 재로그인 필요
 * ------------------------------------------------------------------ */

type Listener<T> = (v: T) => void;
const tokenListeners = new Set<Listener<string>>();
const expiredListeners = new Set<Listener<void>>();

function emit<T>(set: Set<Listener<T>>, v: T) {
  set.forEach((fn) => {
    try {
      fn(v);
    } catch {
      /* 구독자 오류가 다른 구독자를 막지 않게 */
    }
  });
}

/** 새 토큰이 저장될 때(로그인·무음 갱신) 알림. 해제 함수를 반환. */
export function onTokenSaved(cb: Listener<string>): () => void {
  tokenListeners.add(cb);
  return () => tokenListeners.delete(cb);
}

/** 갱신에 실패해 재로그인이 필요할 때 알림. 해제 함수를 반환. */
export function onAuthExpired(cb: Listener<void>): () => void {
  expiredListeners.add(cb);
  return () => expiredListeners.delete(cb);
}

export function emitAuthExpired() {
  emit(expiredListeners, undefined);
}

/* ------------------------------------------------------------------ *
 * 무음 토큰 갱신
 * ------------------------------------------------------------------ */

let pendingRefresh: Promise<string | null> | null = null;

/**
 * 구글 세션이 살아 있으면 클릭 없이 새 ID 토큰을 받아온다.
 *
 * GIS는 리프레시 토큰을 주지 않으므로, auto_select 로 One Tap 을 무음 실행하는 것이
 * 유일한 갱신 수단이다. 실패하면 null — 호출부는 재로그인을 유도해야 하며,
 * 절대 '조용히 저장 실패' 상태로 두면 안 된다.
 */
export function refreshToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = doRefresh();
  void pendingRefresh.then(
    () => {
      pendingRefresh = null;
    },
    () => {
      pendingRefresh = null;
    },
  );
  return pendingRefresh;
}

function doRefresh(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    if (typeof window === "undefined" || !isGoogleConfigured()) return resolve(null);

    let settled = false;
    const finish = (t: string | null) => {
      if (settled) return;
      settled = true;
      resolve(t);
    };
    // One Tap이 뜨지 않거나 사용자가 무시하면 콜백이 영영 오지 않는다 → 반드시 타임아웃.
    const timer = setTimeout(() => finish(null), 8000);

    whenGoogleReady(() => {
      if (settled) return;
      try {
        const g = window.google!;
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: true,
          callback: (resp) => {
            clearTimeout(timer);
            if (resp?.credential) {
              saveToken(resp.credential);
              finish(resp.credential);
            } else {
              finish(null);
            }
          },
        });
        g.accounts.id.prompt();
      } catch {
        clearTimeout(timer);
        finish(null);
      }
    });
  });
}

/**
 * 요청 직전에 쓸 유효한 토큰을 확보한다.
 * 만료가 임박했으면(기본 60초) 미리 갱신해, 요청 도중 만료되는 일을 줄인다.
 */
export async function ensureToken(marginMs = 60_000): Promise<string | null> {
  if (isTokenFresh(marginMs)) return getStoredToken();
  const refreshed = await refreshToken();
  if (refreshed) return refreshed;
  return isTokenFresh() ? getStoredToken() : null;
}

/** 로그아웃 — 토큰을 지우고 구글 자동 재선택도 꺼서 즉시 재로그인되는 것을 막는다. */
export function signOut() {
  clearToken();
  try {
    window.google?.accounts.id.disableAutoSelect();
    window.google?.accounts.id.cancel?.();
  } catch {
    /* GIS 미로드 — 무시 */
  }
}

// Google Identity Services 타입 (필요한 부분만)
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
          // 로그아웃 시 자동 재선택을 끄려면 이 둘이 타입에 있어야 한다.
          disableAutoSelect: () => void;
          cancel?: () => void;
        };
      };
    };
  }
}

/** GIS 스크립트가 준비되면 콜백 실행 */
export function whenGoogleReady(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.google?.accounts?.id) {
    cb();
    return;
  }
  let n = 0;
  const iv = setInterval(() => {
    if (window.google?.accounts?.id) {
      clearInterval(iv);
      cb();
    } else if (++n > 50) {
      clearInterval(iv);
    }
  }, 100);
}
