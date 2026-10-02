"use client";

// 아이폰 앱(Capacitor)에서의 구글 로그인.
//
// 왜 웹과 다른 길을 가는가
//   앱은 WKWebView 안에서 돈다. 구글은 '내장 웹뷰'에서의 OAuth 를 막는다
//   (disallowed_useragent). 게다가 Capacitor 의 출처는 capacitor://localhost 라
//   구글 콘솔에 등록할 수도 없어서, 웹에서 쓰는 Google Identity Services 는
//   앱에서 동작하지 않는다.
//
// 그래서 쓰는 방식 — 시스템 브라우저 + 인가 코드 + PKCE
//   SFSafariViewController(@capacitor/browser)로 구글 로그인 페이지를 연다.
//   이건 내장 웹뷰가 아니라서 구글이 허용한다. 로그인이 끝나면 구글이
//   '역순 클라이언트 ID' 커스텀 스킴으로 앱에 돌아오고(@capacitor/app 이 받는다),
//   받은 코드를 PKCE 검증자와 함께 토큰으로 바꾼다.
//
//   암묵적 흐름(response_type=id_token)은 쓰지 않는다 — 폐기됐다.
//   코드+PKCE 가 현재 네이티브 앱에 요구되는 방식이다.
//
// iOS 클라이언트는 공개 클라이언트라 client_secret 이 없다. 그래서 코드 교환을
// 앱에서 직접 해도 숨길 비밀이 없다.
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { sha256 } from "./sha256";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** 리프레시 토큰 보관함. 앱의 WKWebView 저장소는 앱 샌드박스 안이라 다른 앱이 못 읽는다. */
const RT_KEY = "muruk_google_refresh_token";

export const IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export function isNativeGoogleConfigured(): boolean {
  // 플레이스홀더를 '설정됨'으로 보면 로그인 버튼이 눌리는데 구글이 거부한다.
  return IOS_CLIENT_ID.endsWith(".apps.googleusercontent.com") && !IOS_CLIENT_ID.includes("여기에");
}

/**
 * 구글 iOS 클라이언트의 리다이렉트 스킴.
 *   799206979966-abc.apps.googleusercontent.com
 *     → com.googleusercontent.apps.799206979966-abc
 * 이 값을 Xcode 의 Info.plist(CFBundleURLSchemes)에도 똑같이 넣어야 한다.
 */
export function reversedClientId(clientId = IOS_CLIENT_ID): string {
  return `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, "")}`;
}
const redirectUri = () => `${reversedClientId()}:/oauth2redirect`;

/* ------------------------------------------------------------------ *
 * PKCE
 * ------------------------------------------------------------------ */

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomUrlSafe(byteLen: number): string {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return b64url(a);
}

/**
 * PKCE code_challenge = BASE64URL(SHA256(verifier)).
 *
 * 앱의 출처(capacitor://localhost)는 보안 컨텍스트가 아니라 crypto.subtle 이 없다.
 * 그래서 실제로는 아래 직접 구현이 돈다(sha256.ts 머리말 참고). subtle 분기는
 * 언젠가 출처가 보안 컨텍스트로 인정될 때를 위한 것이다 — 결과는 어느 쪽이든 같다.
 */
async function challengeOf(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (subtle) {
    try {
      return b64url(new Uint8Array(await subtle.digest("SHA-256", bytes)));
    } catch {
      /* 아래 직접 구현으로 */
    }
  }
  return b64url(sha256(bytes));
}

/* ------------------------------------------------------------------ *
 * 로그인
 * ------------------------------------------------------------------ */

/**
 * 돌아온 리다이렉트 URL 에서 코드를 꺼낸다.
 *
 * state 는 반드시 대조한다 — 맞춰보지 않으면 다른 곳에서 날아온 리다이렉트를
 * 그대로 코드 교환에 넣게 된다. 사용자가 로그인 창을 닫으면 콜백이 영영 오지
 * 않으므로 타임아웃도 둔다.
 */
function waitForRedirect(expectedState: string, timeoutMs = 180_000): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (code: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (graceTimer !== undefined) clearTimeout(graceTimer);
      void sub.then((h) => h.remove());
      void closed.then((h) => h.remove());
      void Browser.close().catch(() => {});
      resolve(code);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    // 사용자가 로그인 창을 쓸어 닫으면 리다이렉트가 영영 안 온다. 그대로 두면
    // 버튼이 몇 분이고 '여는 중…' 에 묶인다.
    // 다만 로그인에 성공해도 iOS 가 창을 먼저 닫고 appUrlOpen 이 뒤따라오는 경우가
    // 있어서, 닫혔다고 바로 실패로 보지 않고 잠깐 기다렸다가 판단한다.
    const closed = Browser.addListener("browserFinished", () => {
      if (done || graceTimer !== undefined) return;
      graceTimer = setTimeout(() => finish(null), 1500);
    });

    const sub = App.addListener("appUrlOpen", ({ url }) => {
      if (!url || !url.startsWith(reversedClientId() + ":")) return;
      // 커스텀 스킴은 URL 파서가 쿼리를 제대로 안 떼는 경우가 있어 직접 자른다.
      const qi = url.indexOf("?");
      if (qi < 0) return finish(null);
      const q = new URLSearchParams(url.slice(qi + 1));
      if (q.get("state") !== expectedState) return; // 내 요청이 아니다 — 무시하고 계속 기다린다
      // 사용자가 거부하면 code 없이 error 만 온다 → null 로 끝내고 다시 누르게 한다.
      finish(q.get("code"));
    });
  });
}

/** 토큰 응답에서 id_token 을 꺼내고, 리프레시 토큰이 왔으면 보관한다. */
async function readTokens(res: Response): Promise<string | null> {
  if (!res.ok) return null;
  const j = (await res.json()) as { id_token?: string; refresh_token?: string };
  if (j.refresh_token) {
    try {
      localStorage.setItem(RT_KEY, j.refresh_token);
    } catch {
      /* 저장 실패해도 이번 로그인은 유효하다 */
    }
  }
  return j.id_token ?? null;
}

/** 사용자가 버튼을 눌렀을 때. 시스템 브라우저를 띄우므로 자동으로 부르면 안 된다. */
export async function signInNative(): Promise<string | null> {
  if (!isNativeGoogleConfigured()) return null;
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(16);
  const params = new URLSearchParams({
    client_id: IOS_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    // openid 가 있어야 id_token 이 온다. 백엔드가 검증하는 게 그 토큰이다.
    scope: "openid email profile",
    code_challenge: await challengeOf(verifier),
    code_challenge_method: "S256",
    state,
    prompt: "select_account",
  });

  // 리스너를 먼저 걸고 브라우저를 연다. 순서가 바뀌면 빠른 리다이렉트를 놓친다.
  const codePromise = waitForRedirect(state);
  await Browser.open({ url: `${AUTH_URL}?${params}` });
  const code = await codePromise;
  if (!code) return null;

  return readTokens(
    await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: IOS_CLIENT_ID,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(),
      }),
    }),
  );
}

/**
 * 화면을 건드리지 않고 새 ID 토큰을 받는다.
 *
 * 웹(GIS)에는 리프레시 토큰이 없어 One Tap 을 무음 실행하는 게 유일한 갱신
 * 수단이었다. 네이티브는 진짜 리프레시 토큰을 받으므로 더 확실하다.
 */
export async function refreshNative(): Promise<string | null> {
  if (!isNativeGoogleConfigured()) return null;
  let rt: string | null = null;
  try {
    rt = localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
  if (!rt) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: IOS_CLIENT_ID,
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  // 400 이면 리프레시 토큰이 폐기된 것(비밀번호 변경·동의 철회 등). 지워서
  // 다음부터는 헛되이 네트워크를 쓰지 않고 바로 재로그인으로 보낸다.
  if (res.status === 400) {
    try {
      localStorage.removeItem(RT_KEY);
    } catch {
      /* 무시 */
    }
    return null;
  }
  return readTokens(res);
}

/** 로그아웃 — 구글 쪽 허가도 함께 거둬서 다음 로그인 때 계정을 다시 고르게 한다. */
export async function signOutNative(): Promise<void> {
  let rt: string | null = null;
  try {
    rt = localStorage.getItem(RT_KEY);
    localStorage.removeItem(RT_KEY);
  } catch {
    /* 무시 */
  }
  if (!rt) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: rt }),
    });
  } catch {
    /* 네트워크가 없어도 로컬 토큰은 이미 지웠다 */
  }
}
