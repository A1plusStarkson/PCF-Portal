/* ======================= LIQUIDATION ALARMS (LIVE BELL) =======================
   A live alarm bell for liquidations that are about to fall due or are
   overdue. Built ONLY from data the portal already has — the reminders from
   liquidationReminders() (13-reports-aging.jsx), i.e. released vouchers whose
   liquidation is not started, still a draft, or returned for correction.
   Nothing here writes to the PCF database.

   Stages (liquidation is due AGING_DUE_DAYS = 5 days after cash received):
     due1     1 day before the due date   → "LIQUIDATION DUE TOMORROW"
     due0     on the due date             → "LIQUIDATION DUE TODAY"
     overdue  past the 5-day period       → "LIQUIDATION OVERDUE – AUTHORITY TO DEDUCT"

   Live: the reminders are recomputed whenever a record changes (the portal's
   real-time sync) and every minute (the app's clock), so an alarm appears,
   escalates or clears without a page refresh. Submitting the liquidation
   clears it and moves it to history.

   Who: LIQ_ALARM_EMAILS. Each account sees alarms for the plants it can
   already see — so a custodian gets the alarms for the employees of the
   plant(s) in their custody.

   Read / unread and the history are kept per user in this browser
   (localStorage) — a viewer's own convenience state, never PCF data. */

const LIQ_ALARM_EMAILS = [
  "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
  "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
  "pcfrequestordisney@a1plus.com", "pcfrequestormanila@a1plus.com", "pcfrequestorrgandco@a1plus.com",
];

const LIQ_ALARM_STAGE = {
  due1: { key: "due1", title: "LIQUIDATION DUE TOMORROW", icon: "🔔", tint: "#ea580c", bg: "var(--dm-alarm-due1, #fff4ec)" },
  due0: { key: "due0", title: "LIQUIDATION DUE TODAY", icon: "⏰", tint: "#c2410c", bg: "var(--dm-alarm-due0, #ffefe5)" },
  overdue: { key: "overdue", title: "LIQUIDATION OVERDUE – AUTHORITY TO DEDUCT", icon: "⚠️", tint: "#c0392b", bg: "var(--dm-alarm-overdue, #fdf0ef)" },
};
const LIQ_ALARM_HISTORY_MAX = 200;

function liqAlarmStageOf(r) {
  if (r.daysLeft < 0) return "overdue";
  if (r.daysLeft === 0) return "due0";
  if (r.daysLeft === 1) return "due1";
  return null;
}

/* The date an alarm became active (for its timestamp). */
function liqAlarmSince(r, stage) {
  if (stage === "due1") return addDaysISO(r.dueDate, -1);
  if (stage === "due0") return r.dueDate;
  return addDaysISO(r.dueDate, 1);
}

function liqAlarmStoreKey(email) { return "pcp-liq-alarms:" + String(email || "local").toLowerCase(); }
function liqAlarmLoad(email) {
  try {
    const v = JSON.parse(localStorage.getItem(liqAlarmStoreKey(email)) || "null");
    if (v && typeof v === "object") return { read: v.read || {}, history: Array.isArray(v.history) ? v.history : [], desktop: !!v.desktop };
  } catch (e) { /* storage unavailable — start fresh */ }
  return { read: {}, history: [], desktop: false };
}
function liqAlarmSave(email, state) {
  try { localStorage.setItem(liqAlarmStoreKey(email), JSON.stringify(state)); } catch (e) { /* ignore */ }
}
/* Local time (the viewer's clock, e.g. Philippine time) — toISOString() is UTC
   and read 8 hours early. */
const liqAlarmNowStamp = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};

/* Turns the live reminders into alarms, and keeps read state + history in
   step: a new alarm is logged (unread); one that is no longer active is
   marked resolved with the time it cleared. */
function useLiqAlarms(reminders, email, enabled) {
  const [store, setStore] = useState(() => liqAlarmLoad(email));
  useEffect(() => { setStore(liqAlarmLoad(email)); }, [email]);

  const alarms = useMemo(() => (reminders || []).map((r) => {
    const stage = liqAlarmStageOf(r);
    return stage ? { ...r, stage, alarmId: stage + ":" + r.id, since: liqAlarmSince(r, stage) } : null;
  }).filter(Boolean), [reminders]);
  const upcoming = useMemo(() => (reminders || []).filter((r) => !liqAlarmStageOf(r)), [reminders]);

  /* Sync history with the live alarms. */
  const newlySeen = useRef([]);
  useEffect(() => {
    if (!enabled) return;
    setStore((s) => {
      const now = liqAlarmNowStamp();
      const activeIds = new Set(alarms.map((a) => a.alarmId));
      const known = new Map(s.history.map((h) => [h.id, h]));
      let changed = false;
      const fresh = [];
      alarms.forEach((a) => {
        const h = known.get(a.alarmId);
        const snap = {
          id: a.alarmId, stage: a.stage, voucherId: a.id, seriesNo: a.seriesNo, employee: a.employee,
          branchCode: a.branchCode, amount: a.amount, receivedDate: a.receivedDate, dueDate: a.dueDate,
          custodian: a.custodian || "", since: a.since,
        };
        if (!h) { known.set(a.alarmId, { ...snap, firstSeen: now, resolvedAt: "" }); fresh.push(a); changed = true; }
        else if (h.resolvedAt) { known.set(a.alarmId, { ...h, ...snap, resolvedAt: "", reopenedAt: now }); fresh.push(a); changed = true; }
      });
      known.forEach((h, id) => {
        if (!h.resolvedAt && !activeIds.has(id)) { known.set(id, { ...h, resolvedAt: now }); changed = true; }
      });
      if (!changed) return s;
      newlySeen.current = fresh;
      const history = Array.from(known.values())
        .sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)))
        .slice(0, LIQ_ALARM_HISTORY_MAX);
      /* A re-opened alarm (e.g. returned for correction again) is unread again. */
      const read = { ...s.read };
      fresh.forEach((a) => { delete read[a.alarmId]; });
      const next = { ...s, history, read };
      liqAlarmSave(email, next);
      return next;
    });
  }, [alarms, enabled, email]);

  /* Optional desktop notification for alarms that just appeared. */
  useEffect(() => {
    const fresh = newlySeen.current;
    newlySeen.current = [];
    if (!enabled || !store.desktop || !fresh.length) return;
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      fresh.slice(0, 5).forEach((a) => {
        const st = LIQ_ALARM_STAGE[a.stage];
        new Notification(st.title, {
          body: `${a.seriesNo} · ${a.employee} · ${peso(a.amount)} · due ${fmtDate(a.dueDate)}`,
          tag: a.alarmId,
        });
      });
    } catch (e) { /* notifications unavailable */ }
  }, [store, enabled]);

  const update = (fn) => setStore((s) => { const next = fn(s); liqAlarmSave(email, next); return next; });
  const isRead = (id) => !!store.read[id];
  const markRead = (id) => update((s) => ({ ...s, read: { ...s.read, [id]: liqAlarmNowStamp() } }));
  const markUnread = (id) => update((s) => { const read = { ...s.read }; delete read[id]; return { ...s, read }; });
  const markAllRead = () => update((s) => {
    const read = { ...s.read };
    alarms.forEach((a) => { read[a.alarmId] = read[a.alarmId] || liqAlarmNowStamp(); });
    return { ...s, read };
  });
  const clearHistory = () => update((s) => ({ ...s, history: s.history.filter((h) => !h.resolvedAt) }));
  const setDesktop = async (on) => {
    if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try { await Notification.requestPermission(); } catch (e) { /* ignore */ }
    }
    update((s) => ({ ...s, desktop: !!on }));
  };
  const firstSeenOf = (id) => { const h = store.history.find((x) => x.id === id); return h ? h.firstSeen : ""; };
  const unread = alarms.filter((a) => !store.read[a.alarmId]);

  return {
    enabled: !!enabled, alarms, upcoming, history: store.history, unreadCount: unread.length,
    unreadOverdue: unread.some((a) => a.stage === "overdue"),
    isRead, markRead, markUnread, markAllRead, clearHistory, firstSeenOf,
    desktop: store.desktop, setDesktop,
  };
}

function liqAlarmDaysText(r) {
  if (r.daysLeft < 0) return `${-r.daysLeft} day${r.daysLeft === -1 ? "" : "s"} overdue`;
  if (r.daysLeft === 0) return "Due today";
  return `${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} remaining`;
}
const liqAlarmStampText = (ts) => (ts ? String(ts).replace("T", " ").slice(0, 16) : "—");

/* One alarm card. */
function LiqAlarmCard({ a, read, firstSeen, onOpen, onToggleRead }) {
  const st = LIQ_ALARM_STAGE[a.stage];
  return (
    <div className={"pcp-alarm-card" + (read ? " read" : "")} style={{ borderColor: st.tint, background: read ? "var(--dm-alarm-read, #fff)" : st.bg }}>
      <div className="pcp-alarm-card-head" style={{ color: st.tint }}>
        <span>{st.icon} {st.title}</span>
        {!read && <span className="pcp-alarm-new" style={{ background: st.tint }}>NEW</span>}
      </div>
      <div className="pcp-alarm-grid">
        <div><span>Employee / Requestor</span><b>{a.employee || "—"}</b></div>
        <div><span>PCF Reference No.</span><b>{a.seriesNo}</b></div>
        {a.stage === "overdue"
          ? <div><span>Outstanding Amount</span><b>{peso(a.amount)}</b></div>
          : <div><span>Amount</span><b>{peso(a.amount)}</b></div>}
        <div><span>Cash Advance Date</span><b>{fmtDate(a.receivedDate)}</b></div>
        <div><span>{a.stage === "overdue" ? "Original Due Date" : "Liquidation Due Date"}</span><b>{fmtDate(a.dueDate)}</b></div>
        <div><span>{a.stage === "overdue" ? "Days Overdue" : "Days Remaining"}</span><b style={{ color: st.tint }}>{liqAlarmDaysText(a)}</b></div>
        <div><span>Liquidation Status</span><b>{a.liqStatus || "—"}</b></div>
        <div><span>Plant · Custodian</span><b>{plantLabel(a.branchCode)}{a.custodian ? ` · ${a.custodian}` : ""}</b></div>
      </div>
      {a.stage === "overdue" && (
        <div className="pcp-alarm-note">
          This liquidation is beyond the allowable {AGING_DUE_DAYS}-day liquidation period and is for the
          <b> Authority to Deduct</b> process, subject to company policy and the required approval.
        </div>
      )}
      <div className="pcp-alarm-foot">
        <span>Alert since {fmtDate(a.since)} · first seen {liqAlarmStampText(firstSeen)}</span>
        <span style={{ display: "flex", gap: 6 }}>
          <button className="pcp-btn pcp-btn-sm" onClick={onToggleRead}>{read ? "Mark unread" : "Mark read"}</button>
          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={onOpen}>Open in Liquidation Aging</button>
        </span>
      </div>
    </div>
  );
}

/* Unread alarms already announced with the Double-Tone. Kept outside the bell
   because every TopBar mounts its own bell — switching pages must not replay
   the sound for alarms the user has already heard. */
let alarmBellHeard = 0;

/* The bell (every TopBar). Reads the alarm state from the AppUI context. */
function LiquidationAlarmBell() {
  const ui = useContext(AppUI);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("active");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const al = ui && ui.liqAlarms;
  const unreadNow = (al && al.enabled && al.unreadCount) || 0;
  useEffect(() => {
    if (unreadNow > alarmBellHeard) playSound("attention");
    alarmBellHeard = unreadNow;
  }, [unreadNow]);
  if (!al || !al.enabled) return null;
  const { alarms, upcoming, history, unreadCount, unreadOverdue } = al;
  const worst = alarms.some((a) => a.stage === "overdue") ? LIQ_ALARM_STAGE.overdue.tint
    : alarms.length ? LIQ_ALARM_STAGE.due1.tint : "var(--text-mut)";
  const openAlarm = (a) => {
    al.markRead(a.alarmId);
    if (ui.onAlarmOpen) ui.onAlarmOpen(a);
    setOpen(false);
  };
  const desktopSupported = typeof Notification !== "undefined";

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className={"pcp-reminder-bell pcp-alarm-bell" + (unreadCount ? " ringing" : "") + (unreadOverdue ? " critical" : "")}
        style={{ borderColor: worst, color: worst }}
        onClick={() => setOpen((o) => !o)}
        title={unreadCount ? `${unreadCount} unread liquidation alarm${unreadCount === 1 ? "" : "s"}` : `${alarms.length} liquidation alarm${alarms.length === 1 ? "" : "s"}`}
        aria-label="Liquidation alarms"
      >
        <Bell size={22} />
        <span className="pcp-reminder-count" style={{ background: unreadCount ? worst : "#8fa397" }}>{unreadCount}</span>
      </button>
      {open && (
        <div className="pcp-notif-panel pcp-reminder-panel pcp-alarm-panel">
          <div className="pcp-notif-head">
            <strong><Bell size={14} /> Liquidation Alarms</strong>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {unreadCount > 0 && <button className="pcp-btn pcp-btn-sm" onClick={al.markAllRead}>Mark all read</button>}
            </span>
          </div>
          <div className="pcp-alarm-tabs">
            <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active ({alarms.length})</button>
            <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming ({upcoming.length})</button>
            <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History ({history.length})</button>
          </div>
          <div className="pcp-alarm-body">
            {tab === "active" && (alarms.length ? alarms.map((a) => (
              <LiqAlarmCard
                key={a.alarmId} a={a} read={al.isRead(a.alarmId)} firstSeen={al.firstSeenOf(a.alarmId)}
                onOpen={() => openAlarm(a)}
                onToggleRead={() => (al.isRead(a.alarmId) ? al.markUnread(a.alarmId) : al.markRead(a.alarmId))}
              />
            )) : <div className="pcp-empty" style={{ padding: 24 }}>No liquidation is due tomorrow, due today or overdue.</div>)}

            {tab === "upcoming" && (upcoming.length ? (
              <table className="pcp-table">
                <thead><tr><th>PCF Ref.</th><th>Employee</th><th>Cash Advance</th><th>Due Date</th><th>Days Left</th></tr></thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r.id} className="pcp-liq-row" onClick={() => { if (ui.onAlarmOpen) ui.onAlarmOpen(r); setOpen(false); }}>
                      <td><strong>{r.seriesNo}</strong></td><td>{r.employee}</td>
                      <td>{fmtDate(r.receivedDate)}</td><td>{fmtDate(r.dueDate)}</td><td>{liqAlarmDaysText(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="pcp-empty" style={{ padding: 24 }}>No other liquidations pending.</div>)}

            {tab === "history" && (history.length ? (
              <>
                <table className="pcp-table">
                  <thead><tr><th>Alarm</th><th>PCF Ref.</th><th>Employee</th><th>First Seen</th><th>Status</th></tr></thead>
                  <tbody>
                    {history.map((h) => {
                      const st = LIQ_ALARM_STAGE[h.stage] || LIQ_ALARM_STAGE.overdue;
                      return (
                        <tr key={h.id}>
                          <td style={{ color: st.tint, fontWeight: 600, whiteSpace: "normal", maxWidth: 190 }}>{st.icon} {st.title}</td>
                          <td><strong>{h.seriesNo}</strong></td>
                          <td>{h.employee}</td>
                          <td>{liqAlarmStampText(h.firstSeen)}</td>
                          <td>{h.resolvedAt
                            ? <span className="pcp-badge pcp-badge-green">Cleared {liqAlarmStampText(h.resolvedAt)}</span>
                            : <span className="pcp-badge pcp-badge-red">Active</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {history.some((h) => h.resolvedAt) && (
                  <div style={{ textAlign: "right", marginTop: 8 }}>
                    <button className="pcp-btn pcp-btn-sm" onClick={al.clearHistory}>Clear cleared alarms</button>
                  </div>
                )}
              </>
            ) : <div className="pcp-empty" style={{ padding: 24 }}>No alarm history yet.</div>)}
          </div>
          {desktopSupported && (
            <label className="pcp-alarm-desktop">
              <input type="checkbox" checked={!!al.desktop} onChange={(e) => al.setDesktop(e.target.checked)} />
              Also show desktop pop-up alerts for new alarms (this browser)
            </label>
          )}
        </div>
      )}
    </div>
  );
}
