import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://gptfcawpaxlwdrnpityv.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZKdkjZMCtnI23RSt-xceOg_yr6QXvvF";

// ── Supabase client (no SDK needed — raw REST calls) ─────────────────────────
const sb = {
  async upsertSessions(userName, date, sessions) {
    // Delete existing sessions for this user+date, then insert fresh
    await fetch(`${SUPABASE_URL}/rest/v1/sessions?user_name=eq.${encodeURIComponent(userName)}&date=eq.${encodeURIComponent(date)}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    if (!sessions.length) return;
    const rows = sessions.map(s => ({
      id: s.id,
      user_name: userName,
      subtype: s.subtype,
      task_type: s.taskType || "placement",
      outcome: s.outcome,
      end_time: s.endTime,
      duration: s.duration || 0,
      count: s.count || 1,
      bulk: s.bulk || false,
      manual: s.manual || false,
      date: date,
    }));
    await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
  },

  async getSessions(userName, date) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_name=eq.${encodeURIComponent(userName)}&date=eq.${encodeURIComponent(date)}&select=*`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(r => ({
      id: r.id,
      subtype: r.subtype,
      taskType: r.task_type,
      outcome: r.outcome,
      endTime: r.end_time,
      duration: r.duration,
      count: r.count,
      bulk: r.bulk,
      manual: r.manual,
      user: r.user_name,
    }));
  },

  async getSessionsForDates(userName, dates) {
    if (!dates.length) return [];
    const dateList = dates.map(d => `"${d}"`).join(",");
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_name=eq.${encodeURIComponent(userName)}&date=in.(${dateList})&select=*`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(r => ({
      id: r.id,
      subtype: r.subtype,
      taskType: r.task_type,
      outcome: r.outcome,
      endTime: r.end_time,
      duration: r.duration,
      count: r.count,
      bulk: r.bulk,
      manual: r.manual,
      user: r.user_name,
    }));
  },

  async saveUser(userName) {
    localStorage.setItem("wt_user", userName);
  },

  getUser() {
    return localStorage.getItem("wt_user") || null;
  },

  clearUser() {
    localStorage.removeItem("wt_user");
  }
};


const TEAM = ["Samish", "Karishma", "Tanvi", "Parsonav", "Shweta"];

// PINs are hashed (simple checksum) — change these to your own 4-digit PINs
// Default PINs: Samish=1111, Karishma=2222, Tanvi=3333, Parsonav=4444, Shweta=5555
const PINS = {
  Samish:   "1111",
  Karishma: "2222",
  Tanvi:    "3333",
  Parsonav: "4444",
  Shweta:   "5555",
};

const TASK_TYPES = {
  placement: {
    id:       "placement",
    label:    "Payment Placement",
    slaHour:  23,
    slaMin:   0,
    slaLabel: "11:00 PM",
    color:    "#1e40af",
    subtypes: [
      { id: "advisor",  label: "Advisor Placed", icon: "👤" },
      { id: "pension",  label: "Pension",         icon: "🏦" },
      { id: "third",    label: "Third Party",     icon: "🔗" },
      { id: "switch",   label: "Switch",          icon: "🔄" },
      { id: "altus",    label: "Altus",           icon: "📋" },
      { id: "transfer", label: "Transfer",        icon: "➡️" },
      { id: "queries",  label: "Queries",         icon: "💬" },
    ],
  },
  payment: {
    id:       "payment",
    label:    "Payment Processing",
    slaHour:  18,
    slaMin:   30,
    slaLabel: "6:30 PM",
    color:    "#7c3aed",
    subtypes: [
      { id: "bacs",    label: "BACS",             icon: "🏛️" },
      { id: "faster",  label: "Faster Payments",  icon: "⚡" },
      { id: "pswitch", label: "Switch",           icon: "🔄" },
      { id: "chaps",   label: "CHAPS",            icon: "💷" },
    ],
  },
};

// All subtypes across both task types for lookup
const ALL_SUBTYPES = [...TASK_TYPES.placement.subtypes, ...TASK_TYPES.payment.subtypes];

const OUTCOMES = [
  { id: "completed", label: "Completed",         color: "#22c55e", bg: "#052e16" },
  { id: "awaiting",  label: "Awaiting Response", color: "#f59e0b", bg: "#1c1408" },
  { id: "pending",   label: "Pending",            color: "#94a3b8", bg: "#0d1219" },
];
const OUTCOME_MAP = Object.fromEntries(OUTCOMES.map(o => [o.id, o]));

const AVATAR_COLORS = {
  Samish:   { bg: "#1e3a8a", text: "#93c5fd" },
  Karishma: { bg: "#3b1f6e", text: "#c4b5fd" },
  Tanvi:    { bg: "#064e3b", text: "#6ee7b7" },
  Parsonav: { bg: "#7c2d12", text: "#fdba74" },
  Shweta:   { bg: "#1e3a5f", text: "#7dd3fc" },
};

function pad(n) { return String(n).padStart(2, "0"); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function initials(name) { return name.slice(0, 2).toUpperCase(); }

function fmtMs(ms) {
  if (!ms || ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function isSLABreached(s) {
  if (!s.endTime) return false;
  const tt   = TASK_TYPES[s.taskType] || TASK_TYPES.placement;
  const d    = new Date(s.endTime);
  const mins = d.getHours() * 60 + d.getMinutes();
  const sla  = tt.slaHour * 60 + tt.slaMin;
  return mins > sla;
}

function dateRange(period) {
  const today = new Date();
  const dates = [];
  if (period === "today") {
    dates.push(fmtDate(today));
  } else if (period === "week") {
    // Go back up to 7 days to cover the full week regardless of day-of-week
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(fmtDate(d));
    }
  } else {
    // This month up to today
    const y = today.getFullYear(), m = today.getMonth();
    for (let i = 1; i <= today.getDate(); i++) {
      dates.push(`${y}-${pad(m + 1)}-${pad(i)}`);
    }
  }
  return dates;
}

function Bar({ value, max, color, height = 6 }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1) : 0;
  return (
    <div style={{ background: "#1e293b", borderRadius: 3, height, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
    </div>
  );
}

function Clock({ start, accumulated = 0, paused = false, pausedAt = null }) {
  const getElapsed = () => {
    if (paused) return accumulated + (pausedAt ? pausedAt - start : 0);
    return accumulated + (Date.now() - start);
  };
  const [elapsed, setElapsed] = useState(getElapsed());
  useEffect(() => {
    if (paused) { setElapsed(getElapsed()); return; }
    const id = setInterval(() => setElapsed(getElapsed()), 1000);
    return () => clearInterval(id);
  }, [start, accumulated, paused, pausedAt]);
  const s = Math.floor(elapsed / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  return <span style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }}>{pad(h)}:{pad(m % 60)}:{pad(s % 60)}</span>;
}

function Avatar({ name, size = 32 }) {
  const av = AVATAR_COLORS[name] || { bg: "#1e293b", text: "#94a3b8" };
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

export default function App() {
  // ── Shared state ────────────────────────────────────────────────────────────
  const [tab, setTab]               = useState("track");
  const [user, setUser]             = useState(null);
  const [pinPrompt, setPinPrompt]   = useState(null);  // name being verified
  const [pinInput, setPinInput]     = useState("");
  const [pinError, setPinError]     = useState(false);

  // ── Tracker state ───────────────────────────────────────────────────────────
  const [taskType, setTaskType]     = useState("placement");
  const [active, setActive]         = useState(null);   // { subtype, startTime, accumulated }
  const [paused, setPaused]         = useState(false);
  const [pausedAt, setPausedAt]     = useState(null);
  const [pickingOutcome, setPicking] = useState(null);
  const [sessions, setSessions]     = useState([]);
  const [flash, setFlash]           = useState(null);
  const [bulkMode, setBulkMode]     = useState(false);
  const [bulkCount, setBulkCount]   = useState("");
  const [pending, setPending]       = useState(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualForm, setManualForm]   = useState({ subtype: "", count: "1", duration: "", outcome: "completed" });

  // ── Dashboard state ─────────────────────────────────────────────────────────
  const [period, setPeriod]         = useState("today");
  const [teamData, setTeamData]     = useState({});
  const [dashLoading, setDashLoading] = useState(false);
  const [ts, setTs]                 = useState(Date.now());

  const mono = { fontFamily: "'DM Mono', monospace" };
  const card = { background: "#0d1321", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px" };

  // ── Load user + sessions on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Remember last user name but still require PIN
        const lastUser = sb.getUser();
        if (lastUser && PINS[lastUser]) {
          // User must still enter PIN — just remembered for convenience
        }
      } catch {}
    })();
  }, []);

  // ── Persist sessions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    sb.upsertSessions(user, todayKey(), sessions).catch(() => {});
  }, [sessions, user]);

  // ── Load dashboard data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "dashboard") return;
    (async () => {
      setDashLoading(true);
      const dates  = dateRange(period);
      const result = {};
      TEAM.forEach(u => { result[u] = []; });
      const PAYMENT_SUBTYPES = ["bacs","faster","pswitch","chaps"];

      await Promise.all(TEAM.map(async u => {
        try {
          const rows = await sb.getSessionsForDates(u, dates);
          result[u] = rows.map(s => ({
            ...s,
            taskType: s.taskType || (PAYMENT_SUBTYPES.includes(s.subtype) ? "payment" : "placement")
          }));
        } catch {}
      }));

      setTeamData(result);
      setDashLoading(false);
    })();
  }, [tab, period, ts, taskType]);

  useEffect(() => {
    const id = setInterval(() => { if (tab === "dashboard") setTs(Date.now()); }, 60000);
    return () => clearInterval(id);
  }, [tab]);


  // ── User selection ──────────────────────────────────────────────────────────
  function requestUser(u) {
    if (!u || u === user) return;
    setPinPrompt(u);
    setPinInput("");
    setPinError(false);
  }

  async function confirmPin() {
    if (pinInput !== PINS[pinPrompt]) {
      setPinError(true);
      setPinInput("");
      return;
    }
    const u = pinPrompt;
    setPinPrompt(null); setPinInput(""); setPinError(false);
    setActive(null); setPaused(false); setPausedAt(null); setPicking(null); setPending(null); setBulkMode(false); setBulkCount(""); setManualEntry(false);
    setUser(u);
    sb.saveUser(u);
    try {
      const raw = await sb.getSessions(u, todayKey());
      const PAYMENT_SUBTYPES = ["bacs","faster","pswitch","chaps"];
      setSessions(raw.map(s => ({ ...s, taskType: s.taskType || (PAYMENT_SUBTYPES.includes(s.subtype) ? "payment" : "placement") })));
    } catch { setSessions([]); }
  }

  function signOut() {
    setUser(null);
    setSessions([]);
    setActive(null); setPaused(false); setPausedAt(null); setPicking(null); setPending(null);
    sb.clearUser();
  }

  // ── Tracker actions ─────────────────────────────────────────────────────────
  function startTask(id) {
    if (active || pickingOutcome) return;
    setActive({ subtype: id, startTime: Date.now(), accumulated: 0 });
    setPaused(false);
  }

  function pauseTask() {
    if (!active || paused) return;
    setPaused(true);
    setPausedAt(Date.now());
  }

  function resumeTask() {
    if (!active || !paused) return;
    const extra = Date.now() - pausedAt;
    setActive(prev => ({ ...prev, startTime: Date.now(), accumulated: (prev.accumulated || 0) + (pausedAt - prev.startTime) }));
    setPaused(false);
    setPausedAt(null);
  }

  function stopTask() {
    if (!active) return;
    const now = Date.now();
    const segmentMs = paused ? 0 : (now - active.startTime);
    const totalMs   = (active.accumulated || 0) + segmentMs;
    setPending({ subtype: active.subtype, duration: totalMs, endTime: now, taskType });
    setPicking(active.subtype);
    setActive(null);
    setPaused(false);
    setPausedAt(null);
  }

  function logOutcome(outcomeId) {
    const sessionTaskType = pending?.taskType || taskType;
    const isMandatoryCount = ["bacs","faster","pswitch"].includes(pending?.subtype || pickingOutcome);
    const count = (isMandatoryCount || bulkMode) && parseInt(bulkCount) > 0 ? parseInt(bulkCount) : 1;
    setSessions(prev => [...prev, {
      id: Date.now(), subtype: pending?.subtype || pickingOutcome, outcome: outcomeId,
      endTime: pending?.endTime || Date.now(), duration: pending?.duration || 0,
      user, count, bulk: count > 1, taskType: sessionTaskType,
    }]);
    setFlash(outcomeId); setTimeout(() => setFlash(null), 700);
    setPicking(null); setPending(null); setBulkMode(false); setBulkCount("");
  }

  function deleteSession(id) { setSessions(prev => prev.filter(s => s.id !== id)); }

  // ── Tracker analytics ───────────────────────────────────────────────────────
  const currentTask    = TASK_TYPES[taskType];
  const SUBTYPES       = currentTask.subtypes;
  // Only count sessions belonging to the current task type
  const taskSessions   = sessions.filter(s => (s.taskType || "placement") === taskType);
  const stats = {};
  SUBTYPES.forEach(st => { stats[st.id] = { total: 0, sessions: 0, totalMs: 0, outcomes: {} }; OUTCOMES.forEach(o => { stats[st.id].outcomes[o.id] = 0; }); });
  taskSessions.forEach(s => {
    if (!stats[s.subtype]) return;
    const c = s.count || 1;
    stats[s.subtype].total += c; stats[s.subtype].sessions++;
    stats[s.subtype].totalMs += s.duration || 0;
    stats[s.subtype].outcomes[s.outcome] = (stats[s.subtype].outcomes[s.outcome] || 0) + c;
  });
  const maxStatMs     = Math.max(...Object.values(stats).map(s => s.totalMs), 1);
  const totalCases    = taskSessions.reduce((a, s) => a + (s.count || 1), 0);
  const totalMs       = taskSessions.reduce((a, s) => a + (s.duration || 0), 0);
  const avgMsPerEntry = totalCases > 0 ? totalMs / totalCases : 0;
  const byOutcome     = id => taskSessions.filter(s => s.outcome === id).reduce((a, s) => a + (s.count || 1), 0);
  const activeSt      = ALL_SUBTYPES.find(s => s.id === active?.subtype);
  const pickingSt     = ALL_SUBTYPES.find(s => s.id === pickingOutcome);

  // ── Dashboard analytics ─────────────────────────────────────────────────────
  const allSessions   = Object.values(teamData).flat().filter(s => (s.taskType || "placement") === taskType);
  const teamTickets   = allSessions.length;
  const teamEntries   = allSessions.reduce((a, s) => a + (s.count || 1), 0);
  const teamMs        = allSessions.reduce((a, s) => a + (s.duration || 0), 0);
  const teamAvgMs     = teamTickets > 0 ? teamMs / teamTickets : 0;
  const teamBreached = allSessions.filter(isSLABreached).length;
  const teamSLAPct   = teamTickets > 0 ? Math.round(((teamTickets - teamBreached) / teamTickets) * 100) : 100;

  const personStats = TEAM.map(u => {
    const ss       = (teamData[u] || []).filter(s => (s.taskType || "placement") === taskType);
    const tickets  = ss.length;
    const entries  = ss.reduce((a, s) => a + (s.count || 1), 0);
    const ms       = ss.reduce((a, s) => a + (s.duration || 0), 0);
    const avgMs    = tickets > 0 ? ms / tickets : 0;
    const breachedDays = ss.filter(isSLABreached).length;
    const slaPct       = tickets > 0 ? Math.round(((tickets - breachedDays) / tickets) * 100) : null;
    const completed = ss.filter(s => s.outcome === "completed").reduce((a, s) => a + (s.count || 1), 0);
    const awaiting  = ss.filter(s => s.outcome === "awaiting").reduce((a, s) => a + (s.count || 1), 0);
    const pendingN  = ss.filter(s => s.outcome === "pending").reduce((a, s) => a + (s.count || 1), 0);
    return { u, tickets, entries, avgMs, breached: breachedDays, slaPct, completed, awaiting, pending: pendingN };
  }).filter(p => p.tickets > 0);

  const maxTickets = Math.max(...personStats.map(p => p.tickets), 1);
  const maxEntries = Math.max(...personStats.map(p => p.entries), 1);
  const maxAvgMs   = Math.max(...personStats.map(p => p.avgMs), 1);

  const subtypeCounts = {};
  ALL_SUBTYPES.forEach(st => { subtypeCounts[st.id] = 0; });
  allSessions.forEach(s => { if (subtypeCounts[s.subtype] !== undefined) subtypeCounts[s.subtype] += s.count || 1; });
  const maxSubtype = Math.max(...Object.values(subtypeCounts), 1);

  const PERIOD_LABELS = { today: "Today", week: "This week", month: "This month" };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── PIN modal ── */}
      {pinPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#0d1321", border: "1px solid #1e293b", borderRadius: 14, padding: "28px 32px", width: 280, textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: AVATAR_COLORS[pinPrompt]?.bg || "#1e293b", color: AVATAR_COLORS[pinPrompt]?.text || "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, margin: "0 auto 12px" }}>{initials(pinPrompt)}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>{pinPrompt}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>Enter your 4-digit PIN</div>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g,"")); setPinError(false); }}
              onKeyDown={e => e.key === "Enter" && pinInput.length === 4 && confirmPin()}
              placeholder="••••"
              autoFocus
              style={{ width: "100%", background: "#111827", border: `1px solid ${pinError ? "#ef4444" : "#334155"}`, borderRadius: 8, color: "#f1f5f9", fontSize: 22, fontFamily: "'DM Mono', monospace", letterSpacing: "0.3em", textAlign: "center", padding: "10px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            />
            {pinError && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>Incorrect PIN — try again</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setPinPrompt(null); setPinInput(""); setPinError(false); }}
                style={{ flex: 1, background: "transparent", border: "1px solid #1e293b", borderRadius: 8, padding: "9px", fontSize: 13, color: "#475569", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirmPin} disabled={pinInput.length !== 4}
                style={{ flex: 1, background: pinInput.length === 4 ? "#1e40af" : "#111827", color: pinInput.length === 4 ? "#fff" : "#334155", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: pinInput.length === 4 ? "pointer" : "not-allowed", transition: "all 0.15s" }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background: "#0d1321", borderBottom: "1px solid #1e293b", padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 1 }}>Withdrawals ops</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Main tab nav */}
          <div style={{ display: "flex", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 3, gap: 3 }}>
            {[["track","Track"],["summary","Summary"],["dashboard","Dashboard"]].map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", background: tab === v ? "#1e40af" : "transparent", color: tab === v ? "#fff" : "#64748b", transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>
          {/* Task type switcher — shown on all tabs */}
          <div style={{ display: "flex", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 3, gap: 3 }}>
            {Object.values(TASK_TYPES).map(tt => (
              <button key={tt.id} onClick={() => { if (!active && !pickingOutcome) setTaskType(tt.id); }}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: active || pickingOutcome ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", background: taskType === tt.id ? tt.color : "transparent", color: taskType === tt.id ? "#fff" : "#64748b", transition: "all 0.15s", opacity: active && taskType !== tt.id ? 0.5 : 1 }}>
                {tt.label}
              </button>
            ))}
          </div>
          {/* User selector — PIN gated */}
          {tab !== "dashboard" && (
            user
              ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "6px 12px" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: AVATAR_COLORS[user]?.bg || "#1e293b", color: AVATAR_COLORS[user]?.text || "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600 }}>{initials(user)}</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#f1f5f9" }}>{user}</span>
                  </div>
                  <button onClick={signOut} style={{ background: "transparent", border: "1px solid #1e293b", borderRadius: 7, padding: "6px 10px", fontSize: 11, color: "#475569", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Sign out</button>
                </div>
              : <div style={{ position: "relative" }}>
                  <select value="" onChange={e => requestUser(e.target.value)} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#475569", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "7px 28px 7px 12px", cursor: "pointer", outline: "none", appearance: "none" }}>
                    <option value="">Select your name</option>
                    {TEAM.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none", fontSize: 10 }}>▼</span>
                </div>
          )}
          {/* Period selector — dashboard only */}
          {tab === "dashboard" && (
            <div style={{ display: "flex", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 3, gap: 3 }}>
              {["today","week","month"].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", background: period === p ? "#1e40af" : "transparent", color: period === p ? "#fff" : "#64748b", transition: "all 0.15s" }}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 22px", maxWidth: 860, margin: "0 auto" }}>

        {/* ════════════════ TRACK TAB ════════════════ */}
        {tab === "track" && (<>
          {/* Active timer */}
          {active && (
            <div style={{ background: "linear-gradient(135deg,#0f2027,#1a3a5c)", border: `1px solid ${currentTask.color}`, borderRadius: 12, padding: "16px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: `0 0 28px ${currentTask.color}26` }}>
              <div>
                <div style={{ fontSize: 10, color: paused ? "#475569" : "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>{paused ? "⏸ Paused" : "Working on"}</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9" }}>{activeSt?.icon} {activeSt?.label}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>Started {fmtTime(active.startTime)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, color: paused ? "#475569" : currentTask.color, fontWeight: 500, marginBottom: 8 }}>
                  <Clock start={active.startTime} accumulated={active.accumulated || 0} paused={paused} pausedAt={pausedAt} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {!paused
                    ? <button onClick={pauseTask} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>⏸ Pause</button>
                    : <button onClick={resumeTask} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>▶ Resume</button>
                  }
                  <button onClick={stopTask} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Stop ■</button>
                </div>
              </div>
            </div>
          )}

          {/* Outcome picker */}
          {pickingOutcome && (
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{pickingSt?.icon} {pickingSt?.label} · {fmtMs(pending?.duration || 0)}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>How did this one go?</div>
              {/* Entry count — mandatory for BACS/Faster/Switch, optional bulk for others */}
              {(() => {
                const isMandatory = ["bacs","faster","pswitch"].includes(pickingOutcome);
                if (isMandatory) {
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 12px", background: "#1c1408", border: "1px solid #f59e0b55", borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Entries in this file:</span>
                      <input type="number" min="1" value={bulkCount} onChange={e => setBulkCount(e.target.value)} placeholder="e.g. 50" autoFocus
                        style={{ background: "#0d1321", border: "1px solid #f59e0b55", borderRadius: 6, color: "#f59e0b", fontSize: 14, fontFamily: "'DM Mono', monospace", fontWeight: 600, padding: "5px 10px", width: 100, outline: "none" }} />
                      {parseInt(bulkCount) > 0 && <span style={{ fontSize: 11, color: "#f59e0b" }}>{bulkCount} entries</span>}
                    </div>
                  );
                }
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 12px", background: bulkMode ? "#1c1408" : "#111827", border: `1px solid ${bulkMode ? "#f59e0b55" : "#1e293b"}`, borderRadius: 8, transition: "all 0.2s" }}>
                    <button onClick={() => { setBulkMode(b => !b); setBulkCount(""); }} style={{ background: bulkMode ? "#f59e0b" : "#1e293b", color: bulkMode ? "#111" : "#64748b", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.2s" }}>
                      {bulkMode ? "✓ Bulk" : "Bulk ticket?"}
                    </button>
                    {bulkMode && (<>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Number of entries:</span>
                      <input type="number" min="2" value={bulkCount} onChange={e => setBulkCount(e.target.value)} placeholder="e.g. 150" autoFocus
                        style={{ background: "#0d1321", border: "1px solid #f59e0b55", borderRadius: 6, color: "#f59e0b", fontSize: 14, fontFamily: "'DM Mono', monospace", fontWeight: 600, padding: "5px 10px", width: 90, outline: "none" }} />
                      {parseInt(bulkCount) > 0 && <span style={{ fontSize: 11, color: "#f59e0b" }}>{bulkCount} entries</span>}
                    </>)}
                  </div>
                );
              })()}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {OUTCOMES.map(o => {
                  const isMandatory = ["bacs","faster","pswitch"].includes(pickingOutcome);
                  const disabled = isMandatory ? !(parseInt(bulkCount) > 0) : (bulkMode && !(parseInt(bulkCount) > 1));
                  return (
                    <button key={o.id} onClick={() => !disabled && logOutcome(o.id)}
                      style={{ background: o.bg, color: disabled ? "#33333388" : o.color, border: `1px solid ${disabled ? "#ffffff11" : o.color + "44"}`, borderRadius: 7, padding: "8px 15px", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "border-color 0.15s" }}
                      onMouseOver={e => { if (!disabled) e.currentTarget.style.borderColor = o.color; }}
                      onMouseOut={e => { if (!disabled) e.currentTarget.style.borderColor = `${o.color}44`; }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!user
            ? <div style={{ ...card, textAlign: "center", color: "#475569", fontSize: 14, padding: "32px", marginBottom: 14 }}>Select your name above to start tracking</div>
            : (<>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Tap a type to start timer</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 20 }}>
                {SUBTYPES.map(st => {
                  const s = stats[st.id];
                  const disabled = !!(active || pickingOutcome);
                  return (
                    <button key={st.id} onClick={() => !disabled && startTask(st.id)} style={{ background: "#0d1321", border: `1px solid ${flash === st.id ? "#22c55e" : "#1e293b"}`, borderRadius: 10, padding: "14px 12px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, textAlign: "left", transition: "border-color 0.2s", position: "relative" }}>
                      <div style={{ fontSize: 17, marginBottom: 4 }}>{st.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 1 }}>{st.label}</div>
                      {s.total > 0 ? (<>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 5, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{s.total} entr{s.total !== 1 ? "ies" : "y"}</span>
                          <span style={{ fontSize: 10, color: "#60a5fa", ...mono }}>{fmtMs(s.totalMs)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {OUTCOMES.filter(o => s.outcomes[o.id] > 0).map(o => (
                            <span key={o.id} style={{ fontSize: 9, color: o.color, background: o.bg, borderRadius: 3, padding: "1px 5px" }}>{s.outcomes[o.id]} {o.label.split(" ")[0]}</span>
                          ))}
                        </div>
                      </>) : <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>No cases yet</div>}
                      {s.total > 0 && <div style={{ position: "absolute", top: 9, right: 9, background: "#1e3a8a", color: "#93c5fd", borderRadius: 20, fontSize: 11, fontWeight: 600, padding: "1px 7px" }}>{s.sessions}</div>}
                    </button>
                  );
                })}
              </div>
            </>)
          }

          {/* Manual entry */}
          {!active && !pickingOutcome && user && (
            <div style={{ marginBottom: 14 }}>
              {!manualEntry
                ? <button onClick={() => setManualEntry(true)} style={{ background: "transparent", border: "1px dashed #1e293b", borderRadius: 8, padding: "8px 16px", fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", width: "100%" }}>
                    + Log a past task manually
                  </button>
                : <div style={{ ...card }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 12 }}>Log past task</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Type</div>
                        <select value={manualForm.subtype} onChange={e => setManualForm(f => ({ ...f, subtype: e.target.value }))}
                          style={{ width: "100%", background: "#111827", border: "1px solid #334155", borderRadius: 7, color: manualForm.subtype ? "#f1f5f9" : "#475569", fontSize: 12, fontFamily: "'DM Sans', sans-serif", padding: "7px 10px", outline: "none", appearance: "none" }}>
                          <option value="">Select type</option>
                          {SUBTYPES.map(st => <option key={st.id} value={st.id}>{st.icon} {st.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Outcome</div>
                        <select value={manualForm.outcome} onChange={e => setManualForm(f => ({ ...f, outcome: e.target.value }))}
                          style={{ width: "100%", background: "#111827", border: "1px solid #334155", borderRadius: 7, color: "#f1f5f9", fontSize: 12, fontFamily: "'DM Sans', sans-serif", padding: "7px 10px", outline: "none", appearance: "none" }}>
                          {OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Entries</div>
                        <input type="number" min="1" value={manualForm.count} onChange={e => setManualForm(f => ({ ...f, count: e.target.value }))}
                          style={{ width: "100%", background: "#111827", border: "1px solid #334155", borderRadius: 7, color: "#f1f5f9", fontSize: 12, fontFamily: "'DM Mono', monospace", padding: "7px 10px", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Time taken (mins, optional)</div>
                        <input type="number" min="0" value={manualForm.duration} onChange={e => setManualForm(f => ({ ...f, duration: e.target.value }))}
                          placeholder="e.g. 5"
                          style={{ width: "100%", background: "#111827", border: "1px solid #334155", borderRadius: 7, color: "#f1f5f9", fontSize: 12, fontFamily: "'DM Mono', monospace", padding: "7px 10px", outline: "none", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => {
                        if (!manualForm.subtype) return;
                        const count = parseInt(manualForm.count) || 1;
                        const durationMs = manualForm.duration ? parseFloat(manualForm.duration) * 60000 : 0;
                        setSessions(prev => [...prev, {
                          id: Date.now(), subtype: manualForm.subtype, outcome: manualForm.outcome,
                          endTime: Date.now(), duration: durationMs, user, count, bulk: count > 1,
                          taskType, manual: true,
                        }]);
                        setManualEntry(false);
                        setManualForm({ subtype: "", count: "1", duration: "", outcome: "completed" });
                      }} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                        Save
                      </button>
                      <button onClick={() => { setManualEntry(false); setManualForm({ subtype: "", count: "1", duration: "", outcome: "completed" }); }}
                        style={{ background: "transparent", border: "1px solid #1e293b", borderRadius: 7, padding: "8px 14px", fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
              }
            </div>
          )}

          {taskSessions.length > 0 && (<>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>
              Today's log · {taskSessions.length} ticket{taskSessions.length !== 1 ? "s" : ""} · <span style={{ color: currentTask.color, ...mono }}>{fmtMs(totalMs)}</span> total
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...taskSessions].reverse().map(s => {
                const st = ALL_SUBTYPES.find(x => x.id === s.subtype);
                const o  = OUTCOME_MAP[s.outcome];
                const prevSessions = sessions.filter(x => x.id !== s.id && x.subtype === s.subtype && x.taskType === s.taskType && x.duration > 0 && (x.count || 1) > 0);
                // Compare per-entry rate, not total duration
                const ratePerEntry = s.duration > 0 ? s.duration / (s.count || 1) : 0;
                const avgRatePerEntry = prevSessions.length > 0
                  ? prevSessions.reduce((a, x) => a + x.duration / (x.count || 1), 0) / prevSessions.length
                  : null;
                const delta = avgRatePerEntry !== null && ratePerEntry > 0 ? ratePerEntry - avgRatePerEntry : null;
                const deltaLabel = delta !== null ? (delta >= 0 ? `+${fmtMs(Math.abs(delta))}/entry` : `-${fmtMs(Math.abs(delta))}/entry`) : null;
                const deltaColor = delta !== null ? (delta <= 0 ? "#22c55e" : delta < avgRatePerEntry * 0.2 ? "#f59e0b" : "#ef4444") : null;
                return (
                  <div key={s.id} style={{ background: "#0d1321", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14 }}>{st?.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0" }}>{st?.label}</div>
                      <div style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{fmtTime(s.endTime)}</span>
                        <span>·</span>
                        <span style={{ color: "#60a5fa", ...mono }}>{fmtMs(s.duration)}</span>
                        {deltaLabel && <><span>·</span><span style={{ color: deltaColor, ...mono, fontWeight: 600 }}>{deltaLabel} vs avg</span></>}
                      </div>
                    </div>
                    {s.manual && <span style={{ fontSize: 9, color: "#475569", background: "#0d1321", border: "1px solid #334155", borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>manual</span>}
                    {s.bulk && <span style={{ fontSize: 9, color: "#f59e0b", background: "#1c1408", border: "1px solid #f59e0b33", borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>×{s.count}</span>}
                    <span style={{ fontSize: 10, color: o?.color, background: o?.bg, border: `1px solid ${o?.color}33`, borderRadius: 5, padding: "2px 8px", whiteSpace: "nowrap" }}>{o?.label}</span>
                    <button onClick={() => deleteSession(s.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, padding: "1px 4px", lineHeight: 1 }}>×</button>
                  </div>
                );
              })}
            </div>
          </>)}
        </>)}

        {/* ════════════════ SUMMARY TAB ════════════════ */}
        {tab === "summary" && (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 18 }}>
            {[
              { label: "Total tickets",  value: String(taskSessions.length), color: "#60a5fa" },
              { label: "Total time",     value: fmtMs(totalMs),          color: "#60a5fa" },
              { label: "Avg per entry",  value: fmtMs(avgMsPerEntry),    color: "#a78bfa" },
              { label: "Completed",      value: String(byOutcome("completed")), color: "#22c55e" },
            ].map(item => (
              <div key={item.label} style={{ ...card, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: item.color, ...mono }}>{item.value}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Time & volume by type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
            {SUBTYPES.filter(st => stats[st.id].total > 0).length === 0
              ? <div style={{ ...card, textAlign: "center", color: "#334155", fontSize: 13, padding: "28px" }}>No cases logged yet</div>
              : SUBTYPES.map(st => {
                  const s = stats[st.id];
                  if (s.total === 0) return null;
                  return (
                    <div key={st.id} style={{ ...card }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 15 }}>{st.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{st.label}</span>
                          <span style={{ fontSize: 10, color: "#475569" }}>{s.total} entr{s.total !== 1 ? "ies" : "y"}{s.sessions !== s.total ? ` · ${s.sessions} ticket${s.sessions !== 1 ? "s" : ""}` : ""}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#60a5fa", ...mono }}>{fmtMs(s.totalMs)}</span>
                          <span style={{ fontSize: 10, color: "#334155", marginLeft: 8 }}>avg {fmtMs(s.totalMs / s.total)}/entry</span>
                        </div>
                      </div>
                      <Bar value={s.totalMs} max={maxStatMs} color="#1e40af" />
                      <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
                        {OUTCOMES.filter(o => s.outcomes[o.id] > 0).map(o => (
                          <span key={o.id} style={{ fontSize: 11, color: o.color, background: o.bg, border: `1px solid ${o.color}33`, borderRadius: 5, padding: "2px 8px" }}>{s.outcomes[o.id]} {o.label}</span>
                        ))}
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {totalCases > 0 && (<>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Outcome breakdown</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 20 }}>
              {OUTCOMES.map(o => (
                <div key={o.id} style={{ background: o.bg, border: `1px solid ${o.color}33`, borderRadius: 8, padding: "11px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: o.color, ...mono }}>{byOutcome(o.id)}</div>
                  <div style={{ fontSize: 9, color: o.color, opacity: 0.7, marginTop: 3 }}>{o.label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Whiteboard — paste ready</div>
            {(() => {
              const totalReceived  = totalCases;
              const totalProcessed = byOutcome("completed") + byOutcome("awaiting");
              const pendingCount   = byOutcome("pending");
              const lastSession    = taskSessions.length > 0 ? taskSessions.reduce((a, b) => b.endTime > a.endTime ? b : a) : null;
              const completedTime  = lastSession ? new Date(lastSession.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "—";
              return (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 120px 90px 120px 110px 120px 80px", gap: 1, marginBottom: 1 }}>
                    {["Task","Process owner","Deadline","Completed time","Total received","Total processed","Pending"].map(h => (
                      <div key={h} style={{ background: "#1e293b", color: "#64748b", fontSize: 9, fontWeight: 600, padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 120px 90px 120px 110px 120px 80px", gap: 1 }}>
                    {[currentTask.label, user || "—", currentTask.slaLabel, completedTime, totalReceived, totalProcessed, pendingCount].map((v, i) => (
                      <div key={i} style={{ background: "transparent", border: "1px solid #334155", color: i >= 4 ? "#60a5fa" : "#e2e8f0", fontSize: 12, fontWeight: i >= 4 ? 600 : 400, padding: "6px 8px", ...mono }}>{v}</div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>)}
        </>)}

        {/* ════════════════ DASHBOARD TAB ════════════════ */}
        {tab === "dashboard" && (<>
          {dashLoading ? (
            <div style={{ textAlign: "center", color: "#334155", padding: "60px", fontSize: 13 }}>Loading team data…</div>
          ) : (<>
            {/* KPIs */}
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Team overview — {PERIOD_LABELS[period].toLowerCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total tickets",    value: teamTickets, sub: `${teamEntries} entries`,       color: "#60a5fa" },
                { label: "Entries processed",value: teamEntries, sub: `across ${teamTickets} tickets`, color: "#60a5fa" },
                { label: "SLA met",          value: `${teamSLAPct}%`, sub: teamBreached > 0 ? `${teamBreached} breached` : "All on time", color: teamSLAPct >= 90 ? "#22c55e" : teamSLAPct >= 70 ? "#f59e0b" : "#ef4444" },
                { label: "Avg per ticket",   value: fmtMs(teamAvgMs), sub: "team average",            color: "#a78bfa" },
              ].map(item => (
                <div key={item.label} style={{ ...card }}>
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: item.color, ...mono, lineHeight: 1 }}>{item.value}</div>
                  {item.sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 5 }}>{item.sub}</div>}
                </div>
              ))}
            </div>

            {teamBreached > 0 && (() => {
              // Only show breaches for the currently selected task type
              const breachedSessions = Object.entries(teamData).flatMap(([u, ss]) =>
                ss.filter(s => (s.taskType || "placement") === taskType && isSLABreached(s)).map(s => ({ ...s, u }))
              ).sort((a, b) => a.endTime - b.endTime);
              if (breachedSessions.length === 0) return null;
              return (
                <div style={{ background: "#1a0505", border: "1px solid #ef444444", borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #2d0a0a" }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>{breachedSessions.length} SLA breach{breachedSessions.length !== 1 ? "es" : ""} — {PERIOD_LABELS[period].toLowerCase()}</span>
                      <span style={{ fontSize: 11, color: "#7f1d1d", marginLeft: 10 }}>tickets completed after {currentTask.slaLabel}</span>
                    </div>
                  </div>
                  {/* Breach rows */}
                  <div>
                    {/* Column headers */}
                    <div style={{ display: "grid", gridTemplateColumns: "26px 100px 1fr 90px 80px 90px", gap: 8, padding: "7px 16px", borderBottom: "1px solid #2d0a0a" }}>
                      {["", "Owner", "Type", "Date", "Completed", "Over by"].map((h, i) => (
                        <span key={i} style={{ fontSize: 9, color: "#7f1d1d", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
                      ))}
                    </div>
                    {breachedSessions.map((s, i) => {
                      const st      = ALL_SUBTYPES.find(x => x.id === s.subtype);
                      const tt      = TASK_TYPES[s.taskType] || currentTask;
                      const endDate = new Date(s.endTime);
                      const dateStr = endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                      const timeStr = endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                      // How many minutes past the correct SLA deadline
                      const deadline = new Date(s.endTime);
                      deadline.setHours(tt.slaHour, tt.slaMin, 0, 0);
                      const overMs  = s.endTime - deadline.getTime();
                      const overMin = Math.floor(overMs / 60000);
                      const overStr = overMin >= 60 ? `${Math.floor(overMin/60)}h ${overMin%60}m` : `${overMin}m`;
                      const av      = AVATAR_COLORS[s.u] || { bg: "#1e293b", text: "#94a3b8" };
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 100px 1fr 90px 80px 90px", gap: 8, padding: "9px 16px", borderBottom: i < breachedSessions.length - 1 ? "1px solid #1a0505" : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : "#1f0606" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600 }}>{initials(s.u)}</div>
                          <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 500 }}>{s.u}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{st?.icon} {st?.label || s.subtype}</span>
                          <span style={{ fontSize: 11, color: "#7f1d1d", fontFamily: "'DM Mono', monospace" }}>{dateStr}</span>
                          <span style={{ fontSize: 11, color: "#ef4444", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{timeStr}</span>
                          <span style={{ fontSize: 11, color: "#ef4444", fontFamily: "'DM Mono', monospace" }}>+{overStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Individual cards */}
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Individual performance</div>
            {personStats.length === 0
              ? <div style={{ ...card, textAlign: "center", color: "#334155", fontSize: 13, padding: "32px", marginBottom: 20 }}>No data logged yet for {PERIOD_LABELS[period].toLowerCase()}</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {[...personStats].sort((a, b) => b.entries - a.entries || a.avgMs - b.avgMs).map(p => (
                    <div key={p.u} style={{ ...card }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <Avatar name={p.u} size={34} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{p.u}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{p.tickets} ticket{p.tickets !== 1 ? "s" : ""} · {p.entries} entr{p.entries !== 1 ? "ies" : "y"}</div>
                        </div>
                        {p.slaPct !== null && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: p.slaPct >= 90 ? "#22c55e" : p.slaPct >= 70 ? "#f59e0b" : "#ef4444", ...mono }}>{p.slaPct}%</div>
                            <div style={{ fontSize: 9, color: "#475569" }}>SLA met</div>
                          </div>
                        )}
                        <div style={{ textAlign: "right", minWidth: 70 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa", ...mono }}>{fmtMs(p.avgMs)}</div>
                          <div style={{ fontSize: 9, color: "#475569" }}>avg/ticket</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 44px", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: "#475569" }}>Volume</span>
                        <Bar value={p.entries} max={maxEntries} color="#1e40af" />
                        <span style={{ fontSize: 11, color: "#60a5fa", ...mono, textAlign: "right" }}>{p.entries}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 44px", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "#475569" }}>Speed</span>
                        <Bar value={maxAvgMs - p.avgMs} max={maxAvgMs} color="#7c3aed" />
                        <span style={{ fontSize: 11, color: "#a78bfa", ...mono, textAlign: "right" }}>{fmtMs(p.avgMs)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                        {p.completed > 0 && <span style={{ fontSize: 10, color: "#22c55e", background: "#052e16", border: "1px solid #22c55e33", borderRadius: 5, padding: "2px 8px" }}>{p.completed} Completed</span>}
                        {p.awaiting  > 0 && <span style={{ fontSize: 10, color: "#f59e0b", background: "#1c1408", border: "1px solid #f59e0b33", borderRadius: 5, padding: "2px 8px" }}>{p.awaiting} Awaiting</span>}
                        {p.pending   > 0 && <span style={{ fontSize: 10, color: "#94a3b8", background: "#0d1219", border: "1px solid #94a3b833", borderRadius: 5, padding: "2px 8px" }}>{p.pending} Pending</span>}
                        {p.breached  > 0 && <span style={{ fontSize: 10, color: "#ef4444", background: "#1a0505", border: "1px solid #ef444433", borderRadius: 5, padding: "2px 8px" }}>⚠ {p.breached} SLA breach{p.breached !== 1 ? "es" : ""}</span>}
                      </div>
                    </div>
                  ))}
                </div>
            }

            {/* Subtype breakdown */}
            {allSessions.length > 0 && (<>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Volume by placement type</div>
              <div style={{ ...card, marginBottom: 20 }}>
                {ALL_SUBTYPES.filter(st => subtypeCounts[st.id] > 0).map(st => (
                  <div key={st.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 50px", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{st.icon} {st.label}</span>
                    <Bar value={subtypeCounts[st.id]} max={maxSubtype} color="#0f3460" height={8} />
                    <span style={{ fontSize: 12, color: "#60a5fa", ...mono, textAlign: "right" }}>{subtypeCounts[st.id]}</span>
                  </div>
                ))}
              </div>
            </>)}

            {/* Leaderboard */}
            {personStats.length > 1 && (<>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Leaderboard</div>
              <div style={{ background: "#0d1321", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 70px 80px 80px", padding: "8px 16px", background: "#111827", borderBottom: "1px solid #1e293b", fontSize: 10, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", gap: 8 }}>
                  <span>#</span><span>Name</span><span style={{ textAlign: "right" }}>Tickets</span><span style={{ textAlign: "right" }}>Entries</span><span style={{ textAlign: "right" }}>Avg time</span><span style={{ textAlign: "right" }}>SLA</span>
                </div>
                {[...personStats].sort((a, b) => b.entries - a.entries || a.avgMs - b.avgMs).map((p, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                  return (
                    <div key={p.u} style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 70px 80px 80px", padding: "10px 16px", borderBottom: i < personStats.length - 1 ? "1px solid #0f172a" : "none", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{medal}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={p.u} size={26} />
                        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{p.u}</span>
                      </div>
                      <span style={{ fontSize: 13, color: "#60a5fa", ...mono, textAlign: "right" }}>{p.tickets}</span>
                      <span style={{ fontSize: 13, color: "#60a5fa", ...mono, textAlign: "right", fontWeight: 600 }}>{p.entries}</span>
                      <span style={{ fontSize: 13, color: "#a78bfa", ...mono, textAlign: "right" }}>{fmtMs(p.avgMs)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, ...mono, textAlign: "right", color: p.slaPct === null ? "#334155" : p.slaPct >= 90 ? "#22c55e" : p.slaPct >= 70 ? "#f59e0b" : "#ef4444" }}>
                        {p.slaPct !== null ? `${p.slaPct}%` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>)}

            <div style={{ fontSize: 10, color: "#1e293b", textAlign: "center", paddingBottom: 8 }}>
              Auto-refreshes every 60s · last updated {new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </>)}
        </>)}
      </div>
    </div>
  );
}
