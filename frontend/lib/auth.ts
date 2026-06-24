"use client";

import type { MurukUser } from "./types";

const TOKEN_KEY = "muruk_id_token";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

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

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) return null;
  const p = decodeJwt(t);
  if (!p || p.exp * 1000 < Date.now() + 5000) {
    clearToken();
    return null;
  }
  return t;
}

export function getUser(): MurukUser | null {
  const t = getToken();
  if (!t) return null;
  const p = decodeJwt(t);
  if (!p) return null;
  return {
    id: p.sub,
    email: p.email ?? "",
    name: p.name ?? p.email ?? "사용자",
    picture: p.picture ?? null,
  };
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
