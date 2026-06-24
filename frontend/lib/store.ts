"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import {
  AppState,
  CHEERS,
  CustomCat,
  Dream,
  awardSticker,
  defaultState,
  ensureDailyTodos,
  findGoal,
  rand,
  removeSticker,
  streakCount,
  todayStr,
  Todo,
  uid,
  Repeat,
} from "./state";

/** todo의 완료 상태를 토글하고 칭찬 스티커(목표 단위)를 적립/회수. 표시할 토스트/골드를 반환. */
function applyToggle(s: AppState, t: Todo): { toast: string; gold: string | null } {
  t.done = !t.done;
  let toast = "";
  let gold: string | null = null;
  if (t.done) {
    s.totalDone++;
    toast = rand(CHEERS);
    if (t.goalId) {
      const found = findGoal(s, t.goalId);
      if (found) {
        toast = "🌟 칭찬 스티커를 받았어요!";
        if (awardSticker(found.dream)) gold = found.dream.title;
      }
    }
  } else {
    s.totalDone = Math.max(0, s.totalDone - 1);
    if (t.goalId) {
      const found = findGoal(s, t.goalId);
      if (found) removeSticker(found.dream);
    }
  }
  return { toast, gold };
}

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
  addDream(d: { title: string; cat: string; color: string; theme: string; emoji: string }): void;
  removeDream(id: string): void;
  addCustomCat(c: { emoji: string; label: string; color: string }): void;
  replaceState(s: AppState): void;
  toggleCollapse(id: string): void;
  setDday(id: string, date: string | null): void;
  addGoal(dreamId: string, title: string, repeat: Repeat): void;
  removeGoal(dreamId: string, goalId: string): void;
  toggleGoalRepeat(dreamId: string, goalId: string): void;
  toggleGoalDone(goalId: string): void;
  goalToToday(goalId: string): "added" | "exists";
}

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToastRaw] = useState("");
  const [gold, setGold] = useState<string | null>(null);

  const stateRef = useRef<AppState | null>(null);
  const versionRef = useRef(0);
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
        const env = await api.pullState();
        s = normalize(env.data);
        versionRef.current = env.version ?? 0;
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
        const res = await api.pushState(state, versionRef.current);
        versionRef.current = res.version;
      } catch (e) {
        if ((e as Error).message === "CONFLICT") {
          // 다른 기기에서 먼저 변경됨 → 서버 최신 상태로 동기화(로컬 덮어쓰기 방지).
          try {
            const env = await api.pullState();
            versionRef.current = env.version ?? 0;
            loaded.current = false; // 이번 setState 가 다시 push 되지 않도록
            setState(ensureDailyTodos(normalize(env.data)));
            setTimeout(() => (loaded.current = true), 0);
            setToast("다른 기기에서 변경되어 최신 상태로 맞췄어요 🔄");
          } catch {
            /* ignore */
          }
        }
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
        const r = applyToggle(s, t);
        toastMsg = r.toast;
        goldTitle = r.gold;
      });
      if (goldTitle) setGold(goldTitle);
      else if (toastMsg) setToast(toastMsg);
    },
    toggleGoalDone(goalId) {
      let toastMsg = "";
      let goldTitle: string | null = null;
      mutate((s) => {
        const found = findGoal(s, goalId);
        if (!found) return;
        // 오늘 이 할 일의 todo가 없으면 만들어서 바로 완료 처리한다.
        let t = s.todos.find((x) => x.goalId === goalId && x.date === todayStr());
        if (!t) {
          t = { id: uid(), text: found.goal.title, date: todayStr(), done: false, goalId };
          s.todos.push(t);
        }
        const r = applyToggle(s, t);
        toastMsg = r.toast;
        goldTitle = r.gold;
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
      mutate((s) => {
        s.dreams.push({ id: uid(), title: d.title, emoji: d.emoji, cat: d.cat, color: d.color, theme: d.theme, targetDate: null, goals: [] });
      });
      setToast(`${d.emoji} 목표를 세웠어요`);
    },
    addCustomCat(c) {
      const key = "custom_" + uid();
      mutate((s) => {
        s.customCats.push({ key, emoji: c.emoji, label: c.label, ph: `${c.label} 목표를 적어요`, dday: false, color: c.color, goals: [], custom: true });
      });
    },
    replaceState(s) {
      const next = ensureDailyTodos(structuredClone(s));
      next.lastSeen = todayStr();
      setState(next);
      setToast("백업을 불러왔어요 ✅");
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
