"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { LoginGate } from "@/components/LoginGate";
import { getToken } from "@/lib/auth";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  if (loggedIn === null) return null; // 첫 렌더 깜빡임 방지

  return loggedIn ? (
    <Dashboard onLogout={() => setLoggedIn(false)} />
  ) : (
    <LoginGate onLogin={() => setLoggedIn(true)} />
  );
}
