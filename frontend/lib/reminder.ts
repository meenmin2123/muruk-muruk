"use client";

import { useEffect } from "react";
import { AppState, todayStr } from "./state";

const LS_LAST_NOTIFIED = "muruk_last_notified";
export const DEFAULT_REMINDER_TIME = "21:00";

/** 알림을 띄운다. 서비스워커가 있으면 그쪽으로(백그라운드 탭에서도 동작), 없으면 일반 Notification. */
function fire(body: string) {
  const opts: NotificationOptions = { body, icon: "/icon.svg", badge: "/icon.svg", tag: "muruk-daily" };
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification("무럭무럭", opts))
      .catch(() => {
        try {
          new Notification("무럭무럭", opts);
        } catch {
          /* ignore */
        }
      });
  } else {
    try {
      new Notification("무럭무럭", opts);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 매일 정해진 시간에 '오늘 남은 할 일' 알림을 하루 1회 띄운다.
 * 앱이 열려 있거나 백그라운드 탭일 때, 또는 알림 시각 이후 다시 열었을 때 동작한다.
 * (완전 종료 상태의 푸시는 별도 Web Push 인프라가 필요 — 여기선 다루지 않음)
 */
export function useDailyReminder(state: AppState | null) {
  useEffect(() => {
    if (!state) return;
    if (typeof Notification === "undefined") return;

    const check = () => {
      const s = state.settings || {};
      if (!s.reminderEnabled) return;
      if (Notification.permission !== "granted") return;

      const time = (s.reminderTime as string) || DEFAULT_REMINDER_TIME;
      const [hh, mm] = time.split(":").map(Number);
      const now = new Date();
      const due = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
      if (!due) return;

      const today = todayStr();
      if (localStorage.getItem(LS_LAST_NOTIFIED) === today) return;

      const incomplete = state.todos.filter((t) => t.date === today && !t.done).length;
      if (incomplete === 0) return; // 남은 할 일이 없으면 알리지 않음

      localStorage.setItem(LS_LAST_NOTIFIED, today);
      fire(`오늘 할 일 ${incomplete}개가 기다리고 있어요 🌿`);
    };

    check();
    const iv = setInterval(check, 60000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [state]);
}
