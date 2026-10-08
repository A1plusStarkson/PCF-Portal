/* ============================= HOME (LANDING PAGE) =============================
   The first page after signing in. READ-ONLY by design: it only summarises
   data the user can already see (the visible* / plant-scoped lists from
   19-app.jsx) and links into the modules. Nothing here writes, edits or
   deletes a record, and it grants no access — a quick link or tile only
   appears when the user's role can already open that module.

   Announcements come from window.PCP_ANNOUNCEMENTS in index.html, so they can
   be changed without touching the app code. */

const HOME_CSS = `
  .pcp-home { display: flex; flex-direction: column; gap: 18px; }
  .pcp-home-hero {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); gap: 18px;
    background: radial-gradient(circle at 92% 10%, rgba(136,189,188,0.35), transparent 45%),
                linear-gradient(120deg, #112d32 0%, #254e58 50%, #3c6e76 100%);
    color: #fff; border-radius: 16px; padding: 24px 26px; box-shadow: 0 10px 30px rgba(37,78,88,0.18);
  }
  .pcp-home-kicker { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; opacity: 0.85; }
  .pcp-home-title { margin: 6px 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.3px; }
  .pcp-home-greet { font-size: 14px; opacity: 0.95; }
  .pcp-home-date { font-size: 12px; opacity: 0.8; margin-top: 10px; }
  .pcp-home-clock {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 4px 10px; border-radius: 99px;
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.25); font-size: 12px;
  }
  .pcp-home-clock-time { font-weight: 800; font-size: 14px; font-variant-numeric: tabular-nums; letter-spacing: 0.3px; }
  .pcp-home-clock-zone { opacity: 0.8; font-size: 11px; }
  .pcp-home-user {
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 12px;
    padding: 14px 16px; font-size: 12.5px; display: flex; flex-direction: column; gap: 7px; min-width: 0;
  }
  .pcp-home-user-row { display: flex; gap: 8px; align-items: baseline; min-width: 0; }
  .pcp-home-user-row span:first-child { opacity: 0.75; min-width: 62px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
  .pcp-home-user-row b, .pcp-home-user-row span:last-child { overflow-wrap: anywhere; }
  .pcp-home-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 0 0 12px; }
  .pcp-home-count { margin-left: auto; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 99px; background: var(--brand-soft); color: var(--brand); }
  .pcp-home-hero-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .pcp-home-chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 700;
    background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3); color: #fff; cursor: pointer; font-family: inherit;
  }
  .pcp-home-chip:hover, .pcp-home-chip:focus-visible { background: rgba(255,255,255,0.26); outline: none; }
  .pcp-home-chip.warn { background: rgba(255,120,110,0.28); border-color: rgba(255,170,160,0.6); }
  /* Corporate Teal theme (light mode only). The banner is the page's focal
     point: a deep teal gradient (darkest behind the text) with a soft light
     spot, white text, and frosted panels. */
  :root:not([data-theme="dark"]) .pcp-home-hero {
    background: radial-gradient(circle at 88% -10%, rgba(136,189,188,0.35), transparent 45%),
                radial-gradient(circle at 0% 110%, rgba(136,189,188,0.18), transparent 45%),
                linear-gradient(120deg, #112d32 0%, #254e58 55%, #3c6e76 100%);
    box-shadow: 0 14px 32px rgba(17,45,50,0.28);
  }
  :root:not([data-theme="dark"]) .pcp-home-user,
  :root:not([data-theme="dark"]) .pcp-home-clock { background: rgba(255,255,255,0.10); border-color: rgba(136,189,188,0.45); }
  :root:not([data-theme="dark"]) .pcp-home-chip { background: rgba(255,255,255,0.12); transition: background 0.18s ease; }
  :root:not([data-theme="dark"]) .pcp-home-chip:hover,
  :root:not([data-theme="dark"]) .pcp-home-chip:focus-visible { background: rgba(255,255,255,0.22); }
  :root:not([data-theme="dark"]) .pcp-home-section-title { color: var(--heading); }
  /* Status tiles: the palette's five colours as accents (decorative). */
  :root:not([data-theme="dark"]) .pcp-home-status-item {
    --tile: #112d32;
    border-top: 3px solid var(--tile); box-shadow: 0 2px 8px rgba(17,45,50,0.05);
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  }
  :root:not([data-theme="dark"]) .pcp-home-status-item:nth-child(5n+1) { --tile: #88bdbc; }
  :root:not([data-theme="dark"]) .pcp-home-status-item:nth-child(5n+2) { --tile: #254e58; }
  :root:not([data-theme="dark"]) .pcp-home-status-item:nth-child(5n+3) { --tile: #6e6658; }
  :root:not([data-theme="dark"]) .pcp-home-status-item:nth-child(5n+4) { --tile: #4f4a41; }
  :root:not([data-theme="dark"]) .pcp-home-status-item:hover,
  :root:not([data-theme="dark"]) .pcp-home-status-item:focus-visible {
    background: #fff; border-color: var(--tile); transform: translateY(-2px); box-shadow: 0 8px 18px rgba(17,45,50,0.12);
  }
  :root:not([data-theme="dark"]) .pcp-home-status-item.warn { --tile: #c0392b; background: var(--red-bg); }
  /* Announcements: white notes with a teal edge. */
  :root:not([data-theme="dark"]) .pcp-home-ann {
    background: #fff; border: 1px solid #d3e3e3; border-left: 3px solid var(--accent); border-radius: 8px;
    transition: background 0.18s ease;
  }
  :root:not([data-theme="dark"]) .pcp-home-ann:hover { background: #f2f8f8; }
  :root:not([data-theme="dark"]) .pcp-home-ann-title { color: var(--heading); }
  .pcp-home-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .pcp-home-link {
    display: flex; gap: 14px; align-items: center; text-align: left; background: var(--dm-surface, #fff); border: 1px solid var(--line);
    border-radius: 14px; padding: 16px; cursor: pointer; font: inherit; color: inherit; min-height: 78px;
    transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
  }
  .pcp-home-link:hover, .pcp-home-link:focus-visible { border-color: var(--brand); box-shadow: 0 8px 22px rgba(37,78,88,0.14); transform: translateY(-2px); outline: none; }
  .pcp-home-link-icon { flex-shrink: 0; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .pcp-home-link-label { font-size: 14px; font-weight: 700; }
  .pcp-home-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  .pcp-home-action {
    display: flex; gap: 12px; align-items: center; width: 100%; text-align: left; font: inherit; color: inherit; cursor: pointer;
    background: none; border: none; border-bottom: 1px solid var(--line); padding: 10px 4px;
  }
  .pcp-home-action:last-child { border-bottom: none; }
  .pcp-home-action:hover, .pcp-home-action:focus-visible { background: var(--brand-soft); outline: none; }
  .pcp-home-action-n {
    flex-shrink: 0; min-width: 40px; height: 40px; padding: 0 8px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums;
  }
  .pcp-home-fund { display: block; width: 100%; text-align: left; font: inherit; color: inherit; cursor: pointer; background: none; border: none; border-bottom: 1px solid var(--line); padding: 10px 4px; }
  .pcp-home-fund:last-child { border-bottom: none; }
  .pcp-home-fund:hover, .pcp-home-fund:focus-visible { background: var(--brand-soft); outline: none; }
  .pcp-home-fund-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .pcp-home-fund-amt { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .pcp-home-fund-bar { height: 7px; border-radius: 99px; background: var(--line); overflow: hidden; margin: 6px 0 4px; }
  .pcp-home-fund-bar > span { display: block; height: 100%; border-radius: 99px; }
  .pcp-home-act-time { flex-shrink: 0; font-size: 11px; color: var(--text-mut); white-space: nowrap; }
  .pcp-home-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .pcp-home-link-desc { font-size: 11.5px; color: var(--text-mut); margin-top: 2px; line-height: 1.4; }
  .pcp-home-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .pcp-home-cols { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  .pcp-home-list { display: flex; flex-direction: column; }
  .pcp-home-item {
    display: flex; gap: 10px; align-items: center; padding: 10px 4px; border-bottom: 1px solid var(--line);
    background: none; border-left: none; border-right: none; border-top: none; text-align: left; font: inherit; color: inherit; width: 100%;
  }
  .pcp-home-item:last-child { border-bottom: none; }
  button.pcp-home-item { cursor: pointer; }
  button.pcp-home-item:hover { background: var(--brand-soft); }
  .pcp-home-item-main { flex: 1; min-width: 0; }
  .pcp-home-item-title { font-size: 12.5px; font-weight: 600; }
  .pcp-home-item-sub { font-size: 11.5px; color: var(--text-mut); overflow-wrap: anywhere; }
  .pcp-home-due { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
  .pcp-home-due.red { background: var(--red-bg); color: var(--danger-dark); }
  .pcp-home-due.orange { background: #ffedd5; color: #c2410c; }
  .pcp-home-due.yellow { background: var(--amber-bg); color: #92600a; }
  .pcp-home-due.green { background: var(--green-bg); color: var(--green); }
  .pcp-home-empty { font-size: 12px; color: var(--text-mut); padding: 8px 0; }
  .pcp-home-ann { border-left: 3px solid var(--brand); padding: 8px 12px; background: var(--brand-soft); border-radius: 0 8px 8px 0; margin-bottom: 8px; }
  .pcp-home-ann:last-child { margin-bottom: 0; }
  .pcp-home-ann-title { font-size: 12.5px; font-weight: 700; }
  .pcp-home-ann-text { font-size: 12px; color: var(--text); margin-top: 2px; line-height: 1.5; }
  .pcp-home-ann-date { font-size: 10.5px; color: var(--text-mut); margin-top: 3px; }
  .pcp-home-quote {
    display: flex; gap: 14px; align-items: center; background: var(--dm-surface, #fff); border: 1px solid var(--line);
    border-left: 4px solid #e0a526; border-radius: 12px; padding: 16px 20px;
  }
  .pcp-home-quote-icon { flex-shrink: 0; font-size: 26px; line-height: 1; }
  .pcp-home-quote-kicker { font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #b9790a; }
  .pcp-home-quote-text { font-size: 16px; font-weight: 600; font-style: italic; line-height: 1.45; margin-top: 3px; overflow-wrap: anywhere; }
  .pcp-home-tagline { font-size: 13px; opacity: 0.9; margin: 2px 0 10px; max-width: 640px; line-height: 1.5; }
  .pcp-home-links-main { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pcp-home-links-main .pcp-home-link { min-height: 92px; padding: 18px; }
  .pcp-home-links-main .pcp-home-link-icon { width: 50px; height: 50px; border-radius: 14px; }
  .pcp-home-links-main .pcp-home-link-label { font-size: 15px; text-transform: uppercase; letter-spacing: 0.3px; }
  .pcp-home-status { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .pcp-home-status-item {
    display: flex; flex-direction: column; gap: 2px; text-align: left; font: inherit; color: inherit; cursor: pointer;
    background: var(--dm-surface, #fff); border: 1px solid var(--line); border-radius: 12px; padding: 12px;
  }
  .pcp-home-status-item:hover, .pcp-home-status-item:focus-visible { border-color: var(--brand); background: var(--brand-soft); outline: none; }
  .pcp-home-status-item.warn { border-color: #e8a3a3; background: var(--red-bg); }
  .pcp-home-status-n { font-size: 24px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .pcp-home-status-label { font-size: 12px; font-weight: 700; }
  .pcp-home-ann-card { border-top: 3px solid #c0392b; }
  .pcp-home-flow { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 22px; }
  .pcp-home-flow-step { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; }
  .pcp-home-flow-step:not(:last-child)::after {
    content: "\\2192"; position: absolute; right: -18px; top: 8px; font-size: 16px; color: var(--text-mut);
  }
  .pcp-home-flow-n {
    width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--brand); color: #fff; font-weight: 800; font-size: 14px;
  }
  .pcp-home-flow-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
  .pcp-home-flow-text { font-size: 11px; color: var(--text-mut); line-height: 1.35; }
  @media (max-width: 1100px) {
    .pcp-home-flow { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .pcp-home-flow-step::after { display: none; }
  }
  @media (max-width: 900px) {
    .pcp-home-hero, .pcp-home-cols, .pcp-home-top { grid-template-columns: minmax(0, 1fr); }
    .pcp-home-links-main { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .pcp-home-flow { grid-template-columns: minmax(0, 1fr); }
    .pcp-home-flow-step { flex-direction: row; text-align: left; gap: 10px; }
    .pcp-home-flow-n { flex-shrink: 0; }
  }
  @media (max-width: 520px) {
    .pcp-home-hero { padding: 18px 16px; }
    .pcp-home-title { font-size: 21px; }
    .pcp-home-links { grid-template-columns: minmax(0, 1fr); }
  }
`;

/* Shown when neither the portal (Manage) nor index.html sets announcements. */
const HOME_SUBMIT_REMINDER = {
  title: "Important Reminder",
  text: "After saving your liquidation, please click SUBMIT LIQUIDATION located at the upper-right portion of the screen. A liquidation is not forwarded to the Custodian until SUBMIT LIQUIDATION is clicked.",
};
const HOME_DEFAULT_ANNOUNCEMENTS = [
  HOME_SUBMIT_REMINDER,
  { title: "Liquidate on time", text: `Cash advances must be liquidated within ${AGING_DUE_DAYS} days of release. Upcoming deadlines are listed on this page.` },
  { title: "Series numbers are system-generated", text: "Request and Reimbursement numbers are issued automatically when you submit. They cannot be typed or changed, and are never reused." },
  { title: "Attach complete documents", text: "Upload the Original OR / Sales Invoice for every expense so custodians and approvers can check it on screen." },
];

/* The six main Quick Access cards (keys of homeQuickLinks in 19-app.jsx);
   any other card the account has follows them. */
const HOME_MAIN_LINKS = ["requests", "disbursements", "liquidation", "reimbursement", "replenishment", "dashboard"];

/* How PCF Works — the workflow strip for new requestors. */
const HOME_WORKFLOW = [
  { title: "Request", text: "File a Petty Cash Request" },
  { title: "Approval", text: "Custodian approves it" },
  { title: "Release", text: "Cash is released on a voucher" },
  { title: "Expense", text: "Spend and keep the OR / invoice" },
  { title: "Liquidation / Reimbursement", text: `Liquidate within ${AGING_DUE_DAYS} days, then SUBMIT` },
  { title: "Accounting Check", text: "Custodian review, Accounting check, final approval" },
  { title: "Replenishment", text: "The fund is restored" },
];

/* Daily cheer-up quote (owner's instruction, Oct 2026). One per calendar day,
   the same for everyone that day, stepping through the list in order — so a
   quote only comes back after every other one has been shown (60 days). */
const HOME_DAILY_QUOTES = [
  "Every day is a new opportunity to do something great. Keep going!",
  "Small steps every day add up to big results.",
  "Your hard work matters more than you know. Thank you!",
  "Progress, not perfection. You are doing great.",
  "A positive mind finds a way. Have a wonderful day!",
  "Today is a good day to have a good day.",
  "Believe in yourself — you have handled every tough day so far.",
  "Great things are done by a series of small things brought together.",
  "Teamwork makes the work lighter. We are in this together!",
  "Keep your face to the sunshine and you will not see the shadows.",
  "Do your best today; tomorrow will thank you for it.",
  "One task at a time, one smile at a time.",
  "Your effort today builds the success of tomorrow.",
  "Be proud of how far you have come, and excited for where you are going.",
  "Kindness and accuracy — a winning combination. Keep it up!",
  "Start where you are. Use what you have. Do what you can.",
  "Every well-done task is a quiet victory. Celebrate it!",
  "You bring something special to the team every day.",
  "Stay positive, work hard, and make it happen.",
  "A little progress each day adds up to big things.",
  "Difficult roads often lead to beautiful destinations.",
  "Focus on the good, and the good gets better.",
  "You are capable of amazing things — today included!",
  "Take a deep breath. You have got this.",
  "Consistency is the secret ingredient. Well done for showing up!",
  "Make today so good that yesterday gets jealous.",
  "The best view comes after the hardest climb.",
  "Your attention to detail keeps everything running smoothly. Thank you!",
  "Good things take time — keep at it.",
  "Choose joy, choose patience, choose progress.",
  "Smile — it is contagious, and it makes the work lighter.",
  "Every accomplishment starts with the decision to try.",
  "Mistakes are proof that you are trying. Keep learning!",
  "You are stronger than any deadline.",
  "Bloom where you are planted.",
  "Gratitude turns what we have into enough. Have a grateful day!",
  "Doing the right thing, the right way — that is excellence.",
  "Little by little, a little becomes a lot.",
  "Your positive energy makes a difference to everyone around you.",
  "Today's effort is tomorrow's strength.",
  "Keep calm and carry on — one record at a time.",
  "Success is the sum of small efforts repeated day after day.",
  "A clear mind and a kind heart can tackle anything.",
  "Celebrate the small wins — they lead to the big ones.",
  "Be the reason someone smiles at work today.",
  "Hard work beats talent when talent does not work hard.",
  "You make the team better just by being you.",
  "Every sunrise brings a fresh start. Make the most of it!",
  "Trust the process and enjoy the journey.",
  "Work with purpose, rest with peace.",
  "There is no elevator to success — take the stairs, one step at a time.",
  "The secret of getting ahead is getting started.",
  "Organised today, stress-free tomorrow.",
  "You are doing better than you think. Keep shining!",
  "Courage does not always roar — sometimes it is simply trying again tomorrow.",
  "Good work speaks for itself. Yours speaks loudly!",
  "Be patient with yourself — growth takes time.",
  "Together we achieve more. Thank you for your part!",
  "Let your enthusiasm be your energy today.",
  "End the day proud of what you did, not worried about what you did not.",
];

function homeDailyQuote(d) {
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return HOME_DAILY_QUOTES[day % HOME_DAILY_QUOTES.length];
}

/* Live Philippine Standard Time (Asia/Manila, UTC+8), ticking every second —
   shown under the date whatever time zone the computer is set to. */
function PhilippineClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  let text;
  try {
    text = now.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  } catch (e) {
    /* Very old browsers without time-zone support: compute UTC+8 by hand. */
    const ph = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
    text = ph.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }
  return (
    <div className="pcp-home-clock" aria-live="off" title="Philippine Standard Time (UTC+8)">
      <Clock size={13} /> <span className="pcp-home-clock-time">{text}</span> <span className="pcp-home-clock-zone">Philippine Time</span>
    </div>
  );
}

function homeGreeting(d) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/* "5 min ago" / "3 hr ago" / a date. Audit timestamps are UTC (toISOString). */
function homeAgo(ts) {
  if (!ts) return "";
  const t = new Date(String(ts).length <= 19 ? ts + "Z" : ts).getTime();
  if (isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} day${s < 2 * 86400 ? "" : "s"} ago`;
  return fmtDate(new Date(t).toISOString().slice(0, 10));
}

function homeDueLabel(daysLeft) {
  if (daysLeft < 0) return `Overdue ${-daysLeft} day${daysLeft === -1 ? "" : "s"}`;
  if (daysLeft === 0) return "Due today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/* approvalReminders: when given (Grace Gan), Home shows ONLY what awaits her
   final approval, in place of the liquidation deadlines and notifications. */
/* funds: per-plant balances (null when the role has no dashboard). actions:
   "My action items" from 19-app.jsx. activity: recent audit entries about
   records this account can see. */
/* myStatus: the person's own records (My PCF Status). savedAnnouncements: the
   portal-managed list (empty until first saved — then index.html's list, or
   the built-in one, shows). */
function HomePage({ userName, userEmail, roleLabel, plants, quickLinks, funds, actions, activity, myStatus, announcements: savedAnnouncements, canManageAnnouncements, onSaveAnnouncements, notifications, onNotifClick, deadlines, onDeadlineClick, approvalReminders, onApprovalReminderClick }) {
  const approvalOnly = Array.isArray(approvalReminders);
  const now = new Date();
  const [editingAnn, setEditingAnn] = useState(false);
  const announcements = (savedAnnouncements && savedAnnouncements.length) ? savedAnnouncements
    : (Array.isArray(window.PCP_ANNOUNCEMENTS) && window.PCP_ANNOUNCEMENTS.length)
      ? window.PCP_ANNOUNCEMENTS : HOME_DEFAULT_ANNOUNCEMENTS;
  const statusList = myStatus || [];
  const mainLinks = quickLinks.filter((q) => HOME_MAIN_LINKS.includes(q.key));
  const otherLinks = quickLinks.filter((q) => !HOME_MAIN_LINKS.includes(q.key));
  const shownDeadlines = (deadlines || []).slice(0, 8);
  const shownNotifs = (notifications || []).slice(0, 8);
  const plantNames = (plants || []).map((p) => p.label).join(", ");
  const actionList = actions || [];
  const actionTotal = actionList.reduce((s, a) => s + a.n, 0);
  const lowFunds = (funds || []).filter((f) => f.low);
  const fundTotal = (funds || []).reduce((s, f) => s + f.available, 0);

  return (
    <div className="pcp-home">
      <style>{HOME_CSS}</style>

      {/* Title and the signed-in account */}
      <div className="pcp-home-hero">
        <div style={{ minWidth: 0 }}>
          <div className="pcp-home-kicker">PCF Portal · A1+ Group</div>
          <h2 className="pcp-home-title">Petty Cash Fund Management System</h2>
          <div className="pcp-home-tagline">
            A centralized platform for managing Petty Cash Requests, Releases, Liquidations, Reimbursements, and Replenishments.
          </div>
          <div className="pcp-home-greet">{homeGreeting(now)}{userName ? `, ${userName}` : ""}. Here is what needs your attention today.</div>
          <div className="pcp-home-date">{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          <PhilippineClock />
          {!approvalOnly && (actionTotal > 0 || lowFunds.length > 0) && (
            <div className="pcp-home-hero-chips">
              {actionTotal > 0 && (
                <button type="button" className="pcp-home-chip" onClick={actionList[0].onClick} title={"Open — " + actionList[0].label}>
                  <ClipboardCheck size={13} /> {actionTotal} item{actionTotal === 1 ? "" : "s"} need your action
                </button>
              )}
              {lowFunds.map((f) => (
                <button key={f.code} type="button" className="pcp-home-chip warn" onClick={f.onClick} title={`Open the ${f.label} dashboard`}>
                  <AlertTriangle size={13} /> {f.label} fund is low
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pcp-home-user" aria-label="Signed-in account">
          {userName && <div className="pcp-home-user-row"><span>Name</span><b>{userName}</b></div>}
          {userEmail && <div className="pcp-home-user-row"><span>Account</span><span>{userEmail}</span></div>}
          {roleLabel && <div className="pcp-home-user-row"><span>Role</span><span>{roleLabel}</span></div>}
          {plantNames && <div className="pcp-home-user-row"><span>Plants</span><span>{plantNames}</span></div>}
        </div>
      </div>

      {/* Daily cheer-up quote — changes every calendar day */}
      <div className="pcp-home-quote" role="note" aria-label="Quote of the day">
        <span className="pcp-home-quote-icon" aria-hidden="true">☀️</span>
        <div style={{ minWidth: 0 }}>
          <div className="pcp-home-quote-kicker">Today's Cheer-Up</div>
          <div className="pcp-home-quote-text">“{homeDailyQuote(now)}”</div>
        </div>
      </div>

      {/* My PCF Status + Announcements */}
      <div className="pcp-home-top" style={approvalOnly || !statusList.length ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
        {!approvalOnly && statusList.length > 0 && (
          <div className="pcp-card pcp-card-pad" style={{ minWidth: 0 }}>
            <div className="pcp-home-section-title"><CircleCheck size={16} color="#2f64a6" /> My PCF Status</div>
            <div className="pcp-home-status">
              {statusList.map((s) => (
                <button key={s.key} type="button" className={"pcp-home-status-item" + (s.warn ? " warn" : "")} onClick={s.onClick}
                  title={s.n ? `Open my ${s.label.toLowerCase()}` : `Open ${s.label}`}>
                  <span className="pcp-home-status-n" style={{ color: s.n ? s.tint : "var(--text-mut)" }}>{s.n}</span>
                  <span className="pcp-home-status-label">{s.label}</span>
                  {s.foot && <span className="pcp-home-item-sub">{s.foot}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="pcp-card pcp-card-pad pcp-home-ann-card" style={{ minWidth: 0 }}>
          <div className="pcp-home-section-title">
            <Megaphone size={16} color="#c0392b" /> PCF Portal Announcements
            {canManageAnnouncements && onSaveAnnouncements && (
              <button type="button" className="pcp-btn pcp-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setEditingAnn(true)}>
                <Edit3 size={12} /> Manage
              </button>
            )}
          </div>
          {announcements.map((a, i) => (
            <div key={a.id || i} className="pcp-home-ann">
              {a.title && <div className="pcp-home-ann-title">{a.title}</div>}
              {a.text && <div className="pcp-home-ann-text">{a.text}</div>}
              {a.date && <div className="pcp-home-ann-date">{a.date}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Quick access — the six main modules, then any others; only those
          this account can already open */}
      {quickLinks.length > 0 && (
        <div>
          <div className="pcp-home-section-title">Quick Access</div>
          <div className="pcp-home-links pcp-home-links-main">
            {mainLinks.concat(otherLinks).map((q) => {
              const Icon = q.icon;
              return (
                <button key={q.key} className="pcp-home-link" onClick={q.onClick} title={`Open ${q.label}`}>
                  <span className="pcp-home-link-icon" style={{ background: q.tint + "1f", color: q.tint }}><Icon size={22} /></span>
                  <span style={{ minWidth: 0 }}>
                    <div className="pcp-home-link-label">{q.label}</div>
                    <div className="pcp-home-link-desc">{q.desc}</div>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* My action items + fund balances */}
      {!approvalOnly && (
        <div className="pcp-home-top" style={!funds ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          <div className="pcp-card pcp-card-pad" style={{ minWidth: 0 }}>
            <div className="pcp-home-section-title">
              <ClipboardCheck size={16} color="#237a45" /> My Action Items
              {actionTotal > 0 && <span className="pcp-home-count">{actionTotal}</span>}
            </div>
            {actionList.length ? (
              <div className="pcp-home-list">
                {actionList.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button key={a.key} type="button" className="pcp-home-action" onClick={a.onClick} title={`Open — ${a.label}`}>
                      <span className="pcp-home-action-n" style={{ background: a.tint + "1f", color: a.tint }}>{a.n}</span>
                      <div className="pcp-home-item-main">
                        <div className="pcp-home-item-title">{a.label}</div>
                        {a.foot && <div className="pcp-home-item-sub">{a.foot}</div>}
                      </div>
                      <Icon size={16} color={a.tint} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pcp-home-empty">Nothing needs your action right now. You are all caught up.</div>
            )}
          </div>
          {funds && (
            <div className="pcp-card pcp-card-pad" style={{ minWidth: 0 }}>
              <div className="pcp-home-section-title">
                <Wallet size={16} color="#3c6e76" /> Fund Balances
                <span className="pcp-home-count" title="Total available across your plants">{peso(fundTotal)}</span>
              </div>
              {funds.length ? (
                <div className="pcp-home-list">
                  {funds.map((f) => {
                    const pct = f.fund > 0 ? Math.max(0, Math.min(100, (f.available / f.fund) * 100)) : 0;
                    const color = f.low ? "#c0392b" : pct < 50 ? "#b9790a" : "#3c6e76";
                    return (
                      <button key={f.code} type="button" className="pcp-home-fund" onClick={f.onClick} title={`Open the ${f.label} dashboard`}>
                        <div className="pcp-home-fund-row">
                          <span className="pcp-home-item-title">{f.label}{f.low && <span className="pcp-home-due red" style={{ marginLeft: 8 }}>Low balance</span>}</span>
                          <span className="pcp-home-fund-amt" style={{ color: f.low ? color : undefined }}>{peso(f.available)}</span>
                        </div>
                        <div className="pcp-home-fund-bar"><span style={{ width: pct + "%", background: color }} /></div>
                        <div className="pcp-home-item-sub">{Math.round(pct)}% of {peso(f.fund)} fund · {peso(f.outstanding)} in open advances</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="pcp-home-empty">No petty cash funds are set up for your plants.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* How PCF works — the workflow, for new requestors */}
      <div className="pcp-card pcp-card-pad">
        <div className="pcp-home-section-title"><RefreshCw size={16} color="#3c6e76" /> How PCF Works</div>
        <ol className="pcp-home-flow">
          {HOME_WORKFLOW.map((s, i) => (
            <li key={s.title} className="pcp-home-flow-step">
              <span className="pcp-home-flow-n">{i + 1}</span>
              <span className="pcp-home-flow-title">{s.title}</span>
              <span className="pcp-home-flow-text">{s.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="pcp-home-cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {approvalOnly && (
            <div className="pcp-card pcp-card-pad">
              <div className="pcp-home-section-title">
                <ClipboardCheck size={16} color="#b9790a" /> Awaiting Your Final Approval ({approvalReminders.length})
              </div>
              {approvalReminders.length ? (
                <div className="pcp-home-list">
                  {approvalReminders.slice(0, 10).map((a) => (
                    <button key={a.id} className="pcp-home-item" onClick={() => onApprovalReminderClick && onApprovalReminderClick(a)} title="Open the Approval Module">
                      <div className="pcp-home-item-main">
                        <div className="pcp-home-item-title">{a.seriesNo} · {a.employee}</div>
                        <div className="pcp-home-item-sub">
                          {plantLabel(plantOfBranch(a.branchCode))}{plantOfBranch(a.branchCode) !== a.branchCode ? ` (${plantLabel(a.branchCode)})` : ""} · {a.kind} · {peso(a.amount)}
                        </div>
                      </div>
                      {a.batchNo && <span className="pcp-home-due yellow">{a.batchNo}</span>}
                    </button>
                  ))}
                  {approvalReminders.length > 10 && (
                    <div className="pcp-home-empty">+ {approvalReminders.length - 10} more in the Approval Module</div>
                  )}
                </div>
              ) : (
                <div className="pcp-home-empty">Nothing is awaiting your final approval. You are all caught up.</div>
              )}
            </div>
          )}
          {/* Upcoming liquidation deadlines */}
          {!approvalOnly && (<>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-home-section-title"><CalendarClock size={16} color="#b9790a" /> Upcoming Liquidation Deadlines</div>
            {shownDeadlines.length ? (
              <div className="pcp-home-list">
                {shownDeadlines.map((d) => (
                  <button key={d.id} className="pcp-home-item" onClick={() => onDeadlineClick && onDeadlineClick(d)} title={`Open the liquidation for ${d.seriesNo}`}>
                    <div className="pcp-home-item-main">
                      <div className="pcp-home-item-title">{d.seriesNo} · {d.employee}</div>
                      <div className="pcp-home-item-sub">
                        {plantLabel(d.branchCode)} · {peso(d.amount)} · due {fmtDate(d.dueDate)}{d.returned ? " · returned for correction" : ""}
                      </div>
                    </div>
                    <span className={"pcp-home-due " + d.level}>{homeDueLabel(d.daysLeft)}</span>
                  </button>
                ))}
                {(deadlines || []).length > shownDeadlines.length && (
                  <div className="pcp-home-empty">+ {deadlines.length - shownDeadlines.length} more in the Liquidation module</div>
                )}
              </div>
            ) : (
              <div className="pcp-home-empty">No liquidations are waiting. Everything released has been liquidated.</div>
            )}
          </div>

          {/* Notifications / pending actions */}
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-home-section-title"><Bell size={16} color="#2054a3" /> Notifications &amp; Reminders</div>
            {shownNotifs.length ? (
              <div className="pcp-home-list">
                {shownNotifs.map((n) => (
                  <button key={n.id} className="pcp-home-item" onClick={() => onNotifClick && onNotifClick(n)}>
                    <div className="pcp-home-item-main">
                      <div className="pcp-home-item-title">{n.title}</div>
                      <div className="pcp-home-item-sub">{n.text}</div>
                    </div>
                    {n.date && <span style={{ fontSize: 11, color: "var(--text-mut)", whiteSpace: "nowrap" }}>{fmtDate(n.date)}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="pcp-home-empty">You are all caught up.</div>
            )}
          </div>
          </>)}
        </div>

        {/* Recent activity on records this account can see */}
        {!approvalOnly && activity && (
          <div className="pcp-card pcp-card-pad" style={{ minWidth: 0 }}>
            <div className="pcp-home-section-title"><History size={16} color="#6a4fb8" /> Recent Activity</div>
            {activity.length ? (
              <div className="pcp-home-list">
                {activity.map((a) => (
                  <div key={a.id || (a.ts + a.entity)} className="pcp-home-item">
                    <div className="pcp-home-item-main">
                      <div className="pcp-home-item-title">{a.action} · {a.entity}</div>
                      {a.remarks && <div className="pcp-home-item-sub pcp-home-clamp" title={a.remarks}>{a.remarks}</div>}
                      {a.user && <div className="pcp-home-item-sub">by {a.user}</div>}
                    </div>
                    <span className="pcp-home-act-time" title={String(a.ts || "").replace("T", " ") + " UTC"}>{homeAgo(a.ts)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pcp-home-empty">No recent activity yet.</div>
            )}
          </div>
        )}
      </div>

      {editingAnn && (
        <AnnouncementEditor
          initial={announcements}
          onClose={() => setEditingAnn(false)}
          onSave={(list) => { onSaveAnnouncements(list); setEditingAnn(false); }}
        />
      )}
    </div>
  );
}

/* Announcement editor (Accounting / admins). Starts from what Home shows now,
   so the first save carries the index.html list over instead of losing it. */
function AnnouncementEditor({ initial, onClose, onSave }) {
  const [rows, setRows] = useState(() => (initial || []).map((a) => ({ id: a.id, title: a.title || "", text: a.text || "", date: a.date || "" })));
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, by) => setRows((rs) => {
    const j = i + by;
    if (j < 0 || j >= rs.length) return rs;
    const copy = rs.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const clean = rows.map((r) => ({ ...r, title: r.title.trim(), text: r.text.trim(), date: r.date.trim() })).filter((r) => r.title || r.text);
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 760, width: "100%" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Manage announcements">
        <div className="pcp-modal-head">
          <h3>Manage PCF Portal Announcements</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ fontSize: 12.5, color: "var(--text-mut)", marginBottom: 12 }}>
            Shown on everyone's Home page, top first. Saved changes appear for all users right away and are recorded in the Audit Trail.
          </div>
          {rows.map((r, i) => (
            <div key={r.id || "new" + i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input className="pcp-input" placeholder="Title, e.g. Important Reminder" value={r.title} onChange={(e) => set(i, { title: e.target.value })} />
                <input className="pcp-input" style={{ width: 150 }} placeholder="Date (optional)" value={r.date} onChange={(e) => set(i, { date: e.target.value })} />
                <button type="button" className="pcp-btn pcp-btn-sm pcp-btn-ghost" disabled={i === 0} onClick={() => move(i, -1)} title="Move up"><ChevronLeft size={13} style={{ transform: "rotate(90deg)" }} /></button>
                <button type="button" className="pcp-btn pcp-btn-sm pcp-btn-ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Move down"><ChevronRight size={13} style={{ transform: "rotate(90deg)" }} /></button>
                <button type="button" className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove"><Trash2 size={13} color="var(--danger)" /></button>
              </div>
              <textarea className="pcp-input" rows={3} style={{ resize: "vertical", width: "100%" }} placeholder="Message" value={r.text} onChange={(e) => set(i, { text: e.target.value })} />
            </div>
          ))}
          <button type="button" className="pcp-btn pcp-btn-sm" onClick={() => setRows((rs) => rs.concat([{ title: "", text: "", date: "" }]))}>
            <Plus size={13} /> Add announcement
          </button>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!clean.length} onClick={() => onSave(clean)}>
            <Check size={13} /> Publish {clean.length} announcement{clean.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
