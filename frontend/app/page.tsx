"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { LoginGate } from "@/components/LoginGate";
import { SplashScreen } from "@/components/SplashScreen";
import {
  GOOGLE_CLIENT_ID,
  getToken,
  isGoogleConfigured,
  onAuthExpired,
  onTokenSaved,
  saveToken,
  whenGoogleReady,
} from "@/lib/auth";

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
    const configured = isGoogleConfigured();
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

  // 토큰이 만료됐고 무음 갱신도 실패 → 로그인 화면으로 되돌린다.
  // 이 신호가 없으면 저장이 조용히 멈춘 채 사용자는 계속 편집하다 변경을 잃는다.
  // (편집분은 로컬 캐시에 pending으로 남아, 다시 로그인하면 서버본과 병합된다.)
  useEffect(() => {
    const offExpired = onAuthExpired(() => {
      // 토큰을 지우지는 않는다 — 만료된 토큰이라도 남아 있어야 신원(sub)을 알 수 있고,
      // 그래야 아직 못 올린 편집을 그 사용자의 로컬 캐시에 계속 남길 수 있다.
      setLoggedIn(false);
      setBooting(false);
    });
    // 무음 갱신이 뒤늦게 성공하면 다시 들여보낸다.
    const offSaved = onTokenSaved(() => {
      setLoggedIn(true);
      setBooting(false);
    });
    return () => {
      offExpired();
      offSaved();
    };
  }, []);

  if (booting || loggedIn === null) return <SplashScreen />;

  return loggedIn ? (
    <Dashboard onLogout={() => setLoggedIn(false)} />
  ) : (
    <LoginGate onLogin={() => setLoggedIn(true)} />
  );
}
