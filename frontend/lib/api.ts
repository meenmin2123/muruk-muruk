"use client";

import { emitAuthExpired, ensureToken, getStoredToken, refreshToken } from "./auth";
import { rand } from "./state";
import type { AppState } from "./state";
import type { AdminUserState, CoachKind, MurukUser } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export const ERR_UNAUTHORIZED = "UNAUTHORIZED";
export const ERR_CONFLICT = "CONFLICT";

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

/**
 * 인증이 필요한 API 호출.
 *
 * 토큰 수명주기를 여기서 한 곳에 모아 처리한다:
 *  1) 보내기 전에 만료가 임박했으면 미리 무음 갱신
 *  2) 그래도 401 이면 한 번 더 갱신하고 재시도
 *  3) 끝내 실패하면 재로그인 이벤트를 쏘고 UNAUTHORIZED 로 던진다
 *     (이 신호가 없으면 저장이 조용히 멈춰 사용자가 편집을 잃는다)
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await ensureToken();
  let res = await send(path, init, token);

  if (res.status === 401) {
    const fresh = await refreshToken();
    if (fresh) {
      res = await send(path, init, fresh);
    }
    if (res.status === 401) {
      emitAuthExpired();
      throw new Error(ERR_UNAUTHORIZED);
    }
  }

  if (res.status === 409) throw new Error(ERR_CONFLICT);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

export interface StateEnvelope {
  data: unknown;
  version: number;
  updatedAt: string | null;
}

export const api = {
  me: () => request<MurukUser>("/api/me"),
  pullState: () => request<StateEnvelope>("/api/state"),
  pushState: (state: AppState, baseVersion: number) =>
    request<{ ok: boolean; version: number; updatedAt: string }>("/api/state", {
      method: "PUT",
      body: JSON.stringify({ data: state, baseVersion }),
    }),
  coach: (kind: CoachKind, context: string) =>
    request<{ message: string }>("/api/coach", {
      method: "POST",
      body: JSON.stringify({ kind, context }),
    }),
  adminStates: () => request<AdminUserState[]>("/api/admin/states"),
};

/**
 * 페이지가 사라지기 직전(탭 닫기·SW 강제 새로고침 등)에 최신 상태를 보낸다.
 * keepalive:true 라 언로드 후에도 요청이 살아남아 미저장 편집 유실을 막는다.
 *
 * 언로드 중에는 await 할 시간이 없어 토큰 갱신을 하지 못한다.
 * 그래서 실패해도 괜찮도록, 호출부는 로컬 캐시에 '아직 못 올림(pending)' 표시를 남겨
 * 다음 접속 때 서버 상태와 병합하도록 되어 있다.
 */
export function flushState(state: AppState, baseVersion: number): void {
  const token = getStoredToken();
  try {
    fetch(`${API_BASE}/api/state`, {
      method: "PUT",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ data: state, baseVersion }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * AI 코칭 응답이 '진짜 코칭'이 아니라 에러/비정상으로 보이면 true.
 * (키 미설정·서버 에러·HTML·과도하게 긴 덤프 등 — 사용자에게 그대로 노출되면 안 됨)
 */
export function looksLikeError(m: string | null | undefined): boolean {
  const s = (m ?? "").trim();
  if (!s || s.length > 400) return true;
  return /anthropic|api[_ ]?key|unauthorized|forbidden|rate.?limit|\b[45]\d\d\b|<html|error|exception|timeout/i.test(s);
}

/** 코칭 메시지를 받아오되, 실패·비정상이면 하드코딩 폴백을 반환(절대 throw 안 함). */
export async function coachMessage(kind: CoachKind, context: string, fallback: string[]): Promise<string> {
  try {
    const { message } = await api.coach(kind, context);
    return looksLikeError(message) ? rand(fallback) : message.trim();
  } catch {
    return rand(fallback);
  }
}
