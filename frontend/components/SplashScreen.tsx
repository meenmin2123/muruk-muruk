"use client";

import { stampSVG } from "@/lib/trees";

/** 앱을 처음 열면 보이는 로딩 스플래시 — '참 잘했어요' 도장이 찍히는 화면. */
export function SplashScreen() {
  return (
    <div className="splash">
      <div className="stamp-hero" aria-hidden dangerouslySetInnerHTML={{ __html: stampSVG(150) }} />
      <div className="splash-logo">
        무럭무럭<span style={{ color: "#eafaec" }}>.</span>
      </div>
      <div className="splash-hint">잠시만요…</div>
    </div>
  );
}
