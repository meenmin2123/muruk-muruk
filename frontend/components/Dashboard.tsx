"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearToken, getUser } from "@/lib/auth";
import type { AppState, MurukUser } from "@/lib/types";

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [user] = useState<MurukUser | null>(() => getUser());
  const [state, setState] = useState<AppState | null>(null);
  const [coach, setCoach] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    api
      .pullState()
      .then((s) => setState(s))
      .catch((e) => setErr(String(e.message)))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    clearToken();
    onLogout();
  }

  async function askCoach() {
    setCoach("AI 코치가 생각 중…");
    try {
      const ctx = JSON.stringify(state ?? {}).slice(0, 4000);
      const { message } = await api.coach("encourage", ctx);
      setCoach(message);
    } catch (e) {
      setCoach("코칭을 불러오지 못했어요: " + String((e as Error).message));
    }
  }

  const dreams = (state?.dreams as unknown[] | undefined)?.length ?? 0;
  const todos = (state?.todos as unknown[] | undefined)?.length ?? 0;

  return (
    <div className="wrap">
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {user?.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" width={44} height={44} style={{ borderRadius: "50%" }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{user?.name}</div>
          <div className="muted">{user?.email}</div>
        </div>
        <button className="btn" style={{ background: "#eee", color: "#555" }} onClick={logout}>
          로그아웃
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>내 데이터 (클라우드)</h2>
        {loading ? (
          <p className="muted">불러오는 중…</p>
        ) : err ? (
          <p className="muted">불러오기 실패: {err}</p>
        ) : (
          <p className="muted">
            목표 {dreams}개 · 할 일 {todos}개 — Postgres에 계정별로 저장돼 있어요.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>🤖 AI 코칭</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          내 기록을 보고 Claude가 맞춤 응원을 건네요.
        </p>
        <button className="btn" onClick={askCoach}>
          오늘의 응원 받기
        </button>
        {coach && (
          <p style={{ marginTop: 14, lineHeight: 1.6 }}>{coach}</p>
        )}
      </div>

      <p className="muted" style={{ textAlign: "center" }}>
        기초 골격 — 목표·할일 UI는 기존 PWA에서 점진 이식 예정
      </p>
    </div>
  );
}
