"use client";

import { Capacitor } from "@capacitor/core";
import { isNativeGoogleConfigured, refreshNative, signInNative, signOutNative } from "./auth-native";
import type { MurukUser } from "./types";

const TOKEN_KEY = "muruk_id_token";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * 아이폰/안드로이드 앱 안인가.
 *
 * 앱에서는 구글 로그인 경로가 통째로 다르다 — 웹의 Google Identity Services 는
 * 내장 웹뷰에서 구글이 막기 때문이다(자세한 건 auth-native.ts 머리말).
 * 이 모듈의 공개 함수들은 겉보기 이름을 유지한 채 안에서 갈라진다.
 */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** 구글 클라이언트 ID가 실제 값으로 채워져 있는가(플레이스홀더 아님). */
export function isGoogleConfigured(): boolean {
  if (isNativeApp()) return isNativeGoogleConfigured();
  return !!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("여기에");
}

/**
 * 사용자가 로그인 버튼을 눌렀을 때. 앱에서는 시스템 브라우저가 떠서
 * 화면을 가리므로, 반드시 사용자의 행동에서만 불러야 한다.
 * 웹에서는 GIS 버튼이 자체 처리하므로 호출할 일이 없다.
 */
export async function startSignIn(): Promise<boolean> {
  if (!isNativeApp()) {
    promptGoogle();
    return false;
  }
  const token = await signInNative();
  if (token) saveToken(token);
  return !!token;
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

/* ------------------------------------------------------------------ *
 * GIS 단일 진입점
 *
 * initialize() 와 prompt() 는 반드시 여기를 거친다.
 * 예전에는 app/page.tsx · lib/auth.ts · components/LoginGate.tsx 세 곳에서
 * 각자 initialize() + prompt() 를 불렀고, 그 결과:
 *   - GIS 경고: "google.accounts.id.initialize() is called multiple times.
 *     ... only the last initialized instance will be used" — 먼저 등록한 콜백이 죽는다
 *   - FedCM 거절: "Only one navigator.credentials.get request may be outstanding
 *     at one time" — prompt() 가 겹치면 뒤엣것이 NotAllowedError 로 떨어진다
 * 둘 다 무음 토큰 갱신을 실패시킨다. 갱신이 실패하면 저장이 조용히 멈추고,
 * 사용자는 그걸 모른 채 계속 편집하다 변경을 잃는다 — 막으려던 바로 그 경로다.
 * ------------------------------------------------------------------ */

let gisInitialized = false;
/** 지금 prompt() 결과를 기다리는 쪽. 공용 콜백이 여기로 전달한다. */
let credentialWaiter: ((cred: string | null) => void) | null = null;
/** One Tap 이 떠 있는 동안 true. 겹쳐 띄우지 않기 위한 표시. */
let promptOutstanding = false;

/** initialize() 는 페이지당 한 번만. 성공하면 true. */
function initGis(): boolean {
  const g = typeof window === "undefined" ? undefined : window.google;
  if (!g?.accounts?.id) return false;
  if (gisInitialized) return true;
  g.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    auto_select: true,
    // 콜백은 하나뿐이다. 토큰은 항상 저장하고(onTokenSaved 로 화면에 전파된다),
    // 기다리는 쪽이 있으면 거기에도 넘긴다.
    callback: (resp) => {
      promptOutstanding = false;
      const cred = resp?.credential ?? null;
      if (cred) saveToken(cred);
      const waiter = credentialWaiter;
      credentialWaiter = null;
      waiter?.(cred);
    },
  });
  gisInitialized = true;
  return true;
}

/** GIS 스크립트가 준비되면 초기화하고 cb(성공여부) 를 부른다. */
export function withGoogle(cb: (ok: boolean) => void) {
  if (typeof window === "undefined" || !isGoogleConfigured()) {
    cb(false);
    return;
  }
  // 앱에는 GIS 스크립트가 없다. 기다리면 영영 안 온다.
  if (isNativeApp()) {
    cb(true);
    return;
  }
  whenGoogleReady(() => cb(initGis()));
}

/**
 * One Tap 요청. 이미 떠 있으면 건너뛴다 — 겹치면 FedCM 이 거절한다.
 *
 * 앱에서는 아무 일도 하지 않는다. 이 함수는 부팅·화면 진입에서 자동으로 불리는데,
 * 앱에서 자동으로 시스템 브라우저를 띄우면 사용자가 아무것도 안 했는데 구글
 * 로그인 페이지가 덮친다. 앱의 로그인은 startSignIn() 으로만 시작한다.
 */
export function promptGoogle() {
  if (isNativeApp()) return;
  withGoogle((ok) => {
    if (!ok || promptOutstanding) return;
    promptOutstanding = true;
    try {
      window.google!.accounts.id.prompt();
    } catch {
      promptOutstanding = false;
    }
  });
}

/** 떠 있는 One Tap 을 닫는다. 닫지 않으면 다음 prompt() 가 FedCM 에 막힌다. */
function cancelPrompt() {
  if (!promptOutstanding) return;
  promptOutstanding = false;
  try {
    window.google?.accounts.id.cancel?.();
  } catch {
    /* GIS 미로드 — 무시 */
  }
}

/** 구글 로그인 버튼을 그린다. 초기화는 내부에서 보장한다. */
export function renderGoogleButton(el: HTMLElement) {
  if (isNativeApp()) return; // 앱은 자체 버튼을 쓴다(LoginGate)
  withGoogle((ok) => {
    if (!ok) return;
    window.google!.accounts.id.renderButton(el, {
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 280,
    });
  });
}

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
  // 앱에는 리프레시 토큰이 있다 — One Tap 을 무음으로 띄우는 웹의 우회보다 확실하다.
  if (isNativeApp()) {
    return refreshNative().then((t) => {
      if (t) saveToken(t);
      return t;
    });
  }
  return new Promise<string | null>((resolve) => {
    if (typeof window === "undefined" || !isGoogleConfigured()) return resolve(null);

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waiter = (cred: string | null) => finish(cred);
    const finish = (t: string | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (credentialWaiter === waiter) credentialWaiter = null;
      resolve(t);
    };

    // One Tap 이 뜨지 않거나 사용자가 무시하면 콜백이 영영 오지 않는다 → 반드시 타임아웃.
    // 이때 cancel() 로 떠 있는 요청을 닫아야 한다 — 그대로 두면 다음 prompt() 가
    // "Only one navigator.credentials.get request may be outstanding" 으로 거절된다.
    timer = setTimeout(() => {
      cancelPrompt();
      finish(null);
    }, 8000);

    withGoogle((ok) => {
      if (settled) return;
      if (!ok) return finish(null);
      credentialWaiter = waiter;
      promptGoogle();
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
  if (isNativeApp()) {
    void signOutNative();
    return;
  }
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
