// 다른 기기와 동시에 편집했을 때(409) 로컬 편집을 버리지 않고 합치기 위한 3-way 병합.
//
// 예전 동작: 충돌이 나면 서버 최신본으로 통째 교체 → 방금 만든 할 일·완료 체크가 사라졌다.
// 지금 동작: '마지막으로 서버와 맞았던 상태(base)'를 기준으로 로컬/원격 각각이
//            무엇을 바꿨는지 판별해 합친다. base 가 있으면 삭제도 정확히 반영되고,
//            base 가 없을 때만 안전하게 합집합(삭제보다 보존 우선)으로 떨어진다.

import type { AppState, CustomCat, Dream, Goal, Todo } from "./state";
import { streakCount, todayStr } from "./state";

/** 키 순서에 영향받지 않는 비교용 문자열. 항목 크기가 작아 비용은 무시할 수준. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
}

function same(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}

function byId<T>(list: T[] | undefined, key: (t: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  (list ?? []).forEach((it) => m.set(key(it), it));
  return m;
}

/**
 * 리스트 3-way 병합.
 *
 * 항목별 판정:
 *  - 양쪽에 있음  → 한쪽만 바뀌었으면 바뀐 쪽, 둘 다 바뀌었으면 mergeItem(없으면 로컬)
 *  - 로컬에만     → base 에 있었다면 원격이 지운 것. 로컬이 손댔으면 남기고(수정 > 삭제), 아니면 삭제 반영
 *  - 원격에만     → base 에 있었다면 로컬이 지운 것. 원격이 손댔으면 남기고, 아니면 삭제 반영
 *  - base 가 없으면(기준 소실) 어느 쪽에든 있으면 남긴다 — 유실보다 부활이 안전하다.
 *
 * 순서는 로컬 순서를 유지하고, 원격에만 있던 항목을 뒤에 붙인다.
 */
function mergeList<T>(
  base: T[] | undefined,
  local: T[],
  remote: T[],
  key: (t: T) => string,
  mergeItem?: (b: T | undefined, l: T, r: T) => T,
): T[] {
  const hasBase = base !== undefined;
  const B = byId(base, key);
  const L = byId(local, key);
  const R = byId(remote, key);

  const out: T[] = [];

  for (const l of local) {
    const k = key(l);
    const r = R.get(k);
    const b = B.get(k);

    if (r) {
      if (same(l, r)) out.push(l);
      else if (b && same(l, b)) out.push(r); // 로컬은 그대로, 원격만 변경 → 원격
      else if (b && same(r, b)) out.push(l); // 원격은 그대로, 로컬만 변경 → 로컬
      else out.push(mergeItem ? mergeItem(b, l, r) : l); // 둘 다 변경 → 로컬 우선
      continue;
    }

    // 원격에 없음 = 원격이 삭제했거나, 로컬이 새로 만든 것.
    if (!hasBase || !b) out.push(l); // 로컬 신규(또는 기준 없음) → 유지
    else if (!same(l, b)) out.push(l); // 원격은 지웠지만 로컬이 수정함 → 수정을 살린다
    // else: 원격의 삭제를 그대로 반영(로컬은 손대지 않았음)
  }

  for (const r of remote) {
    const k = key(r);
    if (L.has(k)) continue; // 위에서 처리됨
    const b = B.get(k);

    if (!hasBase || !b) out.push(r); // 원격 신규(또는 기준 없음) → 가져온다
    else if (!same(r, b)) out.push(r); // 로컬은 지웠지만 원격이 수정함 → 수정을 살린다
    // else: 로컬의 삭제를 그대로 반영
  }

  return out;
}

/** 목표(꿈) 하나를 병합 — 세부 할 일(goals)까지 각각 합친다. */
function mergeDream(b: Dream | undefined, l: Dream, r: Dream): Dream {
  return {
    ...l, // 제목·색·테마 등 스칼라 필드는 로컬 우선(이 기기에서 방금 만진 값)
    goals: mergeList<Goal>(b?.goals, l.goals ?? [], r.goals ?? [], (g) => g.id),
  };
}

/** 설정은 키 단위로 — 로컬이 바꾼 키는 로컬, 아니면 원격. */
function mergeSettings(
  base: Record<string, unknown> | undefined,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...remote };
  for (const k of Object.keys(local)) {
    const changedLocally = !base || !same(local[k], base[k]);
    if (changedLocally || !(k in remote)) out[k] = local[k];
  }
  if (base) {
    // 로컬이 지운 키는 원격이 바꾸지 않았다면 삭제를 반영한다.
    for (const k of Object.keys(base)) {
      if (!(k in local) && k in out && same(remote[k], base[k])) delete out[k];
    }
  }
  return out;
}

/**
 * 로컬 편집과 서버 최신본을 합친다.
 * @param base 마지막으로 서버와 일치했던 상태. 없으면(null) 합집합 병합으로 떨어진다.
 */
export function mergeStates(base: AppState | null, local: AppState, remote: AppState): AppState {
  const merged: AppState = {
    // 누적 카운터라 되돌아가면 안 된다 — 큰 쪽을 취한다.
    totalDone: Math.max(local.totalDone ?? 0, remote.totalDone ?? 0),
    bestStreak: Math.max(local.bestStreak ?? 0, remote.bestStreak ?? 0),
    dreams: mergeList<Dream>(base?.dreams, local.dreams ?? [], remote.dreams ?? [], (d) => d.id, mergeDream),
    todos: mergeList<Todo>(base?.todos, local.todos ?? [], remote.todos ?? [], (t) => t.id),
    customCats: mergeList<CustomCat>(base?.customCats, local.customCats ?? [], remote.customCats ?? [], (c) => c.key),
    settings: mergeSettings(base?.settings, local.settings ?? {}, remote.settings ?? {}),
    lastSeen: todayStr(),
  };

  // 병합으로 완료 할 일 구성이 달라졌을 수 있으므로 최고 기록을 다시 확인한다.
  merged.bestStreak = Math.max(merged.bestStreak, streakCount(merged));
  return merged;
}
