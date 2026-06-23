"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { clearToken, getUser } from "@/lib/auth";
import { AppState, defaultState, streakCount, totalStickers } from "@/lib/state";
import type { AppActions } from "@/lib/store";
import { stampSVG } from "@/lib/trees";
import { useAppState } from "@/lib/store";
import { TodayTab } from "./tabs/TodayTab";
import { DreamsTab } from "./tabs/DreamsTab";
import { StickersTab } from "./tabs/StickersTab";
import { RecordsTab } from "./tabs/RecordsTab";

type Tab = "dreams" | "today" | "stickers" | "records";

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { state, syncing, toast, gold, clearGold, actions } = useAppState();
  const [tab, setTab] = useState<Tab>("today");
  const [settings, setSettings] = useState(false);
  const [celebrate, setCelebrate] = useState("");
  const user = getUser();

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
          무럽무럽<span className="dot">.</span>
        </div>
        {syncing && <div className="tagline">저장 중…</div>}
        <div className="toprow">
          <div className="stat">
            <div className="v">{streak}</div>
            <div className="l">연속</div>
          </div>
          <div className="stat">
            <div className="v">{stickers}</div>
            <div className="l">스티커</div>
          </div>
          <div className="stat">
            <div className="v">{state.totalDone}</div>
            <div className="l">완료</div>
          </div>
        </div>
      </header>

      <main>
        {tab === "today" && <TodayTab state={state} actions={actions} />}
        {tab === "dreams" && <DreamsTab state={state} actions={actions} />}
        {tab === "stickers" && <StickersTab state={state} />}
        {tab === "records" && <RecordsTab state={state} />}
      </main>

      <nav>
        <NavBtn icon="🌱" label="목표" active={tab === "dreams"} onClick={() => setTab("dreams")} />
        <NavBtn icon="☀️" label="오늘" active={tab === "today"} onClick={() => setTab("today")} />
        <NavBtn icon="🌳" label="칭찬나무" active={tab === "stickers"} onClick={() => setTab("stickers")} />
        <NavBtn icon="📈" label="기록" active={tab === "records"} onClick={() => setTab("records")} />
      </nav>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>

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

  async function enableNotif() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
    if (p === "granted") new Notification("무럽무럽", { body: "알림이 켜졌어요! 오늘도 한 걸음 🌿" });
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <b style={{ fontSize: 17 }}>⚙️ 설정</b>
          <button className="x" onClick={onClose}>
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
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>알림</h3>
          <button className="btn btn-soft" onClick={enableNotif} disabled={notif !== "default"}>
            {notif === "granted" ? "켜짐" : notif === "denied" ? "차단됨" : "알림 켜기"}
          </button>
        </div>
      </div>
    </div>
  );
}
