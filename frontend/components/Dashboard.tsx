"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { clearToken, getUser } from "@/lib/auth";
import { streakCount, totalStickers } from "@/lib/state";
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
  const user = getUser();

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
        <div className="tagline">작심삼일도, 꾸준히 하면 됩니다 🌿{syncing ? " · 동기화 중…" : ""}</div>
        <div className="toprow">
          <div className="stat">
            <div className="v">{streak}일째</div>
            <div className="l">🔥 연속 기록</div>
          </div>
          <div className="stat">
            <div className="v">{stickers}개</div>
            <div className="l">🌟 모은 스티커</div>
          </div>
          <div className="stat">
            <div className="v">{state.totalDone}개</div>
            <div className="l">✅ 누적 완료</div>
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
        <NavBtn icon="🌱" label="나의 목표" active={tab === "dreams"} onClick={() => setTab("dreams")} />
        <NavBtn icon="☀️" label="오늘" active={tab === "today"} onClick={() => setTab("today")} />
        <NavBtn icon="🌳" label="칭찬나무" active={tab === "stickers"} onClick={() => setTab("stickers")} />
        <NavBtn icon="📈" label="기록" active={tab === "records"} onClick={() => setTab("records")} />
      </nav>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>

      {gold && (
        <div className="modal-bg" onClick={clearGold}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: stampSVG(150) }} />
            <h3 style={{ margin: "10px 0 6px" }}>참 잘했어요! 🎉</h3>
            <p className="muted">“{gold}” 스티커판을 가득 채웠어요. 도장을 쾅!</p>
            <button className="btn" style={{ width: "100%" }} onClick={clearGold}>
              최고예요! 🎉
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
  context,
  userName,
  userEmail,
  userPicture,
}: {
  onClose: () => void;
  onLogout: () => void;
  context: string;
  userName: string;
  userEmail: string;
  userPicture: string | null;
}) {
  const [coach, setCoach] = useState("");
  const [loading, setLoading] = useState(false);

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
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>🤖 AI 코칭</h3>
          <p className="muted" style={{ marginBottom: 12 }}>내 기록을 보고 Claude가 맞춤 응원을 건네요.</p>
          <button className="btn" onClick={askCoach} disabled={loading}>
            {loading ? "생각 중…" : "오늘의 응원 받기"}
          </button>
          {coach && <p style={{ marginTop: 14, lineHeight: 1.6 }}>{coach}</p>}
        </div>

        <p className="muted" style={{ textAlign: "center" }}>데이터는 계정에 묶여 클라우드(Postgres)에 저장돼요.</p>
      </div>
    </div>
  );
}
