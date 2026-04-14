import { useState, useEffect } from "react";

// ── User roles ────────────────────────────────────────────────────────────────
// roles: "analyst" | "senior" | "tl" | "manager"
// canTrack: can log sessions
// canExport: can download Excel export
// canDashboard: can view dashboard
const USERS = {
  // Analysts — track + dashboard
  Samish:     { role: "senior",  team: "Withdrawals", canTrack: true,  canExport: true,  canDashboard: true  },
  Karishma:   { role: "analyst", team: "Withdrawals", canTrack: true,  canExport: false, canDashboard: true  },
  Tanvi:      { role: "analyst", team: "Withdrawals", canTrack: true,  canExport: false, canDashboard: true  },
  Parsonav:   { role: "analyst", team: "Withdrawals", canTrack: true,  canExport: false, canDashboard: true  },
  Shweta:     { role: "analyst", team: "Withdrawals", canTrack: true,  canExport: false, canDashboard: true  },
  // TLs — dashboard + export only
  Nishant:    { role: "tl",      team: "Withdrawals", canTrack: false, canExport: true,  canDashboard: true  },
  Gurpreet:   { role: "tl",      team: "Withdrawals", canTrack: false, canExport: true,  canDashboard: true  },
  Prajwal:    { role: "tl",      team: "Withdrawals", canTrack: false, canExport: true,  canDashboard: true  },
  // Managers — dashboard + export, all teams
  Vivek:      { role: "manager", team: "all",         canTrack: false, canExport: true,  canDashboard: true  },
  Mayukh:     { role: "manager", team: "all",         canTrack: false, canExport: true,  canDashboard: true  },
  Samruddha:  { role: "manager", team: "all",         canTrack: false, canExport: true,  canDashboard: true  },
};

const TEAM      = Object.keys(USERS);
const TRACKERS  = TEAM.filter(u => USERS[u].canTrack);  // shown in tracker dropdown
const TEAMS     = ["Withdrawals"];                        // expand as new teams onboard

const PINS = {
  Samish:    "3847",
  Karishma:  "7291",
  Tanvi:     "5063",
  Parsonav:  "9418",
  Shweta:    "2756",
  Nishant:   "6139",
  Gurpreet:  "4582",
  Prajwal:   "8374",
  Vivek:     "1926",
  Mayukh:    "7045",
  Samruddha: "3618",
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
      { id: "advisor",  label: "Advisor Placed",     icon: "👤" },
      { id: "pension",  label: "Pension",             icon: "🏦" },
      { id: "third",    label: "Third Party",         icon: "🔗" },
      { id: "switch",   label: "Switch",              icon: "🔄" },
      { id: "altus",    label: "Altus",               icon: "📋" },
      { id: "transfer", label: "Transfer",            icon: "➡️" },
      { id: "regular",  label: "Regular Withdrawal",  icon: "💰" },
      { id: "adhoc",    label: "Adhoc Withdrawal",    icon: "⚡" },
      { id: "queries",  label: "Queries",             icon: "💬" },
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
  const [zdId, setZdId]               = useState("");           // ZD ID for awaiting response
  const [responseMode, setResponseMode] = useState(false);      // Response Received mode
  const [responseZdId, setResponseZdId] = useState("");         // ZD ID entered for response
  const [responseError, setResponseError] = useState("");

  // ── Dashboard state ─────────────────────────────────────────────────────────
  const [period, setPeriod]         = useState("today");
  const [teamData, setTeamData]     = useState({});
  const [dashLoading, setDashLoading] = useState(false);
  const [ts, setTs]                 = useState(Date.now());
  const [teamAvgs, setTeamAvgs]     = useState({});
  const [teamFilter, setTeamFilter] = useState("Withdrawals");
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState(todayKey());
  const [exportTo, setExportTo]     = useState(todayKey());
  const [exportLoading, setExportLoading] = useState(false);

  const mono = { fontFamily: "'DM Mono', monospace" };
  const card = { background: "#0d1321", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px" };

  // ── Load user + sessions on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const ur = await window.storage.get("lastUser");
        if (ur && ur.value && PINS[ur.value]) {
          // PIN still required — just remembered for convenience
        }
      } catch {}

      // ── Load team-wide averages for delta comparison ──────────────────────
      try {
        const listed = await window.storage.list("sessions:");
        const keys   = listed?.keys || [];
        const allSess = [];
        for (const key of keys) {
          try {
            const r = await window.storage.get(key);
            if (!r) continue;
            const rows = JSON.parse(r.value);
            const PAYMENT_SUBTYPES = ["bacs","faster","pswitch","chaps"];
            rows.forEach(s => {
              if (!s.manual && s.duration > 0 && s.count > 0) {
                allSess.push({
                  subtype:  s.subtype,
                  taskType: s.taskType || (PAYMENT_SUBTYPES.includes(s.subtype) ? "payment" : "placement"),
                  rate:     s.duration / (s.count || 1),
                });
              }
            });
          } catch {}
        }
        // Straight average per subtype+taskType
        const avgs = {};
        allSess.forEach(s => {
          const key = `${s.subtype}:${s.taskType}`;
          if (!avgs[key]) avgs[key] = { sum: 0, count: 0 };
          avgs[key].sum   += s.rate;
          avgs[key].count += 1;
        });
        const result = {};
        Object.entries(avgs).forEach(([k, v]) => { result[k] = v.sum / v.count; });
        setTeamAvgs(result);
      } catch {}
    })();
  }, []);

  // ── Persist sessions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    window.storage.set(`sessions:${todayKey()}:${user}`, JSON.stringify(sessions)).catch(() => {});
  }, [sessions, user]);

  // ── Load dashboard data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "dashboard") return;
    (async () => {
      setDashLoading(true);
      const dates  = new Set(dateRange(period));
      const result = {};
      TEAM.forEach(u => { result[u] = []; });

      try {
        // List all session keys then filter by date range
        const listed = await window.storage.list("sessions:");
        const keys   = listed?.keys || [];

        for (const key of keys) {
          // Matches both old format (sessions:DATE) and new (sessions:DATE:USER)
          const parts = key.split(":");
          if (parts.length < 2) continue;
          const date  = parts[1];
          const uName = parts[2] || null;
          if (!dates.has(date)) continue;

          try {
            const r = await window.storage.get(key);
            if (!r) continue;
            const sessions = JSON.parse(r.value);

            if (uName && result[uName]) {
              // New format — sessions:DATE:USER
              // Stamp taskType from subtype if missing (backfill old sessions)
              const PAYMENT_SUBTYPES = ["bacs","faster","pswitch","chaps"];
              const stamped = sessions.map(s => ({
                ...s,
                taskType: s.taskType || (PAYMENT_SUBTYPES.includes(s.subtype) ? "payment" : "placement")
              }));
              result[uName].push(...stamped);
            } else {
              // Old format — sessions:DATE, each session has a user field
              sessions.forEach(s => {
                const u = s.user;
                if (u && result[u]) result[u].push(s);
                else if (!u) {
                  // No user field — assign to whoever is logged in
                  TEAM.forEach(t => { if (result[t]) result[t].push(s); });
                }
              });
            }
          } catch {}
        }
      } catch {
        // Fallback: try keys directly if list() fails
        const dates2 = dateRange(period);
        for (const u of TEAM) {
          for (const date of dates2) {
            try {
              const r = await window.storage.get(`sessions:${date}:${u}`);
              if (r) result[u].push(...JSON.parse(r.value));
            } catch {}
            try {
              const r = await window.storage.get(`sessions:${date}`);
              if (r) {
                const ss = JSON.parse(r.value);
                ss.filter(s => s.user === u).forEach(s => result[u].push(s));
              }
            } catch {}
          }
        }
      }

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
    // Route non-trackers directly to dashboard
    if (!USERS[u]?.canTrack) setTab("dashboard");
    window.storage.set("lastUser", u).catch(() => {});
    try {
      const r = await window.storage.get(`sessions:${todayKey()}:${u}`);
      if (r) {
        const PAYMENT_SUBTYPES = ["bacs","faster","pswitch","chaps"];
        const raw = JSON.parse(r.value);
        setSessions(raw.map(s => ({ ...s, taskType: s.taskType || (PAYMENT_SUBTYPES.includes(s.subtype) ? "payment" : "placement") })));
      } else { setSessions([]); }
    } catch { setSessions([]); }
  }

  function signOut() {
    setUser(null);
    setSessions([]);
    setActive(null); setPaused(false); setPausedAt(null); setPicking(null); setPending(null);
    window.storage.set("lastUser", "").catch(() => {});
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
    const isMandatoryCount = ["bacs","faster","pswitch","adhoc"].includes(pending?.subtype || pickingOutcome);
    const count = (isMandatoryCount || bulkMode) && parseInt(bulkCount) > 0 ? parseInt(bulkCount) : 1;
    setSessions(prev => [...prev, {
      id: Date.now(), subtype: pending?.subtype || pickingOutcome, outcome: outcomeId,
      endTime: pending?.endTime || Date.now(), duration: pending?.duration || 0,
      user, count, bulk: count > 1, taskType: sessionTaskType,
      team: userConfig?.team || "Withdrawals",
      ...(outcomeId === "awaiting" && zdId ? { zdId: zdId.trim().toUpperCase() } : {}),
    }]);
    setFlash(outcomeId); setTimeout(() => setFlash(null), 700);
    setPicking(null); setPending(null); setBulkMode(false); setBulkCount(""); setZdId("");
    // Refresh team avg for this subtype inline (add new session's rate immediately)
    if (!isMandatoryCount || count > 0) {
      const rate = (pending?.duration || 0) / count;
      if (rate > 0) {
        const avgKey = `${pending?.subtype || pickingOutcome}:${pending?.taskType || taskType}`;
        setTeamAvgs(prev => {
          const existing = prev[avgKey];
          if (!existing) return { ...prev, [avgKey]: rate };
          // Recalculate running average
          const stored = window._teamAvgCounts || {};
          const n = (stored[avgKey] || 1);
          window._teamAvgCounts = { ...stored, [avgKey]: n + 1 };
          return { ...prev, [avgKey]: (existing * n + rate) / (n + 1) };
        });
      }
    }
  }

  function deleteSession(id) { setSessions(prev => prev.filter(s => s.id !== id)); }

  function logResponse() {
    const id = responseZdId.trim().toUpperCase();
    if (!id) return;
    // Find matching awaiting session across ALL sessions (not just today)
    const match = sessions.find(s => s.outcome === "awaiting" && s.zdId === id);
    if (!match) {
      setResponseError(`No awaiting ticket found with ID ${id}`);
      return;
    }
    // Update matched session: add response duration, mark completed
    const now = Date.now();
    const addedDuration = pending?.duration || 0;
    setSessions(prev => prev.map(s =>
      s.id === match.id
        ? { ...s, outcome: "completed", duration: (s.duration || 0) + addedDuration, responseTime: now, resolvedBy: user }
        : s
    ));
    setFlash("completed"); setTimeout(() => setFlash(null), 700);
    setResponseMode(false); setResponseZdId(""); setResponseError("");
    setPicking(null); setPending(null); setBulkMode(false); setBulkCount("");
  }

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
  const byOutcome     = id => taskSessions.filter(s =>
    id === "completed" ? (s.outcome === "completed" || s.outcome === "resolved") : s.outcome === id
  ).reduce((a, s) => a + (s.count || 1), 0);
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
    return { u, tickets, entries, ms, avgMs, breached: breachedDays, slaPct, completed, awaiting, pending: pendingN };
  }).filter(p => p.tickets > 0);

  const maxTickets = Math.max(...personStats.map(p => p.tickets), 1);
  const maxEntries = Math.max(...personStats.map(p => p.entries), 1);
  const maxAvgMs   = Math.max(...personStats.map(p => p.avgMs), 1);

  const subtypeCounts = {};
  ALL_SUBTYPES.forEach(st => { subtypeCounts[st.id] = 0; });
  allSessions.forEach(s => { if (subtypeCounts[s.subtype] !== undefined) subtypeCounts[s.subtype] += s.count || 1; });
  const maxSubtype = Math.max(...Object.values(subtypeCounts), 1);

  const PERIOD_LABELS = { today: "Today", week: "This week", month: "This month" };
  const userConfig    = user ? USERS[user] : null;
  const canTrack      = userConfig?.canTrack ?? false;
  const canExport     = userConfig?.canExport ?? false;
  const isManager     = userConfig?.role === "manager";
  const isTL          = userConfig?.role === "tl";
  const isManagerView = isManager || isTL;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── Export modal ── */}
      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#0d1321", border: "1px solid #1e293b", borderRadius: 14, padding: "28px 32px", width: 380 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Export to Excel</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>Select date range and task type</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 5 }}>From</div>
                <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                  style={{ width: "100%", background: "#111827", border: "1px solid #334155", borderRadius: 7, color: "#f1f5f9", fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 5 }}>To</div>
                <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                  style={{ width: "100%", background: "#111827", border: "1px solid #334155", borderRadius: 7, color: "#f1f5f9", fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 5 }}>Task type</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["all", "placement", "payment"].map(t => (
                  <button key={t} onClick={() => setTaskType(t === "all" ? taskType : t)}
                    style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${taskType === t || t === "all" ? "#1e40af" : "#1e293b"}`, background: t === "all" ? "#111827" : taskType === t ? "#1e3a8a" : "#0d1321", color: "#f1f5f9", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                    {t === "all" ? "Both" : TASK_TYPES[t]?.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                setExportLoading(true);
                try {
                  // Gather all dates in range
                  const from = new Date(exportFrom);
                  const to   = new Date(exportTo);
                  const dates = [];
                  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                    dates.push(d.toISOString().slice(0, 10));
                  }
                  // Fetch all sessions for date range
                  const rows = [];
                  for (const u of TEAM) {
                    if (!USERS[u].canTrack) continue;
                    for (const date of dates) {
                      try {
                        const r = await window.storage.get(`sessions:${date}:${u}`);
                        if (!r) continue;
                        const ss = JSON.parse(r.value);
                        ss.forEach(s => rows.push({ ...s, user: u, date }));
                      } catch {}
                    }
                  }
                  // Build CSV
                  const slaDeadline = s => {
                    const tt = TASK_TYPES[s.taskType || "placement"];
                    return `${tt.slaHour}:${String(tt.slaMin).padStart(2,"0")}`;
                  };
                  const slaTime = s => {
                    const tt = TASK_TYPES[s.taskType || "placement"];
                    return tt.slaHour * 60 + tt.slaMin;
                  };
                  const completedMins = s => {
                    const d = new Date(s.endTime);
                    return d.getHours() * 60 + d.getMinutes();
                  };
                  const headers = ["Date","Task Type","Subtype","Process Owner","Team","Completed Time","SLA Deadline","SLA Met","Time Taken (mins)","Entries","Outcome","ZD Ticket ID","Bulk"];
                  const csvRows = [headers.join(",")];
                  rows.forEach(s => {
                    const st       = ALL_SUBTYPES.find(x => x.id === s.subtype);
                    const tt       = TASK_TYPES[s.taskType || "placement"];
                    const endDate  = new Date(s.endTime);
                    const compTime = endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    const slaMet   = completedMins(s) <= slaTime(s) ? "Yes" : "No";
                    const timeMins = s.duration ? Math.round(s.duration / 60000) : 0;
                    csvRows.push([
                      s.date, tt?.label || s.taskType, st?.label || s.subtype, s.user || s.user_name,
                      USERS[s.user || s.user_name]?.team || "Withdrawals",
                      compTime, slaDeadline(s), slaMet, timeMins,
                      s.count || 1, s.outcome, s.zdId || "", s.bulk ? "Yes" : "No"
                    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
                  });
                  // Download
                  const blob = new Blob([csvRows.join("
")], { type: "text/csv" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = `withdrawals_${exportFrom}_to_${exportTo}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setShowExport(false);
                } catch(e) { console.error(e); }
                setExportLoading(false);
              }} style={{ flex: 1, background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                {exportLoading ? "Generating…" : "Download CSV"}
              </button>
              <button onClick={() => setShowExport(false)} style={{ background: "transparent", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#475569", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none", fontSize: 10 }}>▼</span>
                </div>
          )}
          {/* Period selector + team filter + export — dashboard only */}
          {tab === "dashboard" && (<>
            {isManagerView && TEAMS.length > 1 && (
              <div style={{ position: "relative" }}>
                <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9", fontSize: 12, fontFamily: "'DM Sans', sans-serif", padding: "7px 24px 7px 10px", cursor: "pointer", outline: "none", appearance: "none" }}>
                  {isManager && <option value="all">All Teams</option>}
                  {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none", fontSize: 10 }}>▼</span>
              </div>
            )}
            <div style={{ display: "flex", background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: 3, gap: 3 }}>
              {["today","week","month"].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", background: period === p ? "#1e40af" : "transparent", color: period === p ? "#fff" : "#64748b", transition: "all 0.15s" }}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {canExport && (
              <button onClick={() => setShowExport(true)} style={{ background: "#052e16", color: "#22c55e", border: "1px solid #22c55e44", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                ↓ Export
              </button>
            )}
          </>)}
        </div>
      </div>

      <div style={{ padding: "20px 22px", maxWidth: 860, margin: "0 auto" }}>

        {/* ════════════════ TRACK TAB ════════════════ */}
        {tab === "track" && canTrack && (<>
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
                const isMandatory = ["bacs","faster","pswitch","adhoc"].includes(pickingOutcome);
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
              {/* ZD ID field — shown when Awaiting Response is the likely outcome */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                {OUTCOMES.map(o => {
                  const isMandatory = ["bacs","faster","pswitch","adhoc"].includes(pickingOutcome);
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
                {/* Response Received button */}
                <button onClick={() => { setResponseMode(true); setResponseError(""); setResponseZdId(""); }}
                  style={{ background: "#0d2137", color: "#38bdf8", border: "1px solid #38bdf844", borderRadius: 7, padding: "8px 15px", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                  Response Received
                </button>
              </div>

              {/* ZD ID — mandatory when Awaiting Response is selected */}
              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 5 }}>
                  Zendesk ticket ID <span style={{ color: "#f59e0b" }}>— required if marking as Awaiting Response</span>
                </div>
                <input
                  type="text"
                  value={zdId}
                  onChange={e => setZdId(e.target.value)}
                  placeholder="e.g. ZD-1042"
                  style={{ background: "#0d1321", border: `1px solid ${zdId ? "#f59e0b55" : "#334155"}`, borderRadius: 6, color: "#f1f5f9", fontSize: 13, fontFamily: "'DM Mono', monospace", padding: "5px 10px", width: "100%", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
          )}

          {/* Response Received modal */}
          {responseMode && (
            <div style={{ ...card, marginBottom: 14, border: "1px solid #38bdf844", background: "#0a1929" }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", marginBottom: 4 }}>Response Received</div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>Enter the Zendesk ticket ID — this will find the awaiting ticket and mark it as completed</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input
                  type="text"
                  value={responseZdId}
                  onChange={e => { setResponseZdId(e.target.value); setResponseError(""); }}
                  placeholder="e.g. ZD-1042"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && logResponse()}
                  style={{ flex: 1, background: "#0d1321", border: `1px solid ${responseError ? "#ef4444" : "#38bdf844"}`, borderRadius: 7, color: "#f1f5f9", fontSize: 14, fontFamily: "'DM Mono', monospace", padding: "8px 12px", outline: "none" }}
                />
                <button onClick={logResponse} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>Confirm</button>
                <button onClick={() => { setResponseMode(false); setResponseZdId(""); setResponseError(""); setPicking(null); setPending(null); }}
                  style={{ background: "transparent", border: "1px solid #1e293b", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#475569", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Cancel</button>
              </div>
              {responseError && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{responseError}</div>}
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

          {/* Open awaiting tickets panel */}
          {!active && !pickingOutcome && !responseMode && (() => {
            const openAwaiting = sessions.filter(s => s.outcome === "awaiting" && s.zdId);
            if (openAwaiting.length === 0) return null;
            return (
              <div style={{ ...card, marginBottom: 14, border: "1px solid #f59e0b33" }}>
                <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  ⏳ Awaiting response — {openAwaiting.length} open
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {openAwaiting.map(s => {
                    const st = ALL_SUBTYPES.find(x => x.id === s.subtype);
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#111827", borderRadius: 7 }}>
                        <span style={{ fontSize: 13 }}>{st?.icon}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, color: "#e2e8f0" }}>{st?.label}</span>
                          <span style={{ fontSize: 10, color: "#475569", marginLeft: 8 }}>{fmtTime(s.endTime)}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "#38bdf8", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{s.zdId}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
                // Compare against team-wide historical average (straight avg, excl. manual)
                const ratePerEntry    = !s.manual && s.duration > 0 ? s.duration / (s.count || 1) : 0;
                const teamAvgKey      = `${s.subtype}:${s.taskType || "placement"}`;
                const avgRatePerEntry = teamAvgs[teamAvgKey] || null;
                const delta      = avgRatePerEntry !== null && ratePerEntry > 0 ? ratePerEntry - avgRatePerEntry : null;
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
                    {s.zdId && <span style={{ fontSize: 9, color: "#38bdf8", background: "#0a1929", border: "1px solid #38bdf833", borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>{s.zdId}</span>}
                    {s.resolvedBy && <span style={{ fontSize: 9, color: "#22c55e", background: "#052e16", border: "1px solid #22c55e33", borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>resolved</span>}
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

            {/* Awaiting response list */}
            {(() => {
              const openAwaiting = taskSessions.filter(s => s.outcome === "awaiting" && s.zdId);
              if (openAwaiting.length === 0) return null;
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>
                    ⏳ Awaiting response — {openAwaiting.length} open
                  </div>
                  <div style={{ background: "#0d1321", border: "1px solid #f59e0b33", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px 90px", gap: 8, padding: "7px 14px", background: "#111827", borderBottom: "1px solid #1e293b", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      <span>Type</span><span>ZD Ticket</span><span style={{ textAlign: "right" }}>Logged at</span><span style={{ textAlign: "right" }}>Age</span>
                    </div>
                    {openAwaiting.map((s, i) => {
                      const st      = ALL_SUBTYPES.find(x => x.id === s.subtype);
                      const ageMs   = Date.now() - s.endTime;
                      const ageMins = Math.floor(ageMs / 60000);
                      const ageStr  = ageMins < 60 ? `${ageMins}m` : ageMins < 1440 ? `${Math.floor(ageMins/60)}h ${ageMins%60}m` : `${Math.floor(ageMins/1440)}d ${Math.floor((ageMins%1440)/60)}h`;
                      const isOld   = ageMins > 60 * 24 * 5; // 5 days
                      return (
                        <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px 90px", gap: 8, padding: "9px 14px", borderBottom: i < openAwaiting.length - 1 ? "1px solid #1e293b" : "none", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#e2e8f0" }}>{st?.icon} {st?.label}</span>
                          <span style={{ fontSize: 12, color: "#38bdf8", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{s.zdId}</span>
                          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{fmtTime(s.endTime)}</span>
                          <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", textAlign: "right", color: isOld ? "#ef4444" : "#94a3b8" }}>{ageStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Whiteboard — paste ready</div>
            {(() => {
              // Placement sessions excluding queries
              const placementSessions = taskType === "placement"
                ? taskSessions.filter(s => s.subtype !== "queries")
                : taskSessions;
              // Queries sessions (placement only)
              const queriesSessions = taskType === "placement"
                ? taskSessions.filter(s => s.subtype === "queries")
                : [];

              const byOutcomeOf = (ss, id) => ss.filter(s => s.outcome === id).reduce((a, s) => a + (s.count || 1), 0);
              const lastOf = ss => ss.length > 0 ? ss.reduce((a, b) => b.endTime > a.endTime ? b : a) : null;
              const fmtLast = ss => { const l = lastOf(ss); return l ? new Date(l.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "—"; };

              const rows = taskType === "placement" ? [
                {
                  task: "Payment Placement",
                  received:  placementSessions.reduce((a, s) => a + (s.count || 1), 0),
                  processed: byOutcomeOf(placementSessions, "completed") + byOutcomeOf(placementSessions, "awaiting"),
                  pending:   byOutcomeOf(placementSessions, "pending"),
                  time:      fmtLast(placementSessions),
                  sla:       "11:00 PM",
                },
                ...(queriesSessions.length > 0 ? [{
                  task: "Zendesk Tickets",
                  received:  queriesSessions.reduce((a, s) => a + (s.count || 1), 0),
                  processed: byOutcomeOf(queriesSessions, "completed") + byOutcomeOf(queriesSessions, "awaiting"),
                  pending:   byOutcomeOf(queriesSessions, "pending"),
                  time:      fmtLast(queriesSessions),
                  sla:       "11:00 PM",
                }] : []),
              ] : [{
                task: currentTask.label,
                received:  taskSessions.reduce((a, s) => a + (s.count || 1), 0),
                processed: byOutcomeOf(taskSessions, "completed") + byOutcomeOf(taskSessions, "awaiting"),
                pending:   byOutcomeOf(taskSessions, "pending"),
                time:      fmtLast(taskSessions),
                sla:       currentTask.slaLabel,
              }];

              const headers = ["Task","Process owner","Deadline","Completed time","Total received","Total processed","Pending"];
              return (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 120px 90px 120px 110px 120px 80px", gap: 1, marginBottom: 1 }}>
                    {headers.map(h => (
                      <div key={h} style={{ background: "#1e293b", color: "#64748b", fontSize: 9, fontWeight: 600, padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
                    ))}
                  </div>
                  {rows.map((row, ri) => (
                    <div key={ri} style={{ display: "grid", gridTemplateColumns: "160px 120px 90px 120px 110px 120px 80px", gap: 1, marginBottom: 2 }}>
                      {[row.task, user || "—", row.sla, row.time, row.received, row.processed, row.pending].map((v, i) => (
                        <div key={i} style={{ background: "transparent", border: "1px solid #334155", color: i >= 4 ? "#60a5fa" : "#e2e8f0", fontSize: 12, fontWeight: i >= 4 ? 600 : 400, padding: "6px 8px", ...mono }}>{v}</div>
                      ))}
                    </div>
                  ))}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total tickets",    value: teamTickets,       sub: `${teamEntries} entries`,       color: "#60a5fa" },
                { label: "Entries processed",value: teamEntries,       sub: `across ${teamTickets} tickets`, color: "#60a5fa" },
                { label: "Total time",       value: fmtMs(teamMs),     sub: "team combined",                color: "#60a5fa" },
                { label: "SLA met",          value: `${teamSLAPct}%`,  sub: teamBreached > 0 ? `${teamBreached} breached` : "All on time", color: teamSLAPct >= 90 ? "#22c55e" : teamSLAPct >= 70 ? "#f59e0b" : "#ef4444" },
                { label: "Avg per ticket",   value: fmtMs(teamAvgMs),  sub: "team average",                 color: "#a78bfa" },
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
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", ...mono }}>{fmtMs(p.ms)}</div>
                          <div style={{ fontSize: 9, color: "#475569" }}>total time</div>
                        </div>
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

            {/* Team awaiting response panel */}
            {(() => {
              const teamAwaiting = Object.entries(teamData).flatMap(([u, ss]) =>
                ss.filter(s => s.outcome === "awaiting" && s.zdId && (s.taskType || "placement") === taskType)
                  .map(s => ({ ...s, u }))
              ).sort((a, b) => a.endTime - b.endTime);
              if (teamAwaiting.length === 0) return null;
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                    ⏳ Team awaiting response — {teamAwaiting.length} open
                  </div>
                  <div style={{ background: "#0d1321", border: "1px solid #f59e0b33", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "26px 90px 1fr 100px 110px 80px", gap: 8, padding: "7px 14px", background: "#111827", borderBottom: "1px solid #1e293b", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      <span></span><span>Owner</span><span>Type</span><span>ZD Ticket</span><span style={{ textAlign: "right" }}>Logged</span><span style={{ textAlign: "right" }}>Age</span>
                    </div>
                    {teamAwaiting.map((s, i) => {
                      const st    = ALL_SUBTYPES.find(x => x.id === s.subtype);
                      const av    = AVATAR_COLORS[s.u] || { bg: "#1e293b", text: "#94a3b8" };
                      const ageMs = Date.now() - s.endTime;
                      const ageMins = Math.floor(ageMs / 60000);
                      const ageStr  = ageMins < 60 ? `${ageMins}m` : ageMins < 1440 ? `${Math.floor(ageMins/60)}h ${ageMins%60}m` : `${Math.floor(ageMins/1440)}d ${Math.floor((ageMins%1440)/60)}h`;
                      const isOld   = ageMins > 60 * 24 * 5;
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 90px 1fr 100px 110px 80px", gap: 8, padding: "9px 14px", borderBottom: i < teamAwaiting.length - 1 ? "1px solid #1e293b" : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : "#0a1929" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600 }}>{initials(s.u)}</div>
                          <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 500 }}>{s.u}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{st?.icon} {st?.label}</span>
                          <span style={{ fontSize: 12, color: "#38bdf8", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{s.zdId}</span>
                          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{new Date(s.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                          <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", textAlign: "right", color: isOld ? "#ef4444" : "#94a3b8", fontWeight: isOld ? 600 : 400 }}>{ageStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize: 10, color: "#1e293b", textAlign: "center", paddingBottom: 8 }}>
              Auto-refreshes every 60s · last updated {new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </>)}
        </>)}
      </div>
    </div>
  );
}
