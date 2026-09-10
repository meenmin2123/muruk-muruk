"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, flushState as apiFlushState, ERR_CONFLICT, ERR_UNAUTHORIZED } from "./api";
import { pushWidgetSnapshot } from "./widget";
import { getIdentity } from "./auth";
import { mergeStates } from "./merge";
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

/**
 * 되살릴 가치가 있는 기록이 담겨 있는가 — 갓 설치한 빈 상태와 구분한다.
 * 애매하면 '있다'로 판단한다: 잘못 판단해도 서버에 빈 행이 하나 생길 뿐이지만,
 * 반대로 놓치면 마지막 사본이 지워진다.
 */
function hasContent(s: AppState | null): s is AppState {
  if (!s) return false;
  return (
    s.dreams.length > 0 ||
    s.todos.length > 0 ||
    s.customCats.length > 0 ||
    (s.totalDone ?? 0) > 0 ||
    (s.bestStreak ?? 0) > 0 ||
    Object.keys(s.settings ?? {}).length > 0
  );
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
//
// v2부터는 상태만이 아니라 동기화 문맥까지 함께 저장한다:
//   version — 이 상태가 기반한 서버 버전
//   base    — 마지막으로 서버와 일치했던 상태(3-way 병합 기준점)
//   pending — 아직 서버에 올리지 못한 편집이 있는가
// 이 세 가지가 있어야, 토큰 만료·오프라인·탭 종료로 저장이 끊겨도
// 다음 접속 때 서버본과 '합칠' 수 있다(예전엔 서버본으로 덮어써서 편집이 사라졌다).
const CACHE_PREFIX = "muruk_state_cache_v1:";

interface CacheEnvelope {
  state: AppState;
  version: number;
  base: AppState | null;
  pending: boolean;
}

/**
 * 캐시 키는 '유효한 토큰'이 아니라 '토큰에 적힌 신원'으로 만든다.
 * 유효성으로 판단하면 토큰이 만료된 순간 키가 null이 되어 캐시 쓰기가 멈추고,
 * 만료 이후의 편집이 로컬에도 서버에도 남지 않아 통째로 사라진다.
 */
function cacheKey(): string | null {
  try {
    const u = getIdentity();
    return u ? CACHE_PREFIX + u.id : null;
  } catch {
    return null;
  }
}

function readCache(): CacheEnvelope | null {
  try {
    const k = cacheKey();
    if (!k) return null;
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // v2 봉투 형태
    if (parsed && typeof parsed === "object" && parsed.v === 2) {
      return {
        state: normalize(parsed.state),
        version: typeof parsed.version === "number" ? parsed.version : 0,
        base: parsed.base ? normalize(parsed.base) : null,
        pending: parsed.pending === true,
      };
    }
    // v1(상태만 저장하던 형태) — 서버 버전을 모르므로 병합 기준도 없다.
    return { state: normalize(parsed), version: 0, base: null, pending: false };
  } catch {
    return null;
  }
}

function writeCache(state: AppState, version: number, base: AppState | null, pending: boolean): void {
  const k = cacheKey();
  if (!k) return;
  const save = (withBase: AppState | null) => {
    localStorage.setItem(k, JSON.stringify({ v: 2, state, version, base: withBase, pending }));
  };
  try {
    save(base);
  } catch {
    // 용량 초과 → 병합 기준(base)을 빼고 다시 시도. 상태 보존이 우선이다.
    try {
      save(null);
    } catch {
      /* 그래도 안 되면 포기(다음 저장에서 재시도) */
    }
  }
}

/** 병합 후 모든 목표의 칭찬판을 실제 완료 수로 다시 맞춘다(스티커·도장 어긋남 방지). */
function reconcileAll(s: AppState): AppState {
  s.dreams.forEach((d) => reconcileBoard(s, d));
  return s;
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
  setDreamColor(id: string, color: string): void;
  setDreamTheme(id: string, theme: string): void;
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
  // 마지막으로 서버와 일치했던 상태 — 충돌 시 3-way 병합의 기준점.
  const baseRef = useRef<AppState | null>(null);
  // 마지막 push 이후 변경 있음 → 아직 서버에 없는 편집이 존재한다.
  // 예전에는 이 값을 '상태 변경 효과'가 세웠는데, 그 효과는 로딩 중(!loaded)에 조기 리턴하므로
  // 콜드 스타트 중의 편집이 dirty로 기록되지 않아 서버로도 캐시로도 남지 않았다.
  // 지금은 편집(mutate/commit)이 직접 세운다.
  const dirty = useRef(false);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false); // 초기 로드 완료 → 이제부터 서버로 올린다
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoSnap = useRef<AppState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const conflictRounds = useRef(0);
  const pushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setToast = useCallback((msg: string) => {
    setToastRaw(msg);
    setTimeout(() => setToastRaw(""), 2200);
  }, []);

  /**
   * 화면 상태를 바꾸면서 stateRef 도 그 자리에서 갱신한다.
   * 초기 로드의 async 블록이 stateRef 를 읽어 병합 여부를 정하는데,
   * 그 값이 React 렌더·이펙트 타이밍에 좌우되면 로딩 중 편집을 놓치고 서버본으로 덮어쓸 수 있다.
   */
  const applyState = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** 상태를 바꾸고 '아직 서버에 없음'으로 표시한다. 모든 사용자 편집은 이 경로를 지난다. */
  const commit = useCallback(
    (next: AppState) => {
      dirty.current = true;
      applyState(next);
    },
    [applyState],
  );

  // 페이지가 사라지기 직전(탭 닫기·SW 강제 새로고침 등) 미저장 변경을 keepalive로 마저 보낸다.
  // 언로드 중에는 응답을 확인할 수 없으므로 dirty를 내리지 않고, 캐시에 pending으로 남긴다.
  // 전송이 실패했더라도 다음 접속 때 서버본과 병합되어 편집이 살아남는다.
  useEffect(() => {
    const flush = () => {
      const s = stateRef.current;
      if (!readyRef.current || !dirty.current || !s) return;
      apiFlushState(s, versionRef.current);
      writeCache(s, versionRef.current, baseRef.current, true);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  /** 네트워크 오류 등으로 못 올렸을 때 점점 긴 간격으로 재시도. */
  const scheduleRetry = useCallback(() => {
    const delays = [3000, 8000, 20000, 45000];
    if (retryCount.current >= delays.length) return; // 다음 편집이나 언로드 flush 때 다시 시도된다
    const delay = delays[retryCount.current];
    retryCount.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushRef.current?.(), delay);
  }, []);

  /**
   * 409(다른 기기가 먼저 저장) 해결.
   * 예전에는 서버본으로 통째 교체해 로컬 편집을 버렸다. 지금은 base 기준 3-way 병합 후
   * 병합 결과를 다시 올린다 — 양쪽 편집이 모두 살아남는다.
   */
  const resolveConflict = useCallback(async () => {
    if (conflictRounds.current >= 5) {
      setToast("동기화 충돌이 반복돼요. 새로고침해 주세요");
      return;
    }
    conflictRounds.current += 1;
    try {
      const env = await api.pullState();
      const remote = normalize(env.data);
      versionRef.current = env.version ?? 0;
      const local = stateRef.current;

      if (!local) {
        baseRef.current = structuredClone(remote);
        dirty.current = false;
        applyState(ensureDailyTodos(remote));
        return;
      }

      // structuredClone: 병합 결과는 local/remote 객체를 그대로 참조하므로,
      // 이어지는 reconcileBoard 가 baseRef(=remote)까지 오염시키지 않도록 떼어낸다.
      const merged = reconcileAll(ensureDailyTodos(structuredClone(mergeStates(baseRef.current, local, remote))));
      baseRef.current = structuredClone(remote);
      commit(merged); // dirty=true → 디바운스가 병합 결과를 다시 올린다
      setToast("다른 기기의 변경과 합쳤어요 🔄");
    } catch (e) {
      if ((e as Error).message !== ERR_UNAUTHORIZED) scheduleRetry();
    }
  }, [applyState, commit, scheduleRetry, setToast]);

  /** 지금 서버로 올린다. 성공하면 base·version을 갱신하고 dirty를 내린다. */
  const pushNow = useCallback(async () => {
    const s = stateRef.current;
    if (!s || !dirty.current) return;
    setSyncing(true);
    try {
      const res = await api.pushState(s, versionRef.current);
      versionRef.current = res.version;
      baseRef.current = s; // 이제 서버와 일치 — 다음 충돌의 병합 기준
      dirty.current = false;
      retryCount.current = 0;
      conflictRounds.current = 0;
      writeCache(s, versionRef.current, baseRef.current, false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === ERR_CONFLICT) {
        await resolveConflict();
      } else if (msg === ERR_UNAUTHORIZED) {
        // api 계층이 이미 갱신을 시도하고 재로그인 신호를 보냈다.
        // dirty는 그대로 둔다 → 다시 로그인하면 캐시의 pending 편집이 병합된다.
        setToast("로그인이 만료됐어요. 다시 로그인하면 이어서 저장돼요");
      } else {
        scheduleRetry();
      }
    } finally {
      setSyncing(false);
    }
  }, [resolveConflict, scheduleRetry, setToast]);

  useEffect(() => {
    pushRef.current = () => {
      void pushNow();
    };
  }, [pushNow]);

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
    if (undoSnap.current) commit(undoSnap.current);
    undoSnap.current = null;
    setUndoLabel("");
  }, [commit]);

  // 자정이 지나거나 다시 포커스됐을 때, 날짜가 바뀌었으면 오늘 목록을 갱신.
  useEffect(() => {
    const refresh = () => {
      const cur = stateRef.current;
      if (!cur || !readyRef.current) return;
      if (cur.lastSeen === todayStr()) return;
      const next = ensureDailyTodos(structuredClone(cur));
      next.lastSeen = todayStr();
      commit(next);
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
  }, [commit]);

  // 최초 로드:
  //  1) 로컬 캐시가 있으면 즉시 화면에 띄운다(백엔드 콜드 스타트 동안 '불러오는 중' 방지).
  //  2) 백엔드에서 최신 상태를 받는다.
  //  3) 아직 못 올린 로컬 편집(캐시 pending 또는 로딩 중 편집)이 있으면 서버본과 '병합'한다.
  //     예전에는 무조건 서버본으로 교체해, 토큰 만료·오프라인 중의 편집이 사라졌다.
  useEffect(() => {
    let alive = true;
    const cached = readCache();
    if (cached) {
      versionRef.current = cached.version;
      baseRef.current = cached.base;
      if (cached.pending) dirty.current = true; // 지난 세션에서 못 올린 편집이 있다
      const c = ensureDailyTodos(cached.state);
      c.lastSeen = todayStr();
      applyState(c); // commit이 아니라 applyState — 캐시 표시 자체는 새 편집이 아니다
    }

    (async () => {
      let remote: AppState | null = null;
      let remoteVersion = 0;
      let serverRowExists = false;
      try {
        const env = await api.pullState();
        remote = normalize(env.data);
        remoteVersion = env.version ?? 0;
        // updatedAt 은 서버에 행이 있을 때만 채워진다(없으면 null).
        // version 으로는 구분할 수 없다 — 최초 저장도 0 이라 '행 없음'과 값이 같다.
        serverRowExists = typeof env.updatedAt === "string";
      } catch {
        // 오프라인·콜드스타트·토큰 만료 — 캐시로 계속 진행한다.
      }
      if (!alive) return;

      const local = stateRef.current;

      if (remote && !serverRowExists && hasContent(local)) {
        // 서버에 행 자체가 없는데 이 기기에는 기록이 있다
        //  = 사용자가 지운 게 아니라 서버 쪽 데이터가 사라진 것(DB 재생성·초기화, 또는 첫 동기화 미완료).
        // 서버가 200 + {} 를 돌려주기 때문에 예전에는 이걸 '정상적인 빈 상태'로 받아들여
        // 화면과 로컬 캐시까지 덮어썼다 — 마지막 남은 사본이 바로 여기서 사라졌다.
        // 이제는 로컬을 정본으로 삼아 서버로 되돌려 올린다.
        versionRef.current = 0; // 행이 없으므로 이 값으로 INSERT 된다
        baseRef.current = null; // 합의된 기준이 없다 → 충돌 시 합집합 병합(보존 우선)으로 떨어진다
        dirty.current = true; // 아래 디바운스 효과가 이 상태를 서버에 복원한다
        applyState(structuredClone(local)); // 캐시에 pending 표시가 남도록 다시 적용
        setToast("서버에 기록이 없어 이 기기의 기록을 올릴게요 ☁️");
      } else if (remote) {
        versionRef.current = remoteVersion;
        if (dirty.current && local) {
          const merged = reconcileAll(
            ensureDailyTodos(structuredClone(mergeStates(baseRef.current, local, remote))),
          );
          baseRef.current = structuredClone(remote);
          applyState(merged); // dirty는 이미 true → 아래 효과가 병합 결과를 올린다
          setToast("저장 못 한 변경을 서버와 합쳤어요 🔄");
        } else {
          baseRef.current = structuredClone(remote);
          dirty.current = false;
          const s = ensureDailyTodos(remote);
          s.lastSeen = todayStr();
          applyState(s);
        }
      } else if (!cached) {
        const s = ensureDailyTodos(defaultState());
        s.lastSeen = todayStr();
        applyState(s);
      }

      readyRef.current = true;
      setReady(true); // ready가 바뀌면 아래 효과가 다시 돌아, 로딩 중 편집도 예약된다
    })();

    return () => {
      alive = false;
    };
  }, [applyState, setToast]);

  // 상태가 바뀔 때마다 로컬 캐시 갱신(다음 접속 즉시 표시 + 미저장 편집 보존).
  useEffect(() => {
    if (state) writeCache(state, versionRef.current, baseRef.current, dirty.current);
  }, [state]);

  // 변경 시 디바운스 업로드.
  // ready를 의존성에 넣은 것이 핵심 — 로딩이 끝나는 순간 효과가 다시 실행되어
  // 로딩 중에 한 편집(dirty=true)도 업로드가 예약된다.
  useEffect(() => {
    if (!ready || !state || !dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void pushNow();
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, ready, pushNow]);

  // 상태가 바뀔 때마다 홈 화면 위젯 스냅샷을 갱신(Capacitor 네이티브에서만 실제 동작).
  useEffect(() => {
    if (!ready || !state) return;
    pushWidgetSnapshot(state);
  }, [state, ready]);

  const mutate = useCallback(
    (fn: (s: AppState) => void) => {
      const cur = stateRef.current;
      if (!cur) return;
      // 새 편집 = 새 시도. (commit이 아니라 여기서만 초기화하는 이유:
      //  resolveConflict도 commit을 쓰므로, commit에서 초기화하면 충돌 루프 가드가 무력화된다.)
      retryCount.current = 0;
      conflictRounds.current = 0;
      const next = structuredClone(cur);
      fn(next);
      const st = streakCount(next);
      if (st > next.bestStreak) next.bestStreak = st;
      commit(next);
    },
    [commit],
  );

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
      let moved = "";
      mutate((s) => {
        const t = s.todos.find((x) => x.id === id);
        if (!t) return;
        // 그 할 일이 놓인 날짜 기준으로 하루 뒤. 예전에는 항상 '실제 오늘 +1'이라
        // 미래 날짜 화면에서 미루면 할 일이 오히려 앞으로 당겨졌다.
        const d = new Date((t.date || todayStr()) + "T00:00:00");
        d.setDate(d.getDate() + 1);
        t.date = dateStr(d);
        moved = t.date;
      });
      const tmr = (() => {
        const d = new Date(todayStr() + "T00:00:00");
        d.setDate(d.getDate() + 1);
        return dateStr(d);
      })();
      setToast(moved === tmr ? "내일로 미뤘어요. 괜찮아요 🤍" : "하루 뒤로 미뤘어요 🤍");
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
      commit(next); // 불러온 백업도 서버로 올려야 한다
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
    setDreamColor(id, color) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (d) d.color = color;
      });
    },
    setDreamTheme(id, theme) {
      mutate((s) => {
        const d = s.dreams.find((x) => x.id === id);
        if (d) d.theme = theme;
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
