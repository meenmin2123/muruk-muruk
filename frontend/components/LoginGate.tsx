"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, saveToken, whenGoogleReady } from "@/lib/auth";

export function LoginGate({ onLogin }: { onLogin: () => void }) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("여기에")) return;
    whenGoogleReady(() => {
      const g = window.google!;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: true,
        callback: (resp) => {
          saveToken(resp.credential);
          onLogin();
        },
      });
      if (btnRef.current) {
        g.accounts.id.renderButton(btnRef.current, {
          theme: "filled_blue",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 280,
        });
      }
      g.accounts.id.prompt();
    });
  }, [onLogin]);

  const configured = GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("여기에");

  return (
    <div className="wrap" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>
        무럽무럽<span style={{ color: "var(--primary)" }}>.</span>
      </h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        작심삼일도, 꾸준히 하면 됩니다 🌿
      </p>
      <p style={{ marginBottom: 24 }}>
        로그인하면 목표·기록이 내 계정에 저장돼
        <br />
        어느 기기에서든 이어서 쓸 수 있어요.
      </p>
      <div ref={btnRef} style={{ display: "flex", justifyContent: "center" }} />
      {!configured && (
        <p className="muted" style={{ marginTop: 20 }}>
          개발용: <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> 를 설정하면
          <br />
          구글 로그인 버튼이 나타나요.
        </p>
      )}
    </div>
  );
}
