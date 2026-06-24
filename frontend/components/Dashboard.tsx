"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { clearToken, getUser } from "@/lib/auth";
import { AppState, defaultState, streakCount, totalStickers } from "@/lib/state";
import type { AppActions } from "@/lib/store";
import type { AdminUserState } from "@/lib/types";
import { stampSVG } from "@/lib/trees";
import { useAppState } from "@/lib/store";
import { useDailyReminder, DEFAULT_REMINDER_TIME } from "@/lib/reminder";
import { TodayTab } from "./tabs/TodayTab";
import { DreamsTab } from "./tabs/DreamsTab";
import { RecordsTab } from "./tabs/RecordsTab";

type Tab = "dreams" | "today" | "records";

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { state, syncing, toast, gold, clearGold, undoLabel, runUndo, actions } = useAppState();
  const [tab, setTab] = useState<Tab>("today");
  const [settings, setSettings] = useState(false);
  const [celebrate, setCelebrate] = useState("");
  const routed = useRef(false);
  const user = getUser();

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
    api
      .coach("celebrate", JSON.stringify({ 완성한목표: gold, 누적완료: state?.totalDone ?? 0 }))
      .then((r) => alive && setCelebrate(r.message))
      .catch(() => {});
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
        <button className="gear" onClick={() => setSettings(true)} aria-label="설정">
          ⚙️
        </button>
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="logo-ic" />
          <span>
            무럽무럽<span className="dot">.</span>
          </span>
        </div>
        {syncing && <div className="tagline">저장 중…</div>}
      </header>

      <main>
        {tab === "today" && <TodayTab state={state} actions={actions} />}
        {tab === "dreams" && <DreamsTab state={state} actions={actions} />}
        {tab === "records" && <RecordsTab state={state} />}
      </main>

      <nav>
        <NavBtn icon="🌱" label="목표" active={tab === "dreams"} onClick={() => setTab("dreams")} />
        <NavBtn icon="☀️" label="오늘" active={tab === "today"} onClick={() => setTab("today")} />
        <NavBtn icon="📈" label="기록" active={tab === "records"} onClick={() => setTab("records")} />
      </nav>

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
        />
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "on" : ""} onClick={onClick}>
      <span className="ni">{icon}</span>
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
}: {
  onClose: () => void;
  onLogout: () => void;
  state: AppState;
  actions: AppActions;
  context: string;
  userName: string;
  userEmail: string;
  userPicture: string | null;
}) {
  const [coach, setCoach] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [notif, setNotif] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const fileRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState<AdminUserState[] | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    api.me().then((m) => setIsAdmin(!!m.isAdmin)).catch(() => {});
  }, []);

  async function loadAdmin() {
    setAdminLoading(true);
    try {
      setAdminData(await api.adminStates());
    } catch {
      setAdminData(null);
    } finally {
      setAdminLoading(false);
    }
  }

  async function askCoach() {
    setLoading(true);
    setCoach("");
    try {
      const { message } = await api.coach("encourage", context);
      setCoach(message);
    } catch (e) {
      setCoach("코칭을 불러오지 못했어요: " + String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function weeklyReview() {
    setReviewLoading(true);
    setReview("");
    try {
      const { message } = await api.coach("weeklyReview", context);
      setReview(message);
    } catch {
      setReview("회고를 불러오지 못했어요.");
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
      new Notification("무럽무럽", { body: `매일 ${remindTime}에 알려드릴게요! 오늘도 한 걸음 🌿` });
    }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <b style={{ fontSize: 17 }}>⚙️ 설정</b>
          <button className="x" aria-label="설정 닫기" onClick={onClose}>
            ✕
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
            <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>🛠 관리자 — 전체 데이터</h3>
            <p className="muted" style={{ margin: "0 0 10px" }}>모든 사용자의 목표·할 일 데이터를 조회합니다.</p>
            <button className="btn btn-soft" onClick={loadAdmin} disabled={adminLoading}>
              {adminLoading ? "불러오는 중…" : adminData ? "새로고침" : "전체 데이터 보기"}
            </button>
            {adminData && (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontWeight: 800, marginBottom: 8 }}>사용자 {adminData.length}명</div>
                {adminData.map((u) => {
                  const dreams = Array.isArray(u.data?.dreams) ? u.data!.dreams!.length : 0;
                  const todos = Array.isArray(u.data?.todos) ? u.data!.todos!.length : 0;
                  const done = typeof u.data?.totalDone === "number" ? u.data!.totalDone : 0;
                  return (
                    <details key={u.userId} className="admin-row">
                      <summary>
                        <b>{u.name}</b> <span className="muted">{u.email}</span>
                        <span className="admin-counts">목표 {dreams} · 할일 {todos} · 완료 {done}</span>
                      </summary>
                      <div className="muted" style={{ fontSize: 11.5, margin: "4px 0 6px" }}>
                        최근접속 {u.lastSeenAt?.slice(0, 10) ?? "-"} · 저장 {u.updatedAt?.slice(0, 10) ?? "-"} · v{u.version}
                      </div>
                      <pre className="admin-json">{JSON.stringify(u.data, null, 2)}</pre>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
