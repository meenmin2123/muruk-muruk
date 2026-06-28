"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import {
  AppState,
  ADD_CHEER,
  CHEERS,
  CELEBRATE_FALLBACK,
  CustomCat,
  Dream,
  awardSticker,
  defaultState,
  ensureDailyTodos,
  findGoal,
  isDreamFulfilled,
  rand,
  removeSticker,
  streakCount,
  todayStr,
  dateStr,
  boardCap,
  Todo,
  uid,
  Repeat,
} from "./state";

/**
 * '한 번' 할일로만 된 목표가 모두 완료되면 자동으로 달성 처리(보관)하고,
 * 다시 미완료가 되면 자동 해제한다. (습관형·수동 보관은 건드리지 않음.)
 * 새로 달성됐으면 그 목표 제목을 반환(축하용), 아니면 null.
 */
function syncDreamDone(s: AppState, dreamId: string | null): string | null {
  if (!dreamId) return null;
  const d = s.dreams.find((x) => x.id === dreamId);
  if (!d) return null;
  const onlyOnce = d.goals.length > 0 && d.goals.every((g) => g.repeat === "once");
  if (!onlyOnce) return null; // 습관형(매일 포함)은 자동 완성 대상 아님
  const fulfilled = isDreamFulfilled(d, s.todos);
  if (fulfilled && !d.done) {
    d.done = true;
    d.completedAt = todayStr();
    d.collapsed = true;
    return d.title;
  }
  if (!fulfilled && d.done) {
    // 한 번-목표는 수동 보관 경로가 없으므로, 미완료로 돌아가면 자동 해제(되살림).
    d.done = false;
    d.completedAt = undefined;
  }
  return null;
}

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
        if (awardSticker(found.dream, boardCap(found.dream))) gold = found.dream.title;
      }
    }
  } else {
    s.totalDone = Math.max(0, s.totalDone - 1);
    if (t.goalId) {
      const found = findGoal(s, t.goalId);
      if (found) removeSticker(found.dream, boardCap(found.dream));
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
  addTodo(text: string, goalId: string | null): void;
  toggleTodo(id: string): void;
  removeTodo(id: string): void;
  tomorrow(id: string): void;
  addDream(d: { title: string; cat: string; color: string; theme: string; emoji: string }): void;
  removeDream(id: string): void;
  addCustomCat(c: { emoji: string; label: string; color: string }): void;
  replaceState(s: AppState): void;
  toggleCollapse(id: string): void;
  setDday(id: string, date: string | null): void;
  setDreamIcon(id: string, icon: string): void;
  addGoal(dreamId: string, title: string, repeat: Repeat): void;
  removeGoal(dreamId: string, goalId: string): void;
  toggleGoalRepeat(dreamId: string, goalId: string): void;
  renameDream(dreamId: string, title: string): void;
  renameGoal(dreamId: string, goalId: string, title: string): void;
  updateSettings(patch: Record<string, unknown>): void;
  toggleGoalDay(goalId: string, date: string): void;
  toggleGoalDone(goalId: string): void;
  completeDream(id: string): void;
  restoreDream(id: string): void;
}

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToastRaw] = useState("");
  const [gold, setGold] = useState<string | null>(null);
  const [undoLabel, setUndoLabel] = useState("");

  const stateRef = useRef<AppState | null>(null);
  const versionRef = useRef(0);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoSnap = useRef<AppState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setToast = useCallback((msg: string) => {
    setToastRaw(msg);
    setTimeout(() => setToastRaw(""), 2200);
  }, []);

  // 삭제 직전 상태를 스냅샷해 두고 5초간 되돌리기를 제공.
  const armUndo = useCallback((label: string) => {
    undoSnap.current = stateRef.current ? structuredClone(stateRef.current) : null;
    setUndoLabel(label);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setUndoLabel("");
      undoSnap.current = null;
    }, 5000);
  }, []);

  const runUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (undoSnap.current) setState(undoSnap.current);
    undoSnap.current = null;
    setUndoLabel("");
  }, []);

  // 자정이 지나거나 다시 포커스됐을 때, 날짜가 바뀌었으면 오늘 목록을 갱신.
  useEffect(() => {
    const refresh = () => {
      const cur = stateRef.current;
      if (!cur || !loaded.current) return;
      if (cur.lastSeen === todayStr()) return;
      const next = ensureDailyTodos(structuredClone(cur));
      next.lastSeen = todayStr();
      setState(next);
    };
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    const iv = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      clearInterval(iv);
    };
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
      setToast(rand(ADD_CHEER));
    },
    toggleTodo(id) {
      let toastMsg = "";
      let goldTitle: string | null = null;
      let achieved: string | null = null;
      mutate((s) => {
        const t = s.todos.find((x) => x.id === id);
        if (!t) return;
        const r = applyToggle(s, t);
        toastMsg = r.toast;
        goldTitle = r.gold;
        if (t.goalId) {
          const found = findGoal(s, t.goalId);
          if (found) achieved = syncDreamDone(s, found.dream.id);
        }
      });
      if (achieved) setToast(`🎉 ‘${achieved}’ 목표를 이뤘어요! 기록에 보관했어요`);
      else if (goldTitle) setGold(goldTitle);
      else if (toastMsg) setToast(toastMsg);
    },
    removeTodo(id) {
      armUndo("할 일을 삭제했어요");
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
        t.date = dateStr(d);
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
      armUndo("목표를 삭제했어요");
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
        if (!d) return;
        d.targetDate = date || null; // 디데이는 카운트다운 표시용(칭찬판 칸 수와 무관)
        if (d.targetDate) {
          if (!d.ddayStart) d.ddayStart = todayStr(); // 처음 설정한 날을 시작일로 기록
        } else {
          d.ddayStart = undefined;
        }
      });
    },
    toggleGoalDone(goalId) {
      let toastMsg = "";
      let goldTitle: string | null = null;
      let achieved: string | null = null;
      mutate((s) => {
        const found = findGoal(s, goalId);
        if (!found) return;
        // 한 번 할 일: 이미 완료(아무 날짜)면 그걸 해제, 아니면 오늘 완료 처리.
        const existingDone = s.todos.find((t) => t.goalId === goalId && t.done);
        let t = existingDone;
        if (!t) {
          t = s.todos.find((x) => x.goalId === goalId && x.date === todayStr());
          if (!t) {
            t = { id: uid(), text: found.goal.title, date: todayStr(), done: false, goalId };
            s.todos.push(t);
          }
        }
        const r = applyToggle(s, t);
        toastMsg = r.toast;
        goldTitle = r.gold;
        achieved = syncDreamDone(s, found.dream.id);
      });
      if (achieved) setToast(`🎉 ‘${achieved}’ 목표를 이뤘어요! 기록에 보관했어요`);
      else if (goldTitle) setGold(goldTitle);
      else if (toastMsg) setToast(toastMsg);
    },
    setDreamIcon(id, icon) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (d) d.icon = icon;
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
      setToast(rand(ADD_CHEER));
    },
    removeGoal(dreamId, goalId) {
      armUndo("할 일을 삭제했어요");
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
    renameDream(dreamId, title) {
      const v = title.trim();
      if (!v) return;
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === dreamId);
        if (d) d.title = v;
      });
    },
    renameGoal(dreamId, goalId, title) {
      const v = title.trim();
      if (!v) return;
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === dreamId);
        const g = d?.goals.find((x) => x.id === goalId);
        if (!g) return;
        g.title = v;
        // 이 할 일에서 만들어진 todo들의 텍스트도 함께 갱신해 오늘 목록과 일치시킨다.
        s.todos.forEach((t) => {
          if (t.goalId === goalId) t.text = v;
        });
      });
    },
    updateSettings(patch) {
      mutate((s) => {
        s.settings = { ...s.settings, ...patch };
      });
    },
    toggleGoalDay(goalId, date) {
      let toastMsg = "";
      let goldTitle: string | null = null;
      mutate((s) => {
        const found = findGoal(s, goalId);
        if (!found) return;
        let t = s.todos.find((x) => x.goalId === goalId && x.date === date);
        if (!t) {
          t = { id: uid(), text: found.goal.title, date, done: false, goalId };
          s.todos.push(t);
        }
        const r = applyToggle(s, t);
        toastMsg = r.toast;
        goldTitle = r.gold;
      });
      if (goldTitle) setGold(goldTitle);
      else if (toastMsg) setToast(toastMsg);
    },
    completeDream(id) {
      armUndo("목표를 보관했어요");
      let title = "";
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (!d) return;
        d.done = true;
        d.completedAt = todayStr();
        d.collapsed = true;
        title = d.title;
      });
      setToast(title ? `🎉 ‘${title}’ ${rand(CELEBRATE_FALLBACK)}` : rand(CELEBRATE_FALLBACK));
    },
    restoreDream(id) {
      let reopened = false;
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (!d) return;
        d.done = false;
        d.completedAt = undefined;
        d.collapsed = false;
        // 한 번-목표는 다 체크된 채라 손대면 즉시 재보관됨 → 완료 할일 하나를 다시 열어둔다.
        const onlyOnce = d.goals.length > 0 && d.goals.every((g) => g.repeat === "once");
        if (onlyOnce) {
          const doneTodos = s.todos.filter((t) => t.done && d.goals.some((g) => g.id === t.goalId));
          if (doneTodos.length > 0) {
            doneTodos.sort((a, b) => b.date.localeCompare(a.date));
            applyToggle(s, doneTodos[0]); // done 해제 + 스티커 회수
            reopened = true;
          }
        }
      });
      setToast(reopened ? "다시 진행해요 🌱 할 일 하나를 열어뒀어요" : "목표를 다시 진행해요 🌱");
    },
  };

  return { state, syncing, toast, gold, clearGold: () => setGold(null), undoLabel, runUndo, actions };
}
