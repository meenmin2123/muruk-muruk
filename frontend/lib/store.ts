"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import {
  AppState,
  CHEERS,
  Dream,
  awardSticker,
  defaultState,
  ensureDailyTodos,
  findGoal,
  rand,
  removeSticker,
  streakCount,
  template,
  todayStr,
  uid,
  Repeat,
} from "./state";

function normalize(data: unknown): AppState {
  const d = (data ?? {}) as Partial<AppState>;
  const base = defaultState();
  return {
    totalDone: typeof d.totalDone === "number" ? d.totalDone : base.totalDone,
    bestStreak: typeof d.bestStreak === "number" ? d.bestStreak : base.bestStreak,
    dreams: Array.isArray(d.dreams) ? (d.dreams as Dream[]) : base.dreams,
    todos: Array.isArray(d.todos) ? d.todos : base.todos,
    customCats: Array.isArray(d.customCats) ? d.customCats : base.customCats,
    settings: d.settings && typeof d.settings === "object" ? d.settings : base.settings,
    lastSeen: d.lastSeen ?? base.lastSeen,
  };
}

export interface AppActions {
  addTodo(text: string, goalId: string): void;
  toggleTodo(id: string): void;
  removeTodo(id: string): void;
  tomorrow(id: string): void;
  addDream(d: { title: string; cat: string; color: string; theme: string }): void;
  removeDream(id: string): void;
  toggleCollapse(id: string): void;
  setDday(id: string, date: string | null): void;
  addGoal(dreamId: string, title: string, repeat: Repeat): void;
  removeGoal(dreamId: string, goalId: string): void;
  toggleGoalRepeat(dreamId: string, goalId: string): void;
  goalToToday(goalId: string): "added" | "exists";
}

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToastRaw] = useState("");
  const [gold, setGold] = useState<string | null>(null);

  const stateRef = useRef<AppState | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setToast = useCallback((msg: string) => {
    setToastRaw(msg);
    setTimeout(() => setToastRaw(""), 2200);
  }, []);

  // 최초 로드: 백엔드에서 받아오기 (없으면 기본 상태)
  useEffect(() => {
    let alive = true;
    (async () => {
      let s: AppState;
      try {
        s = normalize(await api.pullState());
      } catch {
        s = defaultState();
      }
      s = ensureDailyTodos(s);
      s.lastSeen = todayStr();
      if (!alive) return;
      loaded.current = true;
      setState(s);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 변경 시 디바운스 업로드
  useEffect(() => {
    if (!loaded.current || !state) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSyncing(true);
      try {
        await api.pushState(state);
      } catch {
        /* best-effort */
      } finally {
        setSyncing(false);
      }
    }, 1200);
  }, [state]);

  const mutate = useCallback((fn: (s: AppState) => void) => {
    const cur = stateRef.current;
    if (!cur) return;
    const next = structuredClone(cur);
    fn(next);
    const st = streakCount(next);
    if (st > next.bestStreak) next.bestStreak = st;
    setState(next);
  }, []);

  const actions: AppActions = {
    addTodo(text, goalId) {
      mutate((s) => {
        s.todos.push({ id: uid(), text, date: todayStr(), done: false, goalId });
      });
    },
    toggleTodo(id) {
      let toastMsg = "";
      let goldTitle: string | null = null;
      mutate((s) => {
        const t = s.todos.find((x) => x.id === id);
        if (!t) return;
        t.done = !t.done;
        if (t.done) {
          s.totalDone++;
          toastMsg = rand(CHEERS);
          if (t.goalId) {
            const found = findGoal(s, t.goalId);
            if (found && found.goal.repeat === "daily") {
              toastMsg = "🌟 칭찬 스티커를 받았어요!";
              if (awardSticker(found.goal)) goldTitle = found.goal.title;
            }
          }
        } else {
          s.totalDone = Math.max(0, s.totalDone - 1);
          if (t.goalId) {
            const found = findGoal(s, t.goalId);
            if (found) removeSticker(found.goal);
          }
        }
      });
      if (goldTitle) setGold(goldTitle);
      else if (toastMsg) setToast(toastMsg);
    },
    removeTodo(id) {
      mutate((s) => {
        s.todos = s.todos.filter((t) => t.id !== id);
      });
    },
    tomorrow(id) {
      mutate((s) => {
        const t = s.todos.find((x) => x.id === id);
        if (!t) return;
        const d = new Date();
        d.setDate(d.getDate() + 1);
        t.date = d.toISOString().slice(0, 10);
      });
      setToast("내일로 미뤘어요. 괜찮아요 🤍");
    },
    addDream(d) {
      const t = template(d.cat);
      mutate((s) => {
        s.dreams.push({ id: uid(), title: d.title, emoji: t.emoji, cat: d.cat, color: d.color, theme: d.theme, targetDate: null, goals: [] });
      });
      setToast(`${t.emoji} ${t.label} 목표를 세웠어요`);
    },
    removeDream(id) {
      mutate((s) => {
        s.dreams = s.dreams.filter((d) => d.id !== id);
      });
    },
    toggleCollapse(id) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (d) d.collapsed = !d.collapsed;
      });
    },
    setDday(id, date) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (d) d.targetDate = date || null;
      });
    },
    addGoal(dreamId, title, repeat) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === dreamId);
        if (!d) return;
        const g = { id: uid(), title, repeat };
        d.goals.push(g);
        if (repeat === "daily" && !s.todos.some((t) => t.goalId === g.id && t.date === todayStr())) {
          s.todos.push({ id: uid(), text: title, date: todayStr(), done: false, goalId: g.id });
        }
      });
    },
    removeGoal(dreamId, goalId) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === dreamId);
        if (d) d.goals = d.goals.filter((g) => g.id !== goalId);
      });
    },
    toggleGoalRepeat(dreamId, goalId) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === dreamId);
        const g = d?.goals.find((x) => x.id === goalId);
        if (!g) return;
        g.repeat = g.repeat === "daily" ? "once" : "daily";
        if (g.repeat === "daily" && !s.todos.some((t) => t.goalId === g.id && t.date === todayStr())) {
          s.todos.push({ id: uid(), text: g.title, date: todayStr(), done: false, goalId: g.id });
        }
      });
    },
    goalToToday(goalId) {
      const cur = stateRef.current;
      if (cur && cur.todos.some((t) => t.goalId === goalId && t.date === todayStr())) return "exists";
      mutate((s) => {
        const found = findGoal(s, goalId);
        if (found) s.todos.push({ id: uid(), text: found.goal.title, date: todayStr(), done: false, goalId });
      });
      setToast("오늘 할 일에 추가했어요 ☀️");
      return "added";
    },
  };

  return { state, syncing, toast, gold, clearGold: () => setGold(null), actions };
}
