"use client";

import { getToken } from "./auth";
import type { AppState } from "./state";
import type { AdminUserState, CoachKind, MurukUser } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status === 409) throw new Error("CONFLICT");
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
