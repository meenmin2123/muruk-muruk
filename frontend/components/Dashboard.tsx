"use client";

import { useEffect, useRef, useState } from "react";
import { api, coachMessage } from "@/lib/api";
import { clearToken, getUser } from "@/lib/auth";
import { AppState, defaultState, streakCount, totalStickers, ENCOURAGE_FALLBACK, REVIEW_FALLBACK, CELEBRATE_FALLBACK } from "@/lib/state";
import type { AppActions } from "@/lib/store";
import type { AdminUserState } from "@/lib/types";
import { stampSVG } from "@/lib/trees";
import { useAppState } from "@/lib/store";
import { useDailyReminder, DEFAULT_REMINDER_TIME } from "@/lib/reminder";
import { TodayTab } from "./tabs/TodayTab";
import { DreamsTab } from "./tabs/DreamsTab";
import { RecordsTab } from "./tabs/RecordsTab";
import { Icon } from "./Icon";

type Tab = "dreams" | "today" | "records";

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { state, toast, gold, clearGold, undoLabel, runUndo, actions } = useAppState();
  const [tab, setTab] = useState<Tab>("today");
  const [settings, setSettings] = useState(false);
  const [celebrate, setCelebrate] = useState("");
  const routed = useRef(false);
  const user = getUser();

  // 관리자 여부(서버 확정) + 관리자 모드(로컬에 기억). 모드 ON이면 메인 화면이 전체 사용자 뷰로 전환.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  useEffect(() => {
    api.me().then((m) => setIsAdmin(!!m.isAdmin)).catch(() => {});
    try {
      setAdminMode(localStorage.getItem("muruk_admin_mode") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  function changeAdminMode(on: boolean) {
    setAdminMode(on);
    try {
      localStorage.setItem("muruk_admin_mode", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  const adminViewing = isAdmin && adminMode;

  useDailyReminder(state);

  // 신규 사용자(목표 0개)는 첫 진입을 '목표' 탭으로 안내.
  useEffect(() => {
    if (state && !routed.current) {
      routed.current = true;
      if (state.dreams.length === 0) setTab("dreams");
    }
  }, [state]);

  // 칭찬판 완성 시 Claude 축하 메시지 가져오기
  useEffect(() => {
    if (!gold) {
      setCelebrate("");
      return;
    }
    let alive = true;
    coachMessage("celebrate", JSON.stringify({ 완성한목표: gold, 누적완료: state?.totalDone ?? 0 }), CELEBRATE_FALLBACK)
      .then((m) => alive && setCelebrate(m));
    return () => {
      alive = false;
    };
  }, [gold, state?.totalDone]);

  if (!state) {
    return (
      <div className="app">
        <div className="empty" style={{ paddingTop: 120 }}>불러오는 중…</div>
      </div>
    );
  }

  const streak = streakCount(state);
  const stickers = totalStickers(state);

  return (
    <div className="app">
      <header>
        <span className="appver" title="빌드 버전(캐시 확인용)">v6</span>
        <button className="gear" onClick={() => setSettings(true)} aria-label="설정">
          <Icon name="settings" size={18} />
        </button>
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="logo-ic" />
          <span>
            무럭무럭<span className="dot">.</span>
          </span>
        </div>
      </header>

      <main>
        {adminViewing ? (
          <AdminView onExit={() => changeAdminMode(false)} />
        ) : (
          <>
            {tab === "today" && <TodayTab state={state} actions={actions} />}
            {tab === "dreams" && <DreamsTab state={state} actions={actions} />}
            {tab === "records" && <RecordsTab state={state} actions={actions} />}
          </>
        )}
      </main>

      {!adminViewing && (
        <nav>
          <NavBtn icon="goal" label="목표" active={tab === "dreams"} onClick={() => setTab("dreams")} />
          <NavBtn icon="today" label="오늘" active={tab === "today"} onClick={() => setTab("today")} />
          <NavBtn icon="records" label="기록" active={tab === "records"} onClick={() => setTab("records")} />
        </nav>
      )}

      <div className={"toast" + (toast && !undoLabel ? " show" : "")}>{toast}</div>

      <div className={"toast undo" + (undoLabel ? " show" : "")}>
        <span>{undoLabel}</span>
        <button onClick={runUndo}>되돌리기</button>
      </div>

      {gold && (
        <div className="modal-bg" onClick={clearGold}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: stampSVG(150) }} />
            <h3 style={{ margin: "10px 0 6px" }}>완성! 🎉</h3>
            <p className="muted">“{gold}” 칭찬판을 가득 채웠어요.</p>
            {celebrate && <p style={{ lineHeight: 1.6, marginTop: 4 }}>{celebrate}</p>}
            <button className="btn" style={{ width: "100%" }} onClick={clearGold}>
              확인
            </button>
          </div>
        </div>
      )}

      {settings && (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onLogout={() => {
            clearToken();
            onLogout();
          }}
          state={state}
          actions={actions}
          context={JSON.stringify({ streak, stickers, totalDone: state.totalDone, dreams: state.dreams.map((d) => ({ title: d.title, goals: d.goals.map((g) => g.title) })) })}
          userName={user?.name ?? "사용자"}
          userEmail={user?.email ?? ""}
          userPicture={user?.picture ?? null}
          isAdmin={isAdmin}
          adminMode={adminMode}
          onToggleAdminMode={(on) => {
            changeAdminMode(on);
            setSettings(false);
          }}
        />
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "on" : ""} onClick={onClick}>
      <span className="ni">
        <Icon name={icon} size={23} />
      </span>
      <span className="nl">{label}</span>
    </button>
  );
}

function SettingsSheet({
  onClose,
  onLogout,
  state,
  actions,
  context,
  userName,
  userEmail,
  userPicture,
  isAdmin,
  adminMode,
  onToggleAdminMode,
}: {
  onClose: () => void;
  onLogout: () => void;
  state: AppState;
  actions: AppActions;
  context: string;
  userName: string;
  userEmail: string;
  userPicture: string | null;
  isAdmin: boolean;
  adminMode: boolean;
  onToggleAdminMode: (on: boolean) => void;
}) {
  const [coach, setCoach] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [notif, setNotif] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const fileRef = useRef<HTMLInputElement>(null);

  async function askCoach() {
    setLoading(true);
    setCoach("");
    try {
      setCoach(await coachMessage("encourage", context, ENCOURAGE_FALLBACK));
    } finally {
      setLoading(false);
    }
  }

  async function weeklyReview() {
    setReviewLoading(true);
    setReview("");
    try {
      setReview(await coachMessage("weeklyReview", context, REVIEW_FALLBACK));
    } finally {
      setReviewLoading(false);
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `muruk-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object") throw new Error("형식 오류");
        const base = defaultState();
        actions.replaceState({ ...base, ...parsed });
        onClose();
      } catch {
        alert("백업 파일을 읽지 못했어요. 올바른 JSON인지 확인해주세요.");
      }
    };
    reader.readAsText(file);
  }

  const remindOn = !!state.settings?.reminderEnabled;
  const remindTime = (state.settings?.reminderTime as string) || DEFAULT_REMINDER_TIME;

  async function enableNotif() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
    if (p === "granted") {
      actions.updateSettings({ reminderEnabled: true, reminderTime: remindTime });
      new Notification("무럭무럭", { body: `매일 ${remindTime}에 알려드릴게요! 오늘도 한 걸음 🌿` });
    }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <b style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 7 }}>
            <Icon name="settings" size={18} color="var(--primary-d)" /> 설정
          </b>
          <button className="x" aria-label="설정 닫기" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="card acct">
          {userPicture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userPicture} alt="" referrerPolicy="no-referrer" />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{userName}</div>
            <div className="muted">{userEmail}</div>
          </div>
          <button className="btn btn-soft" onClick={onLogout}>
            로그아웃
          </button>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>AI 코칭</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={askCoach} disabled={loading}>
              {loading ? "…" : "오늘의 응원"}
            </button>
            <button className="btn btn-soft" onClick={weeklyReview} disabled={reviewLoading}>
              {reviewLoading ? "…" : "주간 회고"}
            </button>
          </div>
          {coach && <p style={{ marginTop: 14, lineHeight: 1.6 }}>{coach}</p>}
          {review && <p style={{ marginTop: 14, lineHeight: 1.6 }}>{review}</p>}
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>백업</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-soft" onClick={exportData}>내보내기</button>
            <button className="btn btn-soft" onClick={() => fileRef.current?.click()}>불러오기</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>매일 알림</h3>
          {notif !== "granted" ? (
            <>
              <p className="muted" style={{ margin: "0 0 10px" }}>정해진 시간에 오늘 남은 할 일을 살짝 알려드려요.</p>
              <button className="btn btn-soft" onClick={enableNotif} disabled={notif === "denied"}>
                {notif === "denied" ? "브라우저에서 차단됨" : "알림 켜기"}
              </button>
            </>
          ) : (
            <div className="remind-row">
              <label className="remind-toggle">
                <input type="checkbox" checked={remindOn} onChange={(e) => actions.updateSettings({ reminderEnabled: e.target.checked })} />
                <span>{remindOn ? "켜짐" : "꺼짐"}</span>
              </label>
              <input
                type="time"
                value={remindTime}
                disabled={!remindOn}
                onChange={(e) => actions.updateSettings({ reminderTime: e.target.value || DEFAULT_REMINDER_TIME })}
                className="remind-time"
              />
            </div>
          )}
          {notif === "granted" && remindOn && (
            <p className="muted" style={{ margin: "10px 0 0" }}>매일 {remindTime}, 앱을 열어두었거나 다시 열었을 때 알려드려요.</p>
          )}
        </div>

        {isAdmin && (
          <div className="card" style={{ border: "1.5px solid #ffe0b8", background: "#fffaf3" }}>
            <div className="remind-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: "0 0 2px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="settings" size={16} color="#c9912e" /> 관리자 모드
                </h3>
                <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>켜면 메인 화면이 모든 사용자 데이터로 전환돼요.</p>
              </div>
              <label className="remind-toggle">
                <input type="checkbox" checked={adminMode} onChange={(e) => onToggleAdminMode(e.target.checked)} />
                <span>{adminMode ? "켜짐" : "꺼짐"}</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 관리자 모드 메인 뷰 — 모든 사용자의 전체 데이터를 보여준다. */
function AdminView({ onExit }: { onExit: () => void }) {
  const [data, setData] = useState<AdminUserState[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      setData(await api.adminStates());
    } catch (e) {
      setData(null);
      setErr((e as Error).message === "UNAUTHORIZED" ? "로그인이 필요해요." : "불러오기 실패 — 백엔드 ADMIN_EMAILS 설정을 확인하세요.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const users = (data ?? []).filter((u) => {
    if (!q.trim()) return true;
    const s = (u.name + " " + u.email).toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  return (
    <section>
      <div className="sec-title">
        <h2 style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="settings" size={18} color="#c9912e" /> 관리자 모드
        </h2>
        <button className="link" onClick={onExit}>내 화면으로</button>
      </div>

      <div className="addbar" style={{ margin: "0 0 12px" }}>
        <input value={q} placeholder="이름·이메일 검색" onChange={(e) => setQ(e.target.value)} />
        <button className="btn-soft" style={{ borderRadius: 14, padding: "0 16px", border: "none", fontWeight: 800, cursor: "pointer" }} onClick={load} disabled={loading}>
          {loading ? "…" : "새로고침"}
        </button>
      </div>

      {err && <div className="empty" style={{ color: "var(--muted)" }}>⚠️ {err}</div>}
      {!err && (
        <div className="muted" style={{ fontWeight: 800, margin: "0 4px 10px" }}>
          사용자 {data?.length ?? 0}명{q.trim() && ` · 검색결과 ${users.length}명`}
        </div>
      )}

      {users.map((u) => {
        const dreamsArr = (Array.isArray(u.data?.dreams) ? u.data!.dreams! : []) as Array<{ title?: string; targetDate?: string | null; goals?: Array<{ title?: string; repeat?: string }> }>;
        const todosArr = (Array.isArray(u.data?.todos) ? u.data!.todos! : []) as Array<{ text?: string; date?: string; done?: boolean }>;
        const doneTodos = todosArr.filter((t) => t.done).length;
        const totalDone = typeof u.data?.totalDone === "number" ? u.data!.totalDone : 0;
        const bestStreak = typeof u.data?.bestStreak === "number" ? u.data!.bestStreak : 0;
        return (
          <details key={u.userId} className="admin-row">
            <summary>
              <b>{u.name}</b> <span className="muted">{u.email}</span>
              <span className="admin-counts">목표 {dreamsArr.length} · 할일 {todosArr.length} · 완료 {totalDone}</span>
            </summary>
            <div className="muted" style={{ fontSize: 11.5, margin: "4px 0 6px" }}>
              최근접속 {u.lastSeenAt?.slice(0, 10) ?? "-"} · 저장 {u.updatedAt?.slice(0, 10) ?? "-"} · v{u.version} · 누적완료 {totalDone} · 최고연속 {bestStreak}
            </div>
            {dreamsArr.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>저장된 목표 없음</div>
            ) : (
              dreamsArr.map((dr, i) => (
                <div key={i} className="admin-dream">
                  <div style={{ fontWeight: 700 }}>
                    🎯 {dr.title || "(제목 없음)"}
                    {dr.targetDate ? <span className="muted"> · D-day {dr.targetDate}</span> : null}
                    <span className="muted"> · 할일 {dr.goals?.length ?? 0}</span>
                  </div>
                  {dr.goals && dr.goals.length > 0 && (
                    <ul className="admin-goals">
                      {dr.goals.map((g, j) => (
                        <li key={j}>{g.title} <span className="muted">({g.repeat === "daily" ? "매일" : "한 번"})</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>할 일 기록: 총 {todosArr.length}개 · 완료 {doneTodos}개</div>
            <details className="admin-raw">
              <summary>원본 JSON</summary>
              <pre className="admin-json">{JSON.stringify(u.data, null, 2)}</pre>
            </details>
          </details>
        );
      })}
    </section>
  );
}
