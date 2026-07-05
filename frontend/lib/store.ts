"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, flushState as apiFlushState } from "./api";
import { pushWidgetSnapshot } from "./widget";
import { getUser } from "./auth";
import {
  AppState,
  ADD_CHEER,
  CHEERS,
  CELEBRATE_FALLBACK,
  CustomCat,
  Dream,
  STICKERS,
  defaultState,
  ensureDailyTodos,
  findGoal,
  isDreamFulfilled,
  rand,
  streakCount,
  todayStr,
  dateStr,
  boardCap,
  Todo,
  uid,
  Repeat,
} from "./state";

/**
 * '한 번' 할일로만 된 목표의 모든 할 일을 방금 다 끝냈는지 확인.
 * 자동 보관은 하지 않는다(목표가 갑자기 사라지지 않게) — 축하 토스트용 제목만 반환.
 * 보관은 사용자가 '마치기'로 직접 한다.
 */
function checkDreamFulfilled(s: AppState, dreamId: string | null): string | null {
  if (!dreamId) return null;
  const d = s.dreams.find((x) => x.id === dreamId);
  if (!d || d.done) return null;
  const onlyOnce = d.goals.length > 0 && d.goals.every((g) => g.repeat === "once");
  if (!onlyOnce) return null;
  return isDreamFulfilled(d, s.todos) ? d.title : null;
}

/**
 * 칭찬판을 '실제 완료한 할일 개수'로부터 다시 계산(단일 진실원천).
 * 토글/삭제/칸수변경 등 어떤 경로로 와도 earned·stamps·stickers가 어긋나지 않는다.
 * 반환: 이번 계산으로 보드가 새로 가득 찼으면(도장↑) true.
 */
function reconcileBoard(s: AppState, d: Dream): boolean {
  const cap = boardCap(d);
  const earned = s.todos.filter((t) => t.done && d.goals.some((g) => g.id === t.goalId)).length;
  const prevStamps = d.stamps ?? 0;
  const stamps = Math.floor(earned / cap);
  // 현재 판에 보이는 스티커 수: 가득 차면 cap(완성! 표시), 아니면 나머지.
  const onBoard = earned === 0 ? 0 : earned % cap === 0 ? cap : earned % cap;
  const cur = d.stickers ?? [];
  const next = cur.slice(0, onBoard);
  while (next.length < onBoard) next.push(rand(STICKERS));
  d.stickers = next;
  d.earned = earned;
  d.stamps = stamps;
  return stamps > prevStamps;
}

/** todo의 완료 상태를 토글하고, 그 목표의 칭찬판을 실제 완료 수로 재계산. 토스트/골드 반환. */
function applyToggle(s: AppState, t: Todo): { toast: string; gold: string | null } {
  t.done = !t.done;
  let toast = t.done ? rand(CHEERS) : "";
  let gold: string | null = null;
  if (t.done) s.totalDone++;
  else s.totalDone = Math.max(0, s.totalDone - 1);
  if (t.goalId) {
    const found = findGoal(s, t.goalId);
    if (found) {
      const filledNow = reconcileBoard(s, found.dream);
      if (t.done) toast = "🌟 칭찬 스티커를 받았어요!";
      if (filledNow) gold = found.dream.title;
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

// 마지막으로 본 상태를 로컬에 캐시 → 다음 접속 때 백엔드 응답을 기다리지 않고 즉시 화면을 띄운다.
// (특히 무료 백엔드 콜드 스타트 30~60초 동안 하얀 '불러오는 중' 화면을 없앤다.)
// 사용자(sub)별로 분리 저장해 다른 계정 데이터가 섞이지 않게 한다.
const CACHE_PREFIX = "muruk_state_cache_v1:";
function cacheKey(): string | null {
  try {
    const u = getUser();
    return u ? CACHE_PREFIX + u.id : null;
  } catch {
    return null;
  }
}
function readCache(): AppState | null {
  try {
    const k = cacheKey();
    if (!k) return null;
    const raw = localStorage.getItem(k);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeCache(s: AppState): void {
  try {
    const k = cacheKey();
    if (k) localStorage.setItem(k, JSON.stringify(s));
  } catch {
    /* 용량 초과 등 무시 */
  }
}

export interface AppActions {
  addTodo(text: string, goalId: string | null, date?: string): void;
  editTodo(id: string, text: string): void;
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
  const dirty = useRef(false); // 마지막 push 이후 변경 있음 → 언로드 시 flush 대상
  const editedDuringLoad = useRef(false); // 서버 응답 전(캐시 표시 중)에 사용자가 편집했는가

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 페이지가 사라지기 직전(탭 닫기·SW 강제 새로고침 등) 미저장 변경을 keepalive로 마저 보낸다.
  useEffect(() => {
    const flush = () => {
      if (!loaded.current || !dirty.current || !stateRef.current) return;
      apiFlushState(stateRef.current, versionRef.current);
      dirty.current = false;
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

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

  // 최초 로드:
  //  1) 로컬 캐시가 있으면 즉시 화면에 띄운다(백엔드 콜드 스타트 동안 '불러오는 중' 방지).
  //  2) 백엔드에서 최신 상태를 받아 동기화한다. 단, 로딩 중 사용자가 편집했다면
  //     로컬 편집을 우선(덮어쓰기 방지)하고 서버엔 그 편집을 올린다.
  useEffect(() => {
    let alive = true;
    const cached = readCache();
    if (cached) {
      const c = ensureDailyTodos(cached);
      c.lastSeen = todayStr();
      setState(c); // loaded.current는 아직 false → 이 상태는 서버로 자동 업로드되지 않음
    }
    (async () => {
      let s: AppState;
      let ok = false;
      try {
        const env = await api.pullState();
        s = normalize(env.data);
        versionRef.current = env.version ?? 0;
        ok = true;
      } catch {
        s = cached ?? defaultState();
      }
      if (!alive) return;
      if (ok && !editedDuringLoad.current) {
        // 서버 최신본으로 반영(로딩 중 편집이 없었을 때만).
        s = ensureDailyTodos(s);
        s.lastSeen = todayStr();
        setState(s);
      } else if (!ok && !cached) {
        // 캐시도 없고 서버도 실패 → 기본 상태라도 보여준다.
        s = ensureDailyTodos(s);
        s.lastSeen = todayStr();
        setState(s);
      }
      // ok && editedDuringLoad: 로컬 편집 유지 → 이후 디바운스 push가 서버 version으로 올림.
      loaded.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 상태가 바뀔 때마다 로컬 캐시 갱신(다음 접속 즉시 표시용).
  useEffect(() => {
    if (state) writeCache(state);
  }, [state]);

  // 변경 시 디바운스 업로드
  useEffect(() => {
    if (!loaded.current || !state) return;
    if (timer.current) clearTimeout(timer.current);
    dirty.current = true; // 이 상태가 아직 서버에 안 올라감
    timer.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const res = await api.pushState(state, versionRef.current);
        versionRef.current = res.version;
        dirty.current = false;
      } catch (e) {
        if ((e as Error).message === "CONFLICT") {
          // 다른 기기에서 먼저 변경됨 → 서버 최신 상태로 동기화(로컬 덮어쓰기 방지).
          try {
            const env = await api.pullState();
            versionRef.current = env.version ?? 0;
            const pulled = normalize(env.data);
            // 최고 기록은 떨어지지 않게 보존(로컬·서버·재계산 중 최댓값).
            pulled.bestStreak = Math.max(pulled.bestStreak, stateRef.current?.bestStreak ?? 0, streakCount(pulled));
            loaded.current = false; // 이번 setState 가 다시 push 되지 않도록
            setState(ensureDailyTodos(pulled));
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

  // 상태가 바뀔 때마다 홈 화면 위젯 스냅샷을 갱신(Capacitor 네이티브에서만 실제 동작).
  useEffect(() => {
    if (!loaded.current || !state) return;
    pushWidgetSnapshot(state);
  }, [state]);

  const mutate = useCallback((fn: (s: AppState) => void) => {
    const cur = stateRef.current;
    if (!cur) return;
    if (!loaded.current) editedDuringLoad.current = true; // 서버 응답 전 편집 → 로컬 우선
    const next = structuredClone(cur);
    fn(next);
    const st = streakCount(next);
    if (st > next.bestStreak) next.bestStreak = st;
    setState(next);
  }, []);

  const actions: AppActions = {
    addTodo(text, goalId, date) {
      mutate((s) => {
        s.todos.push({ id: uid(), text, date: date || todayStr(), done: false, goalId });
      });
      setToast(rand(ADD_CHEER));
    },
    editTodo(id, text) {
      const v = text.trim();
      if (!v) return;
      mutate((s) => {
        const t = s.todos.find((x) => x.id === id);
        if (!t || t.text === v) return;
        // 목표에 연결된 할 일이면 목표명을 바꾸고, 그 목표의 모든 할 일 텍스트를 함께 갱신(일관성).
        if (t.goalId) {
          const found = findGoal(s, t.goalId);
          if (found) {
            found.goal.title = v;
            s.todos.forEach((x) => {
              if (x.goalId === t.goalId) x.text = v;
            });
            return;
          }
        }
        t.text = v;
      });
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
          if (found) achieved = checkDreamFulfilled(s, found.dream.id);
        }
      });
      if (achieved) setToast(`🎉 ‘${achieved}’ 목표를 다 이뤘어요! ‘마치기’로 보관할 수 있어요`);
      else if (goldTitle) setGold(goldTitle);
      else if (toastMsg) setToast(toastMsg);
    },
    removeTodo(id) {
      armUndo("할 일을 삭제했어요");
      mutate((s) => {
        const removed = s.todos.find((t) => t.id === id);
        s.todos = s.todos.filter((t) => t.id !== id);
        // 완료한 목표 할일을 지우면 그 목표 칭찬판을 다시 계산(스티커 어긋남 방지).
        if (removed?.done && removed.goalId) {
          const found = findGoal(s, removed.goalId);
          if (found) reconcileBoard(s, found.dream);
        }
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
      // 외부 백업은 신뢰 불가 → normalize로 형태 보정(배열/필드 누락 시 크래시 방지).
      const next = ensureDailyTodos(normalize(s));
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
        achieved = checkDreamFulfilled(s, found.dream.id);
      });
      if (achieved) setToast(`🎉 ‘${achieved}’ 목표를 다 이뤘어요! ‘마치기’로 보관할 수 있어요`);
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
        reconcileBoard(s, d); // 칸 수(cap) 변경 → 칭찬판 재계산
      });
      setToast(rand(ADD_CHEER));
    },
    removeGoal(dreamId, goalId) {
      armUndo("할 일을 삭제했어요");
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === dreamId);
        if (!d) return;
        d.goals = d.goals.filter((g) => g.id !== goalId);
        s.todos = s.todos.filter((t) => t.goalId !== goalId); // 그 할일의 todo도 정리
        reconcileBoard(s, d); // 칸 수 변경 → 칭찬판 재계산
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
