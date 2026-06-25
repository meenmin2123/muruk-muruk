"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, saveToken, whenGoogleReady } from "@/lib/auth";
import { treeSVG } from "@/lib/trees";

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
    <div className="login">
      <div className="login-hero">
        <span className="float f1" aria-hidden>⭐</span>
        <span className="float f2" aria-hidden>🌸</span>
        <span className="float f3" aria-hidden>🍀</span>
        <span className="float f4" aria-hidden>💖</span>
        <div className="login-tree" dangerouslySetInnerHTML={{ __html: treeSVG({ stickers: ["⭐", "🌟", "💖", "🌸", "🍀", "🐣"] }) }} />
      </div>

      <h1 className="login-title">
        무럭무럭<span style={{ color: "var(--primary)" }}>.</span>
      </h1>

      <div className="login-features" style={{ marginTop: 14 }}>
        <span>🌱 작은 목표</span>
        <span>✅ 매일 체크</span>
        <span>🌳 자라는 나무</span>
      </div>

      <div ref={btnRef} className="login-btn" />

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
