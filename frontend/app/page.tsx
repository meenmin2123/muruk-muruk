"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { LoginGate } from "@/components/LoginGate";
import { SplashScreen } from "@/components/SplashScreen";
import { GOOGLE_CLIENT_ID, getToken, saveToken, whenGoogleReady } from "@/lib/auth";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // 이미 유효한 토큰이 있으면 바로 로그인 상태(로그인 유지).
    if (getToken()) {
      setLoggedIn(true);
      const t = setTimeout(() => setBooting(false), 1500);
      return () => clearTimeout(t);
    }

    // 토큰이 없으면 스플래시 동안 무음 자동 로그인 시도
    // (구글 세션이 살아있고 이전에 동의했다면 클릭 없이 자동 로그인 → 로그인 유지 효과).
    let settled = false;
    const configured = GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("여기에");
    if (configured) {
      whenGoogleReady(() => {
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: true,
          callback: (resp) => {
            saveToken(resp.credential);
            settled = true;
            setLoggedIn(true);
            setBooting(false);
          },
        });
        window.google!.accounts.id.prompt();
      });
    }

    // 일정 시간 뒤에도 자동 로그인이 안 되면 로그인 화면 노출.
    const t = setTimeout(() => {
      if (!settled) {
        setLoggedIn(false);
        setBooting(false);
      }
    }, 1900);
    return () => clearTimeout(t);
  }, []);

  if (booting || loggedIn === null) return <SplashScreen />;

  return loggedIn ? (
    <Dashboard onLogout={() => setLoggedIn(false)} />
  ) : (
    <LoginGate onLogin={() => setLoggedIn(true)} />
  );
}
