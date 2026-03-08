import { useState, useEffect } from "react";

const CATEGORY_COLORS = {
  "Nzonzi":     { tag: "bg-orange-700 text-amber-50",   dot: "bg-orange-700",  blockL: "#c05a20" },
  "Thesis":     { tag: "bg-stone-700 text-amber-50",    dot: "bg-stone-700",   blockL: "#78573a" },
  "Job Search": { tag: "bg-amber-800 text-amber-50",    dot: "bg-amber-800",   blockL: "#a06030" },
  "Personal":   { tag: "bg-stone-500 text-amber-50",    dot: "bg-stone-500",   blockL: "#9a7a5a" },
  "Other":      { tag: "bg-stone-400 text-stone-900",   dot: "bg-stone-400",   blockL: "#b09070" },
};

const URGENCY = { high: "🔴 HIGH", medium: "🟡 SOON", low: "🟢 WAIT" };
const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];

function parseMinutes(est = "") {
  const s = est.toLowerCase();
  let t = 0;
  const h = s.match(/(\d+(\.\d+)?)\s*hr/);
  const m = s.match(/(\d+)\s*min/);
  if (h) t += parseFloat(h[1]) * 60;
  if (m) t += parseInt(m[1]);
  return t || 60;
}

function fmtMins(m) {
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ""}`;
}

function distributeToGrid(tasks) {
  const dayMins = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
  const grid = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
  const sorted = [...tasks].sort((a, b) => a.urgency === "high" ? -1 : 1);
  for (const task of sorted) {
    const mins = parseMinutes(task.time_estimate);
    const day = DAYS.reduce((a, b) => dayMins[a] <= dayMins[b] ? a : b);
    if (dayMins[day] + mins <= 480) { grid[day].push({ ...task, mins }); dayMins[day] += mins; }
  }
  return { grid, dayMins };
}

function gcalUrl(task) {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - now.getDay() + 1);
  mon.setHours(9, 0, 0, 0);
  const s = mon.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const e = new Date(mon.getTime() + parseMinutes(task.time_estimate) * 60000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.task)}&dates=${s}/${e}&details=${encodeURIComponent(task.why_now || "")}`;
}

// Palette
const P = {
  bg:         "#e8d9c0",  // tan base
  bgCard:     "#dfcfb0",  // slightly deeper tan for cards
  bgInput:    "#f0e4cc",  // lighter tan for inputs
  border:     "#b89a72",  // warm brown border
  borderDark: "#7a5230",  // dark brown accent border
  text:       "#2e1f0e",  // dark brown primary text
  textMid:    "#6b4828",  // mid brown
  textMuted:  "#9a7a55",  // muted tan-brown
  accent:     "#7a3f10",  // deep brown accent
  accentHov:  "#5c2e08",
  orange:     "#c05a18",  // burnt orange for urgency/cta
  warn:       "#a04010",
};

const Cursor = () => <span className="inline-block w-2 h-4 animate-pulse ml-0.5 align-middle" style={{ background: P.accent }} />;

export default function App() {
  const [screen, setScreen] = useState("input");
  const [dump, setDump] = useState("");
  const [weekCtx, setWeekCtx] = useState("");
  const [standing, setStanding] = useState("");
  const [editStanding, setEditStanding] = useState(false);
  const [tempStanding, setTempStanding] = useState("");
  const [result, setResult] = useState(null);
  const [view, setView] = useState("list");
  const [error, setError] = useState("");
  const [quickAdd, setQuickAdd] = useState("");
  const [nextWeek, setNextWeek] = useState([]);
  const [showQA, setShowQA] = useState(false);
  const [checked, setChecked] = useState({});
  const [loadingDots, setLoadingDots] = useState("");

  useEffect(() => {
    const sc = localStorage.getItem("ue_standing");
    const nw = localStorage.getItem("ue_next_week");
    if (sc) setStanding(sc);
    if (nw) try { setNextWeek(JSON.parse(nw)); } catch {}
  }, []);

  useEffect(() => {
    if (screen !== "loading") return;
    const id = setInterval(() => setLoadingDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(id);
  }, [screen]);

  const saveStanding = () => {
    localStorage.setItem("ue_standing", tempStanding);
    setStanding(tempStanding);
    setEditStanding(false);
  };

  const addNextWeek = () => {
    if (!quickAdd.trim()) return;
    const u = [...nextWeek, quickAdd.trim()];
    setNextWeek(u);
    localStorage.setItem("ue_next_week", JSON.stringify(u));
    setQuickAdd("");
  };

  const removeNextWeek = (i) => {
    const u = nextWeek.filter((_, idx) => idx !== i);
    setNextWeek(u);
    localStorage.setItem("ue_next_week", JSON.stringify(u));
  };

  const useNextWeekDump = () => {
    setDump(p => p ? p + "\n" + nextWeek.join("\n") : nextWeek.join("\n"));
    setNextWeek([]);
    localStorage.removeItem("ue_next_week");
  };

  const handleGenerate = async () => {
    if (!dump.trim()) return;
    setScreen("loading");
    setError("");
    setChecked({});

    const sys = `You are a strategic weekly planner for Uchenna, MA student (finishing May 2026) and co-founder of Nzonzi — a research communications and PR agency for African and Global African scholars. Active tracks: Nzonzi (pre-revenue, converting warm-network clients), MA thesis on Afropolitan studies, job search (IIE/Gilman Communications Analyst), personal logistics. Active grants: Research Revival Fund, Liberation Ventures, Workers Lab, Venture Lab. Always use active voice. Prioritize revenue-generating Nzonzi activities over infrastructure.

Return ONLY valid JSON, no markdown, no preamble:
{"this_week":[{"task":"","category":"Nzonzi"|"Thesis"|"Job Search"|"Personal"|"Other","time_estimate":"","why_now":"","urgency":"high"|"medium"|"low"}],"can_wait":[{"task":"","category":"","suggested_timing":"","note":""}],"watch_list":[{"task":"","concern":""}],"weekly_theme":"","top_3":["","",""]}
Sort this_week by urgency descending.`;

    try {
     const res = await fetch("/.netlify/functions/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: sys,
          messages: [{ role: "user", content: `Brain dump:\n${dump}${weekCtx ? `\n\nThis week: ${weekCtx}` : ""}${standing ? `\n\nStanding context: ${standing}` : ""}` }]
        })
      });
      const data = await res.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "";
      setResult(JSON.parse(raw.replace(/```json|```/g, "").trim()));
      setScreen("output");
    } catch {
      setError("// ERROR: parse failed. try again.");
      setScreen("input");
    }
  };

  const reset = () => { setScreen("input"); setResult(null); setDump(""); setWeekCtx(""); setView("list"); };

  const inputStyle = { background: P.bgInput, border: `1px solid ${P.border}`, color: P.text };
  const cardStyle  = { background: P.bgCard, border: `1px solid ${P.border}` };

  // ── LOADING ──
  if (screen === "loading") return (
    <div className="min-h-screen flex items-center justify-center font-mono" style={{ background: P.bg }}>
      <div className="text-left space-y-2">
        <p className="text-sm font-bold" style={{ color: P.accent }}>// INITIALIZING WEEKLY_PLAN.EXE</p>
        <p className="text-sm" style={{ color: P.textMid }}>parsing brain dump{loadingDots}</p>
        <p className="text-sm" style={{ color: P.textMuted }}>cross-referencing priorities...</p>
        <p className="text-sm" style={{ color: P.textMuted }}>building schedule...</p>
      </div>
    </div>
  );

  // ── OUTPUT ──
  if (screen === "output" && result) {
    const { grid, dayMins } = distributeToGrid(result.this_week || []);
    const done = Object.values(checked).filter(Boolean).length;
    const total = result.this_week?.length || 0;

    return (
      <div className="min-h-screen pb-28 font-mono" style={{ background: P.bg, color: P.text }}>
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">

          {/* Header */}
          <div className="pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-xs mb-1" style={{ color: P.textMuted }}>// KNOWLEDGE ARCHIVE: WEEKLY_PLAN.TXT</p>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: P.text }}>🗓️ WEEK.EXE <Cursor /></h1>
                <p className="text-sm mt-1 italic" style={{ color: P.textMid }}>{result.weekly_theme}</p>
              </div>
              <div className="flex gap-3 items-center text-xs mt-1">
                <button onClick={() => setView(v => v === "list" ? "grid" : "list")}
                  className="px-3 py-1 transition font-mono"
                  style={{ color: P.accent, border: `1px solid ${P.borderDark}` }}>
                  {view === "list" ? "⊞ BLOCKS" : "☰ LIST"}
                </button>
                <button onClick={reset} className="transition" style={{ color: P.textMuted }}>← NEW PLAN</button>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: P.textMuted }}>
              <span>PROGRESS: {done}/{total} tasks</span>
              <span>{fmtMins(Object.values(dayMins).reduce((a, b) => a + b, 0))} total</span>
            </div>
            <div className="h-1 w-full" style={{ background: P.border }}>
              <div className="h-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: P.accent }} />
            </div>
          </div>

          {/* Top 3 */}
          <div className="p-5 space-y-3" style={{ border: `2px solid ${P.borderDark}`, background: P.bgCard }}>
            <p className="text-xs tracking-widest" style={{ color: P.accent }}>🏆 // TOP_3.LOG</p>
            {result.top_3?.map((t, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="font-bold text-sm w-4 flex-shrink-0" style={{ color: P.orange }}>{i + 1}.</span>
                <span className="text-sm" style={{ color: P.text }}>{t}</span>
              </div>
            ))}
          </div>

          {/* Calendar export */}
          <div className="space-y-2">
            <p className="text-xs" style={{ color: P.textMuted }}>📅 // EXPORT TO GCAL → click to add event</p>
            <div className="flex flex-wrap gap-2">
              {result.this_week?.map((task, i) => (
                <a key={i} href={gcalUrl(task)} target="_blank" rel="noreferrer"
                  className="text-xs px-2 py-1 transition font-mono"
                  style={{ border: `1px solid ${P.border}`, color: P.textMid, background: P.bgInput }}>
                  + {task.task.length > 28 ? task.task.slice(0, 28) + "…" : task.task}
                </a>
              ))}
            </div>
          </div>

          {/* LIST VIEW */}
          {view === "list" && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: P.textMuted }}>✅ // THIS_WEEK.LOG — {total} tasks</p>
              {result.this_week?.map((item, i) => {
                const c = CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Other"];
                const isDone = checked[i];
                return (
                  <div key={i} onClick={() => setChecked(p => ({ ...p, [i]: !p[i] }))}
                    className="pl-4 py-3 cursor-pointer transition-all"
                    style={{ borderLeft: `3px solid ${isDone ? P.border : c.blockL}`, opacity: isDone ? 0.45 : 1 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 flex-shrink-0 flex items-center justify-center text-xs"
                          style={{ border: `1px solid ${isDone ? P.border : P.accent}`, color: P.accent }}>
                          {isDone ? "✓" : ""}
                        </span>
                        <p className="text-sm font-medium" style={{ color: isDone ? P.textMuted : P.text, textDecoration: isDone ? "line-through" : "none" }}>{item.task}</p>
                      </div>
                      <span className="text-xs flex-shrink-0 font-bold"
                        style={{ color: item.urgency === "high" ? P.orange : item.urgency === "medium" ? P.textMid : P.textMuted }}>
                        {URGENCY[item.urgency]}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-2 ml-6 flex-wrap items-center">
                      <span className={`text-xs px-2 py-0.5 font-bold ${c.tag}`}>{item.category.toUpperCase()}</span>
                      <span className="text-xs" style={{ color: P.textMuted }}>⏱ {item.time_estimate}</span>
                    </div>
                    <p className="text-xs mt-1.5 ml-6" style={{ color: P.textMid }}>{item.why_now}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* GRID VIEW */}
          {view === "grid" && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: P.textMuted }}>🕐 // TIME_BLOCKS.LOG</p>
              <div className="grid grid-cols-5 gap-px" style={{ background: P.border }}>
                {DAYS.map(day => (
                  <div key={day} className="p-2" style={{ background: P.bgCard }}>
                    <div className="text-center pb-1 mb-2" style={{ borderBottom: `1px solid ${P.border}` }}>
                      <p className="text-xs font-bold" style={{ color: P.textMid }}>{day}</p>
                      <p className="text-xs" style={{ color: dayMins[day] > 420 ? P.warn : P.textMuted }}>{fmtMins(dayMins[day])}</p>
                    </div>
                    <div className="space-y-1">
                      {grid[day].map((t, i) => {
                        const c = CATEGORY_COLORS[t.category] || CATEGORY_COLORS["Other"];
                        return (
                          <div key={i} className="pl-1.5 py-1" style={{ borderLeft: `2px solid ${c.blockL}`, background: P.bgInput }}>
                            <p className="text-xs leading-tight line-clamp-2" style={{ color: P.text }}>{t.task}</p>
                            <p className="text-xs mt-0.5" style={{ color: P.textMuted }}>{t.time_estimate}</p>
                          </div>
                        );
                      })}
                      {!grid[day].length && <p className="text-xs text-center py-2" style={{ color: P.border }}>—</p>}
                    </div>
                  </div>
                ))}
              </div>
              {Object.values(dayMins).some(m => m > 420) && (
                <p className="text-xs" style={{ color: P.warn }}>!! WARNING: overloaded day detected — redistribute tasks</p>
              )}
            </div>
          )}

          {/* Can Wait */}
          {result.can_wait?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: P.textMuted }}>💤 // CAN_WAIT.LOG — {result.can_wait.length} items</p>
              {result.can_wait.map((item, i) => {
                const c = CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Other"];
                return (
                  <div key={i} className="flex items-start gap-3 p-3" style={cardStyle}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: P.text }}>{item.task}</p>
                      <p className="text-xs mt-0.5" style={{ color: P.textMuted }}>{item.suggested_timing}{item.note ? ` · ${item.note}` : ""}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 font-bold flex-shrink-0 ${c.tag}`}>{item.category.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Watch List */}
          {result.watch_list?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold" style={{ color: P.warn }}>⚠️ // WATCH_LIST.LOG</p>
              {result.watch_list.map((item, i) => (
                <div key={i} className="p-3 space-y-1" style={{ border: `1px solid ${P.orange}`, background: "#e8ceaa" }}>
                  <p className="text-sm font-medium" style={{ color: P.text }}>{item.task}</p>
                  <p className="text-xs" style={{ color: P.warn }}>{item.concern}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add FAB */}
        <div className="fixed bottom-6 right-6 z-50">
          {showQA && (
            <div className="mb-3 p-4 w-72 shadow-xl font-mono space-y-2" style={{ background: P.bgCard, border: `1px solid ${P.borderDark}` }}>
              <p className="text-xs font-bold" style={{ color: P.accent }}>📥 // ADD TO NEXT_WEEK.QUEUE</p>
              <input className="w-full text-sm px-3 py-2 focus:outline-none transition"
                style={inputStyle}
                placeholder="task for next week..."
                value={quickAdd}
                onChange={e => setQuickAdd(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addNextWeek()}
                autoFocus />
              <button onClick={addNextWeek} className="w-full text-sm font-bold py-1.5 transition"
                style={{ background: P.accent, color: P.bgInput }}>
                QUEUE →
              </button>
              {nextWeek.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs" style={{ color: P.textMuted }}>queued ({nextWeek.length}):</p>
                  {nextWeek.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-2 py-1" style={{ background: P.bgInput, color: P.textMid }}>
                      <span className="truncate">{t}</span>
                      <button onClick={() => removeNextWeek(i)} className="ml-2 flex-shrink-0" style={{ color: P.textMuted }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setShowQA(p => !p)}
            className="w-12 h-12 font-bold text-xl flex items-center justify-center shadow-lg transition"
            style={{ background: P.accent, color: P.bgInput }}>
            {showQA ? "×" : "+"}
          </button>
        </div>
      </div>
    );
  }

  // ── INPUT ──
  return (
    <div className="min-h-screen p-4 md:p-8 font-mono" style={{ background: P.bg, color: P.text }}>
      <div className="max-w-xl mx-auto space-y-5">
        <div className="pb-4 mb-6" style={{ borderBottom: `2px solid ${P.borderDark}` }}>
          <p className="text-xs mb-1" style={{ color: P.textMuted }}>// KNOWLEDGE ARCHIVE: WEEKLY_PLAN.TXT</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: P.text }}>🧠 WEEKLY_PLAN.EXE <Cursor /></h1>
          <p className="text-sm mt-1" style={{ color: P.textMid }}>dump everything. get a clear week.</p>
        </div>

        {/* Standing context */}
        <div className="p-4 space-y-2" style={cardStyle}>
          <div className="flex justify-between items-center">
            <p className="text-xs" style={{ color: P.textMuted }}>📌 // STANDING_CONTEXT.LOG</p>
            <button onClick={() => { setTempStanding(standing); setEditStanding(true); }}
              className="text-xs font-bold transition" style={{ color: P.accent }}>
              {standing ? "EDIT" : "SET"}
            </button>
          </div>
          {editStanding ? (
            <div className="space-y-2">
              <textarea className="w-full h-20 text-sm p-3 resize-none focus:outline-none transition"
                style={inputStyle}
                placeholder="thesis due May 15. client check-in every other Tuesday. mornings are deep work..."
                value={tempStanding}
                onChange={e => setTempStanding(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={saveStanding} className="text-xs px-4 py-1.5 font-bold"
                  style={{ background: P.accent, color: P.bgInput }}>SAVE</button>
                <button onClick={() => setEditStanding(false)} className="text-xs" style={{ color: P.textMuted }}>CANCEL</button>
              </div>
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: P.textMuted }}>{standing || "no standing context set."}</p>
          )}
        </div>

        {/* Next week queue */}
        {nextWeek.length > 0 && (
          <div className="p-4 space-y-2" style={{ border: `1px solid ${P.borderDark}`, background: "#d4bc98" }}>
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold" style={{ color: P.accent }}>🗂️ // QUEUED_FROM_LAST_WEEK ({nextWeek.length})</p>
              <button onClick={useNextWeekDump} className="text-xs font-bold" style={{ color: P.accent }}>ADD TO DUMP →</button>
            </div>
            {nextWeek.map((t, i) => (
              <div key={i} className="flex justify-between text-xs px-3 py-1.5" style={{ background: P.bgInput, color: P.textMid }}>
                <span>{t}</span>
                <button onClick={() => removeNextWeek(i)} className="ml-2" style={{ color: P.textMuted }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Brain dump */}
        <div className="p-4 space-y-4" style={cardStyle}>
          <div>
            <p className="text-xs mb-2" style={{ color: P.textMuted }}>🧠 // BRAIN_DUMP.INPUT</p>
            <textarea className="w-full h-44 text-sm p-3 resize-none focus:outline-none transition"
              style={inputStyle}
              placeholder={"list everything — tasks, errands, anxieties, deliverables. don't organize it.\n\nfollow up with Ireti on grant draft. thesis chapter 2 revisions. check in with first client. uncle Ogoo WhatsApp. IIE prep..."}
              value={dump}
              onChange={e => setDump(e.target.value)} />
          </div>
          <div>
            <p className="text-xs mb-2" style={{ color: P.textMuted }}>📝 // WEEK_CONTEXT.INPUT <span style={{ color: P.border }}>(optional)</span></p>
            <input className="w-full text-sm px-3 py-2 focus:outline-none transition"
              style={inputStyle}
              placeholder="grant deadline friday. traveling wed–thu. low energy week..."
              value={weekCtx}
              onChange={e => setWeekCtx(e.target.value)} />
          </div>
          {error && <p className="text-xs" style={{ color: P.warn }}>{error}</p>}
          <button onClick={handleGenerate} disabled={!dump.trim()}
            className="w-full font-bold py-3 text-sm transition"
            style={{ background: dump.trim() ? P.accent : P.border, color: dump.trim() ? P.bgInput : P.bgCard }}>
            RUN WEEKLY_PLAN.EXE →
          </button>
        </div>
      </div>
    </div>
  );
}