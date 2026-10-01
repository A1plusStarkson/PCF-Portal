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
    background: radial-gradient(circle at 92% 10%, rgba(167,215,189,0.35), transparent 45%),
                linear-gradient(120deg, #2c4a3c 0%, #3d654f 50%, #5a8d70 100%);
    color: #fff; border-radius: 16px; padding: 24px 26px; box-shadow: 0 10px 30px rgba(78,125,99,0.18);
  }
  .pcp-home-kicker { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; opacity: 0.85; }
  .pcp-home-title { margin: 6px 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.3px; }
  .pcp-home-greet { font-size: 14px; opacity: 0.95; }
  .pcp-home-date { font-size: 12px; opacity: 0.8; margin-top: 10px; }
  .pcp-home-user {
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 12px;
    padding: 14px 16px; font-size: 12.5px; display: flex; flex-direction: column; gap: 7px; min-width: 0;
  }
  .pcp-home-user-row { display: flex; gap: 8px; align-items: baseline; min-width: 0; }
  .pcp-home-user-row span:first-child { opacity: 0.75; min-width: 62px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
  .pcp-home-user-row b, .pcp-home-user-row span:last-child { overflow-wrap: anywhere; }
  .pcp-home-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 0 0 12px; }
  .pcp-home-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .pcp-home-link {
    display: flex; gap: 12px; align-items: flex-start; text-align: left; background: var(--dm-surface, #fff); border: 1px solid var(--line);
    border-radius: 12px; padding: 14px; cursor: pointer; font: inherit; color: inherit;
    transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
  }
  .pcp-home-link:hover, .pcp-home-link:focus-visible { border-color: var(--brand); box-shadow: 0 6px 18px rgba(78,125,99,0.12); transform: translateY(-1px); outline: none; }
  .pcp-home-link-icon { flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .pcp-home-link-label { font-size: 13.5px; font-weight: 700; }
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
  @media (max-width: 900px) {
    .pcp-home-hero, .pcp-home-cols { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 520px) {
    .pcp-home-hero { padding: 18px 16px; }
    .pcp-home-title { font-size: 21px; }
    .pcp-home-links { grid-template-columns: minmax(0, 1fr); }
  }
`;

/* Shown when index.html sets no announcements of its own. */
const HOME_DEFAULT_ANNOUNCEMENTS = [
  { title: "Liquidate on time", text: `Cash advances must be liquidated within ${AGING_DUE_DAYS} days of release. Upcoming deadlines are listed on this page.` },
  { title: "Series numbers are system-generated", text: "Request and Reimbursement numbers are issued automatically when you submit. They cannot be typed or changed, and are never reused." },
  { title: "Attach complete documents", text: "Upload the Original OR / Sales Invoice for every expense so custodians and approvers can check it on screen." },
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

function homeGreeting(d) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function homeDueLabel(daysLeft) {
  if (daysLeft < 0) return `Overdue ${-daysLeft} day${daysLeft === -1 ? "" : "s"}`;
  if (daysLeft === 0) return "Due today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

function HomePage({ userName, userEmail, roleLabel, plants, quickLinks, stats, notifications, onNotifClick, deadlines, onDeadlineClick }) {
  const now = new Date();
  const announcements = (Array.isArray(window.PCP_ANNOUNCEMENTS) && window.PCP_ANNOUNCEMENTS.length)
    ? window.PCP_ANNOUNCEMENTS : HOME_DEFAULT_ANNOUNCEMENTS;
  const shownDeadlines = (deadlines || []).slice(0, 8);
  const shownNotifs = (notifications || []).slice(0, 8);
  const plantNames = (plants || []).map((p) => p.label).join(", ");

  return (
    <div className="pcp-home">
      <style>{HOME_CSS}</style>

      {/* Title and the signed-in account */}
      <div className="pcp-home-hero">
        <div style={{ minWidth: 0 }}>
          <div className="pcp-home-kicker">A1+ Group · Imprest Fund System</div>
          <h2 className="pcp-home-title">Petty Cash Portal</h2>
          <div className="pcp-home-greet">{homeGreeting(now)}{userName ? `, ${userName}` : ""}. Here is what needs your attention today.</div>
          <div className="pcp-home-date">{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
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

      {/* Quick access — only modules this account can already open */}
      {quickLinks.length > 0 && (
        <div>
          <div className="pcp-home-section-title">Quick Access</div>
          <div className="pcp-home-links">
            {quickLinks.map((q) => {
              const Icon = q.icon;
              return (
                <button key={q.key} className="pcp-home-link" onClick={q.onClick} title={`Open ${q.label}`}>
                  <span className="pcp-home-link-icon" style={{ background: q.tint + "1f", color: q.tint }}><Icon size={18} /></span>
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

      {/* Pending actions at a glance */}
      {stats.length > 0 && (
        <div className="pcp-home-stats">
          {stats.map((s) => (
            <KpiCard key={s.label} label={s.label} value={s.value} icon={s.icon} tint={s.tint} foot={s.foot} onClick={s.onClick} />
          ))}
        </div>
      )}

      <div className="pcp-home-cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {/* Upcoming liquidation deadlines */}
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
        </div>

        {/* System announcements */}
        <div className="pcp-card pcp-card-pad" style={{ minWidth: 0 }}>
          <div className="pcp-home-section-title"><Megaphone size={16} color="#4e7d63" /> Announcements</div>
          {announcements.map((a, i) => (
            <div key={i} className="pcp-home-ann">
              {a.title && <div className="pcp-home-ann-title">{a.title}</div>}
              {a.text && <div className="pcp-home-ann-text">{a.text}</div>}
              {a.date && <div className="pcp-home-ann-date">{a.date}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
