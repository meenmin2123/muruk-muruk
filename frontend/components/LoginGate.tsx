"use client";

import { useEffect, useRef } from "react";
import { isGoogleConfigured, onTokenSaved, promptGoogle, renderGoogleButton } from "@/lib/auth";
import { stickerSVG, treeSVG } from "@/lib/trees";
import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";

export function LoginGate({ onLogin }: { onLogin: () => void }) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    if (btnRef.current) renderGoogleButton(btnRef.current);
    // One Tap 도 한 번 띄워 본다. 부팅 때 띄운 게 아직 떠 있으면 내부에서 건너뛴다
    // (겹쳐 띄우면 FedCM 이 NotAllowedError 로 거절한다).
    promptGoogle();
    // 토큰 저장은 auth 모듈의 공용 콜백이 한다. 여기서는 저장 신호만 듣는다.
    return onTokenSaved(() => onLogin());
  }, [onLogin]);

  const configured = isGoogleConfigured();

  return (
    <div className="login">
      <div className="login-hero">
        {/* 장식도 칭찬판과 같은 스티커로 — 이모지는 질감이 달라 일러스트와 겉돌았다. */}
        <span className="float f1" aria-hidden dangerouslySetInnerHTML={{ __html: stickerSVG("star", 32) }} />
        <span className="float f2" aria-hidden dangerouslySetInnerHTML={{ __html: stickerSVG("clover", 28) }} />
        <span className="float f3" aria-hidden dangerouslySetInnerHTML={{ __html: stickerSVG("heart", 26) }} />
        <span className="float f4" aria-hidden dangerouslySetInnerHTML={{ __html: stickerSVG("strawberry", 30) }} />
        <div className="login-tree" dangerouslySetInnerHTML={{ __html: treeSVG({ stickers: ["⭐", "🌟", "💖", "🌸", "🍀", "🐣"] }, 6) }} />
      </div>

      <h1 className="login-title" style={{ display: "flex", justifyContent: "center" }}>
        <Wordmark height={44} color="#283330" />
      </h1>

      <div className="login-features" style={{ marginTop: "var(--sp-6)" }}>
        <span><Icon name="goal" size={15} color="var(--primary-d)" /> 작은 목표</span>
        <span><Icon name="check" size={15} color="var(--primary-d)" /> 매일 체크</span>
        <span><Icon name="sprout" size={15} color="var(--primary-d)" /> 자라는 나무</span>
      </div>

      <div ref={btnRef} className="login-btn" />

      {!configured && (
        <p className="muted" style={{ marginTop: "var(--sp-7)" }}>
          개발용: <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> 를 설정하면
          <br />
          구글 로그인 버튼이 나타나요.
        </p>
      )}
    </div>
  );
}
