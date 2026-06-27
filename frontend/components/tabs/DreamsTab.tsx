"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AppActions } from "@/lib/store";
import { AppState, CAT_ORDER, Dream, PALETTE, Repeat, TEMPLATES, THEMES, boardCap, dateStr, ddayText, isHabitDream, template, todayStr } from "@/lib/state";
import { boardSVG, gridBoardSVG, stampSVG } from "@/lib/trees";
import { Icon, catIconName, hasIcon } from "../Icon";
import { IconPicker } from "../IconPicker";
import { Calendar } from "../Calendar";

interface CatMeta {
  key: string;
  emoji: string;
  label: string;
  ph: string;
  color: string;
}

export function DreamsTab({ state, actions }: { state: AppState; actions: AppActions }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("free");
  const [color, setColor] = useState(TEMPLATES.free.color);
  const [theme, setTheme] = useState("tree");
  const [title, setTitle] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [ce, setCe] = useState("🎨");
  const [cl, setCl] = useState("");
  const [deco, setDeco] = useState(false);

  const presets: CatMeta[] = CAT_ORDER.map((c) => ({ key: c, emoji: TEMPLATES[c].emoji, label: TEMPLATES[c].label, ph: TEMPLATES[c].ph, color: TEMPLATES[c].color }));
  const customs: CatMeta[] = state.customCats.map((c) => ({ key: c.key, emoji: c.emoji, label: c.label, ph: c.ph, color: c.color }));
  const allCats = [...presets, ...customs];
  const meta = allCats.find((c) => c.key === cat) ?? presets[presets.length - 1];

  function pickCat(c: CatMeta) {
    setCat(c.key);
    setColor(c.color);
  }
  function create() {
    const v = title.trim();
    if (!v) return;
    actions.addDream({ title: v, cat, color, theme, emoji: meta.emoji });
    setTitle("");
    setOpen(false);
  }
  function addCustom() {
    const label = cl.trim();
    if (!label) return;
    actions.addCustomCat({ emoji: ce.trim() || "🎯", label, color });
    setCl("");
    setCe("🎨");
    setCatOpen(false);
  }

  return (
    <section>
      <div className="sec-title">
        <h2>나의 목표</h2>
      </div>

      <button className="newdream-btn" onClick={() => setOpen((o) => !o)}>
        {open ? "닫기" : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="add" size={16} color="var(--primary-d)" /> 새 목표</span>}
      </button>

      {open && (
        <div className="card newdream">
          <div className="field-label">어떤 목표예요?</div>
          <div className="row-wrap">
            {allCats.map((c) => {
              const ic = catIconName(c.key);
              const on = c.key === cat;
              return (
                <div key={c.key} className={"chip" + (on ? " on" : "")} onClick={() => pickCat(c)}>
                  {ic ? <Icon name={ic} size={15} color={on ? "#fff" : c.color} /> : <span>{c.emoji}</span>} {c.label}
                </div>
              );
            })}
            <div className="chip" onClick={() => setCatOpen((o) => !o)}>
              ＋ 직접
            </div>
          </div>

          {catOpen && (
            <div className="addbar" style={{ marginBottom: 12 }}>
              <input style={{ flex: "0 0 56px", textAlign: "center" }} value={ce} maxLength={2} onChange={(e) => setCe(e.target.value)} />
              <input value={cl} placeholder="카테고리 이름 (예: 독서)" maxLength={10} onChange={(e) => setCl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addCustom()} />
              <button onClick={addCustom}>추가</button>
            </div>
          )}

          <button className="link deco-toggle" onClick={() => setDeco((o) => !o)}>
            {deco ? "꾸미기 닫기 ▴" : "🎨 색·칭찬판 모양 바꾸기 ▾"}
          </button>
          {deco && (
            <>
              <div className="field-label">색</div>
              <div className="row-wrap">
                {PALETTE.map((c) => (
                  <div key={c} className={"sw" + (c.toLowerCase() === color.toLowerCase() ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
              <div className="field-label">칭찬판 모양</div>
              <div className="row-wrap">
                {THEMES.map((t) => (
                  <button key={t.key} className={"theme-opt" + (t.key === theme ? " on" : "")} onClick={() => setTheme(t.key)}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="goal-add">
            <input value={title} placeholder={meta.ph} maxLength={40} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && create()} />
            <button onClick={create}>추가</button>
          </div>
        </div>
      )}

      {(() => {
        const active = state.dreams.filter((d) => !d.done);
        if (active.length === 0) {
          return (
            <div className="empty">
              {state.dreams.length === 0 ? "목표를 하나 세워보세요." : "진행 중인 목표가 없어요. 기록 탭에서 이룬 목표를 볼 수 있어요."}
            </div>
          );
        }
        return active.map((d) => <DreamCard key={d.id} dream={d} state={state} actions={actions} />);
      })()}
    </section>
  );
}

function DreamCard({ dream: d, state, actions }: { dream: Dream; state: AppState; actions: AppActions }) {
  const [goalText, setGoalText] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [aiTasks, setAiTasks] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(d.title);
  const [editGoalId, setEditGoalId] = useState("");
  const [goalVal, setGoalVal] = useState("");
  const [iconOpen, setIconOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [faceH, setFaceH] = useState<number>();
  const color = d.color || template(d.cat).color;
  const tpl = template(d.cat);
  // 진행도: 분모는 '할 일 개수'. 매일 할일은 '오늘 완료'로, 한 번 할일은 '완료한 적 있으면'으로 판정.
  const goalDone = (g: { id: string; repeat: Repeat }) =>
    g.repeat === "daily"
      ? state.todos.some((t) => t.goalId === g.id && t.date === todayStr() && t.done)
      : state.todos.some((t) => t.goalId === g.id && t.done);
  const total = d.goals.length;
  const doneN = d.goals.filter(goalDone).length;
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  const habit = isHabitDream(d);
  const dd = ddayText(d.targetDate);
  const used = d.goals.map((g) => g.title);
  const sugg = (tpl.goals || []).filter((s) => !used.includes(s));

  // 'YYYY-MM-DD' → 'M/D'
  const md = (s?: string | null) => {
    if (!s) return "";
    const p = s.split("-");
    return p.length === 3 ? `${+p[1]}/${+p[2]}` : s;
  };

  // 날짜별 완료 스트립(최근 7일)
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    return dt;
  });

  // 뒤집힌 면(칭찬판) 렌더 정보
  const cap = boardCap(d);
  const boardLen = d.stickers?.length ?? 0;
  const boardGold = boardLen >= cap;
  const themeEmoji = THEMES.find((t) => t.key === d.theme)?.emoji || "🌳";
  const boardHtml = cap <= 10 ? boardSVG(d, d.theme || "tree", cap) : gridBoardSVG(d, cap, color, themeEmoji);

  // 카드 높이를 현재 보이는 면에 맞춰 부드럽게 조절(앞/뒷면 높이가 달라도 자연스럽게).
  useLayoutEffect(() => {
    const measure = () => {
      const el = flipped ? backRef.current : frontRef.current;
      if (el) setFaceH(el.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frontRef.current) ro.observe(frontRef.current);
    if (backRef.current) ro.observe(backRef.current);
    return () => ro.disconnect();
  }, [flipped]);

  // 직접 입력은 선택한 종류(repeat)를 따르고, 추천/AI 칩은 대부분 한 번짜리라 'once' 기본.
  function addGoal(t: string, rep: Repeat = repeat) {
    const v = t.trim();
    if (!v) return;
    actions.addGoal(d.id, v, rep);
    setGoalText("");
  }

  async function aiSuggest() {
    setAiLoading(true);
    setAiTasks([]);
    setAiMsg("");
    try {
      const ctx = JSON.stringify({ 목표: d.title, 카테고리: tpl.label, 이미있는할일: used });
      const { message } = await api.coach("suggestTasks", ctx);
      const lines = message
        .split("\n")
        .map((l) => l.replace(/^[\s\d.\-*•")(]+/, "").trim())
        .filter((l) => l.length > 0 && l.length <= 30 && !used.includes(l))
        .slice(0, 5);
      setAiTasks(lines);
      // 결과 줄이 없으면(키 미설정 안내문 등 비정상 응답) 사용자에게 알린다.
      if (lines.length === 0) setAiMsg(message.includes("ANTHROPIC_API_KEY") ? "서버에 AI 키가 설정되지 않았어요." : "추천을 받지 못했어요. 잠시 후 다시 시도해 주세요.");
    } catch (e) {
      setAiMsg((e as Error).message === "UNAUTHORIZED" ? "로그인이 필요해요." : "AI 추천을 불러오지 못했어요. (네트워크/서버 확인)");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flip" style={{ height: faceH }}>
      <div className={"flip-inner" + (flipped ? " flipped" : "")}>
        <div className="flip-face flip-front" ref={frontRef} aria-hidden={flipped}>
          <div className="dream">
      <div className="dream-h">
        <span className="dream-emoji" style={{ background: color + "22" }} onClick={() => setIconOpen(true)} title="아이콘 변경">
          {(() => {
            const v = d.icon || catIconName(d.cat) || d.emoji || "🎯";
            return hasIcon(v) ? <Icon name={v} size={20} color={color} /> : <span>{v}</span>;
          })()}
        </span>
        {iconOpen && (
          <IconPicker color={color} onClose={() => setIconOpen(false)} onPick={(v) => { actions.setDreamIcon(d.id, v); setIconOpen(false); }} />
        )}
        {editTitle ? (
          <input
            className="rename-input t"
            value={titleVal}
            autoFocus
            maxLength={40}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={() => { actions.renameDream(d.id, titleVal); setEditTitle(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { actions.renameDream(d.id, titleVal); setEditTitle(false); }
              if (e.key === "Escape") { setTitleVal(d.title); setEditTitle(false); }
            }}
          />
        ) : (
          <>
            <span className="t" onClick={() => actions.toggleCollapse(d.id)}>
              {d.title}
            </span>
            <button className="icon-btn" aria-label="목표 이름 수정" onClick={() => { setTitleVal(d.title); setEditTitle(true); }}>
              <Icon name="edit" size={15} />
            </button>
          </>
        )}
        {!editTitle && (
          <button className="boardflip" aria-label="칭찬판 보기" style={{ background: color + "1f", color }} onClick={() => setFlipped(true)}>
            <Icon name="tree" size={16} color={color} /> 칭찬판
          </button>
        )}
        {!editTitle && isHabitDream(d) && (
          <button
            className="achieve"
            aria-label="목표 마치기"
            title="이 목표를 달성으로 보관해요"
            onClick={() => confirm(`‘${d.title}’을(를) 달성으로 보관할까요?\n보관하면 기록 탭에서 볼 수 있어요.`) && actions.completeDream(d.id)}
          >
            <Icon name="best" size={15} color="#caa12e" /> 마치기
          </button>
        )}
        {!editTitle && (
          <button className="x" aria-label="목표 삭제" onClick={() => confirm("이 목표와 할 일을 삭제할까요?") && actions.removeDream(d.id)}>
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      {!d.collapsed && (
        <>
          <div className="progress">
            <i style={{ width: pct + "%", background: `linear-gradient(90deg, ${color}88, ${color})` }} />
          </div>
          <div className="progress-l">{total ? `${habit ? "오늘 " : ""}${doneN}/${total} · ${pct}%` : ""}</div>

          {d.targetDate ? (
            <div className="dday-line">
              <Icon name="calendar" size={13} color={color} />
              <button className="dday-pick" onClick={() => setCalOpen(true)} title="날짜 변경">
                {d.ddayStart ? `${md(d.ddayStart)} 시작 · ` : ""}{(tpl.ddayLabel || "디데이")} {md(d.targetDate)}
              </button>
              <b style={{ color }}>{dd}</b>
              <button className="link" onClick={() => actions.setDday(d.id, "")}>해제</button>
            </div>
          ) : (
            <div className="dday-line">
              <Icon name="calendar" size={13} color="var(--muted)" />
              <span className="muted">디데이</span>
              <button className="dday-pick" onClick={() => setCalOpen(true)}>날짜 선택</button>
            </div>
          )}
          {calOpen && (
            <Calendar
              value={d.targetDate}
              color={color}
              onPick={(ds) => { actions.setDday(d.id, ds); setCalOpen(false); }}
              onClose={() => setCalOpen(false)}
            />
          )}

          {d.goals.map((g) => {
            const onceDone = state.todos.some((t) => t.goalId === g.id && t.done);
            return (
              <div className="goalblock" key={g.id}>
                <div className={"goal" + (g.repeat === "once" && onceDone ? " done" : "")}>
                  {g.repeat === "once" && editGoalId !== g.id && (
                    <button
                      className={"g-check" + (onceDone ? " on" : "")}
                      style={onceDone ? { background: color, borderColor: color } : undefined}
                      onClick={() => actions.toggleGoalDone(g.id)}
                      aria-label={onceDone ? "완료 취소" : "완료"}
                    >
                      {onceDone && <Icon name="check" size={12} color="#fff" />}
                    </button>
                  )}
                  {editGoalId === g.id ? (
                    <input
                      className="rename-input g-t"
                      value={goalVal}
                      autoFocus
                      maxLength={40}
                      onChange={(e) => setGoalVal(e.target.value)}
                      onBlur={() => { actions.renameGoal(d.id, g.id, goalVal); setEditGoalId(""); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) { actions.renameGoal(d.id, g.id, goalVal); setEditGoalId(""); }
                        if (e.key === "Escape") setEditGoalId("");
                      }}
                    />
                  ) : (
                    <span className="g-t" onClick={() => { setEditGoalId(g.id); setGoalVal(g.title); }} title="눌러서 이름 수정">{g.title}</span>
                  )}
                  {editGoalId !== g.id && (
                    <>
                      <button className={"gt-badge" + (g.repeat === "daily" ? " daily" : "")} onClick={() => actions.toggleGoalRepeat(d.id, g.id)} title="눌러서 '한 번 ↔ 매일' 전환">
                        <Icon name={g.repeat === "daily" ? "daily" : "once"} size={13} color="currentColor" /> {g.repeat === "daily" ? "매일" : "한 번"}
                      </button>
                      <button className="x" aria-label="할 일 삭제" onClick={() => actions.removeGoal(d.id, g.id)}>
                        <Icon name="close" size={14} />
                      </button>
                    </>
                  )}
                </div>
                {editGoalId !== g.id && g.repeat === "daily" && (
                  <div className="goal-week">
                    {last7.map((dt) => {
                      const ds = dateStr(dt);
                      const done = state.todos.some((t) => t.goalId === g.id && t.date === ds && t.done);
                      const isToday = ds === todayStr();
                      return (
                        <button
                          key={ds}
                          className={"daydot" + (done ? " on" : "") + (isToday ? " today" : "")}
                          style={done ? { background: color, borderColor: color } : undefined}
                          onClick={() => actions.toggleGoalDay(g.id, ds)}
                          aria-label={`${ds} ${done ? "완료 취소" : "완료"}`}
                        >
                          <span className="dd-w">{WD[dt.getDay()]}</span>
                          <span className="dd-n">{dt.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {sugg.length > 0 && (
            <div style={{ marginTop: 11 }}>
              <div className="muted" style={{ fontWeight: 700, marginBottom: 7 }}>추천</div>
              <div className="row-wrap">
                {sugg.map((s) => (
                  <span key={s} className="chip" onClick={() => addGoal(s, "once")}>
                    + {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiMsg && (
            <div className="muted" style={{ marginTop: 10, fontWeight: 700 }}>⚠️ {aiMsg}</div>
          )}

          {aiTasks.length > 0 && (
            <div style={{ marginTop: 11 }}>
              <div className="muted" style={{ fontWeight: 700, marginBottom: 7 }}>AI 추천 (눌러서 추가)</div>
              <div className="row-wrap">
                {aiTasks.map((s) => (
                  <span key={s} className="chip" onClick={() => { addGoal(s, "once"); setAiTasks((p) => p.filter((x) => x !== s)); }}>
                    + {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="taskadd">
            <div className="taskadd-row">
              <button className={"type-toggle" + (repeat === "daily" ? " daily" : "")} onClick={() => setRepeat(repeat === "once" ? "daily" : "once")} title="한 번 ↔ 매일 전환">
                <Icon name={repeat === "daily" ? "daily" : "once"} size={12} color="currentColor" /> {repeat === "daily" ? "매일" : "한 번"}
              </button>
              <div className="ta-input">
                <input value={goalText} placeholder="할 일 추가" maxLength={40} onChange={(e) => setGoalText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addGoal(goalText)} />
                <button className="ta-ai" onClick={aiSuggest} disabled={aiLoading} aria-label="AI 추천" title="AI로 할 일 추천">
                  <Icon name="ai" size={17} color="var(--primary-d)" />
                </button>
              </div>
              <button className="ta-add" onClick={() => addGoal(goalText)}>추가</button>
            </div>
          </div>
        </>
      )}
          </div>
        </div>

        <div className="flip-face flip-back" ref={backRef} aria-hidden={!flipped}>
          <div className="dream board-back">
            <div className="dream-h">
              <span className="dream-emoji" style={{ background: color + "22" }}>
                {(() => {
                  const v = d.icon || catIconName(d.cat) || d.emoji || "🎯";
                  return hasIcon(v) ? <Icon name={v} size={20} color={color} /> : <span>{v}</span>;
                })()}
              </span>
              <span className="t">{d.title}</span>
              <span className="muted" style={{ fontWeight: 800, color }}>{boardGold ? "완성!" : `${boardLen}/${cap}`}</span>
              <button className="icon-btn" aria-label="목표로 돌아가기" onClick={() => setFlipped(false)}><Icon name="back" size={17} /></button>
            </div>
            <div className="board-back-art">
              <div dangerouslySetInnerHTML={{ __html: boardHtml }} />
              {boardGold && <div className="board-stamp" dangerouslySetInnerHTML={{ __html: stampSVG(62) }} />}
            </div>
            <div className="muted board-back-foot">
              {d.stamps ? `도장 ${d.stamps}개 · ` : ""}
              {boardLen === 0 ? "할 일을 완료하면 스티커가 쌓여요" : `스티커 ${d.earned ?? boardLen}개`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
