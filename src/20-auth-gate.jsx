/* ============================= AUTH GATE ============================= */

const LOCAL_SESSION_KEY = "pcp-local-session";

/* Validate a username/password against the built-in accounts defined in
   index.html (window.PCP_LOCAL_USERS). Used only when no Supabase database
   is configured, so there is a working login/logout out of the box. */
function localSignIn(username, password) {
  const users = window.PCP_LOCAL_USERS || [];
  const u = users.find((x) =>
    String(x.user).trim().toLowerCase() === String(username).trim().toLowerCase() &&
    String(x.password) === String(password)
  );
  if (!u) return null;
  return { user: u.user, role: (u.role && ROLES[u.role]) ? u.role : "Custodian", name: u.name || u.user, plants: u.plants || "ALL", excludePlants: u.excludePlants || [] };
}

/* Sign-in screen. mode="cloud" uses Supabase email/password; mode="local"
   uses the built-in accounts (username/password). */
/* Plain-language sign-in errors. The authentication service deliberately
   answers an unknown account and a wrong password with the SAME error, so
   nobody can probe which accounts exist — the message keeps it that way. */
function friendlyLoginError(err, cloud) {
  const e = err || {};
  const msg = String(e.message || "").toLowerCase();
  const code = String(e.code || "").toLowerCase();
  const status = Number(e.status) || 0;
  if (code === "invalid_credentials" || msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("invalid username") || msg.includes("incorrect")) {
    return { title: `Incorrect ${cloud ? "email" : "username"} or password`, text: `Check your ${cloud ? "email address" : "username"} and password, then try again. Passwords are case-sensitive.` };
  }
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
    return { title: "Account not yet activated", text: "This account has not been confirmed. Ask your administrator to activate it." };
  }
  if (status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many")) {
    return { title: "Too many sign-in attempts", text: "Please wait a few minutes before trying again." };
  }
  if (status === 0 || msg.includes("fetch") || msg.includes("network") || msg.includes("timeout") || msg.includes("not configured")) {
    return { title: "Cannot reach the portal server", text: "Check your internet connection and try again. If it keeps happening, contact your administrator." };
  }
  if (status >= 500) {
    return { title: "The portal server is having a problem", text: "Please try again in a few minutes. If it keeps happening, contact your administrator." };
  }
  return { title: "Sign-in failed", text: e.message || "Please try again. If it keeps happening, contact your administrator." };
}

/* Decorative ₱ animation for the login brand panel: stacks of gold ₱ coins
   behind banded bundles of peso bills, with a ₱ coin turning above them. The
   bundles float gently, a light sheen sweeps across the bills and the glow
   breathes. Pure CSS (transform and opacity only, no images or libraries), so
   it costs nothing to load; it stands still for users who ask their system
   for reduced motion. */
function PesoVisual() {
  const stacks = ["s1", "s2", "s3", "s4"];
  const bundles = [
    { cls: "u1", value: "1000" },
    { cls: "u2", value: "1000" },
    { cls: "u3", value: "500" },
  ];
  return (
    <div className="pcp-peso-scene" aria-hidden="true">
      <div className="pcp-peso-glow" />
      {stacks.map((s) => (
        <div key={s} className={"pcp-cash-stack " + s}><div className="pcp-cash-stack-top"><span>₱</span></div></div>
      ))}
      {bundles.map((b) => (
        <div key={b.cls} className={"pcp-cash-bundle " + b.cls}>
          <div className="pcp-cash-bill">
            <span className="pcp-cash-seal">₱</span>
            <span className="pcp-cash-val">₱{b.value}</span>
          </div>
          <span className="pcp-cash-band" />
        </div>
      ))}
      <div className="pcp-cash-coin"><span>₱</span></div>
      <i className="pcp-cash-spark k1" /><i className="pcp-cash-spark k2" />
    </div>
  );
}

/* The four stages named in the lead line, shown as a strip. */
const LOGIN_STEPS = [
  { label: "Request", icon: ClipboardList },
  { label: "Release", icon: Banknote },
  { label: "Liquidate", icon: Receipt },
  { label: "Replenish", icon: RefreshCw },
];

/* Left-hand brand panel shared by the sign-in and two-step screens. */
function LoginBrandPanel() {
  return (
    <aside className="pcp-login-brand">
      <div className="pcp-login-brand-top">
        <div className="pcp-login-logo-tile"><img src={LOGO_PORTAL} alt="Petty Cash Portal logo" /></div>
        <div>
          <div className="pcp-login-brand-name">Petty Cash Portal</div>
          <div className="pcp-login-brand-sub">Imprest Fund Management System</div>
        </div>
        {/* Small screens only: the ₱ coin, since the full artwork is hidden there. */}
        <div className="pcp-cash-coin pcp-cash-coin-mini" aria-hidden="true"><span>₱</span></div>
      </div>
      {/* Text on the left; on wide screens the ₱ artwork sits beside it
          instead of under it, so the panel has no empty half. */}
      <div className="pcp-login-brand-mid">
        <div className="pcp-login-brand-text">
          <h1 className="pcp-login-hero">Manage petty cash with confidence.</h1>
          <p className="pcp-login-lead">Request, release, liquidate and replenish — with every approval and receipt on record.</p>
          <ol className="pcp-login-steps" aria-label="How petty cash moves through the portal">
            {LOGIN_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.label}>
                  <span className="pcp-login-step-icon"><Icon size={15} /></span>
                  <span>{s.label}</span>
                  {i < LOGIN_STEPS.length - 1 && <ChevronRight className="pcp-login-step-arrow" size={14} aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
          {/* Short informational description of petty cash (owner's wording). */}
          <div className="pcp-login-about">
            <div className="pcp-login-about-kicker">What is Petty Cash?</div>
            <p>Petty cash is a small reserve of cash kept on hand by a business to pay for minor expenses, offering convenience for quick and small-scale transactions.</p>
          </div>
          {/* Same quote as Home today (homeDailyQuote in 24-home.jsx). */}
          <div className="pcp-login-quote">
            <div className="pcp-login-quote-kicker">☀️ Today's Cheer-Up</div>
            <div className="pcp-login-quote-text">“{homeDailyQuote(new Date())}”</div>
          </div>
        </div>
        <PesoVisual />
      </div>
      <div className="pcp-login-brand-foot">
        <span>{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        <PhilippineClock />
      </div>
    </aside>
  );
}

/* "Remember me on this computer": the EMAIL only, never the password, in this
   browser's storage. Wrapped so a blocked storage just means no remembering. */
/* Turns a login username (PCP_LOGIN_USERNAMES in index.html) into its email;
   anything else is returned trimmed, as typed. */
const resolveLoginId = (id) => {
  const v = String(id || "").trim();
  const map = window.PCP_LOGIN_USERNAMES || {};
  return map[v.replace(/\s+/g, " ").toLowerCase()] || v;
};

const LOGIN_REMEMBER_KEY = "pcp.rememberEmail";
const readRememberedEmail = () => { try { return localStorage.getItem(LOGIN_REMEMBER_KEY) || ""; } catch (e) { return ""; } };
const writeRememberedEmail = (v) => {
  try { if (v) localStorage.setItem(LOGIN_REMEMBER_KEY, v); else localStorage.removeItem(LOGIN_REMEMBER_KEY); } catch (e) { /* storage unavailable */ }
};

/* ---- Landing splash (once per browser session) ----
   Shown in front of the sign-in the first time the portal is opened in a tab
   session; ENTER PCF PORTAL hides it until the tab is closed. The intro plays
   once (≈7 s): the ₱ appears, the wallet rises behind it, coins settle, then a
   ₱ coin travels the petty cash cycle — Request → Approval → Release →
   Liquidation → Replenishment — drawing the ring as it goes. After that only
   a slow idle float remains. Pure CSS (transform / opacity, one SVG stroke);
   reduced motion shows the finished picture with no movement.
   Sound: never forced. The cues below play only once the visitor has
   interacted with the page (e.g. turned sound on mid-intro); ENTER itself plays
   the welcome chime. All of it obeys the shared Sounds on/off setting. */
const SPLASH_SEEN_KEY = "pcp.splashSeen";
const splashSeen = () => { try { return sessionStorage.getItem(SPLASH_SEEN_KEY) === "1"; } catch (e) { return true; } };
const markSplashSeen = () => { try { sessionStorage.setItem(SPLASH_SEEN_KEY, "1"); } catch (e) { /* storage unavailable */ } };
const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/* The cycle, clockwise from the top; `at` is when the coin reaches it (ms). */
/* The cycle's rounded square (360x360 art): 220 wide, corners r=22, drawn
   clockwise from the middle of the top edge. The ring stroke and the coin's
   motion path (offset-path in 07-styles.jsx) both follow it; the five steps
   sit at every 20% of its length. Keep the two copies identical. */
const PCF_LOOP_PATH = "M180 70 H268 A22 22 0 0 1 290 92 V268 A22 22 0 0 1 268 290 H92 A22 22 0 0 1 70 268 V92 A22 22 0 0 1 92 70 Z";

const PCF_CYCLE = [
  { key: "request", label: "Request", icon: ClipboardList, at: 1600 },
  { key: "approval", label: "Approval", icon: CircleCheck, at: 2600 },
  { key: "release", label: "Release", icon: Banknote, at: 3600 },
  { key: "liquidation", label: "Liquidation", icon: Receipt, at: 4600 },
  { key: "replenishment", label: "Replenishment", icon: RefreshCw, at: 5600 },
];

function PcfSplash({ onEnter }) {
  const [leaving, setLeaving] = useState(false);
  const enterRef = useRef(null);
  useEffect(() => { if (enterRef.current) enterRef.current.focus({ preventScroll: true }); }, []);
  /* Sound cues in step with the intro — silent unless the visitor has
     already interacted (browsers would block them anyway). */
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const active = () => !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
    const cues = [[0, "chime"], [1600, "coin"], [2600, "confirm"], [6600, "chime"]];
    const ids = cues.map(([ms, kind]) => setTimeout(() => { if (active()) playSound(kind); }, ms));
    return () => ids.forEach(clearTimeout);
  }, []);
  const enter = () => {
    if (leaving) return;
    playSound("welcome");
    markSplashSeen();
    setLeaving(true);
    setTimeout(onEnter, prefersReducedMotion() ? 0 : 380);
  };
  return (
    <section className={"pcf-splash" + (leaving ? " leaving" : "")} aria-labelledby="pcf-splash-title">
      <div className="pcf-splash-art" aria-hidden="true">
        <div className="pcf-halo" />
        <svg className="pcf-ring" viewBox="0 0 360 360">
          <path className="pcf-ring-base" d={PCF_LOOP_PATH} />
          <path className="pcf-ring-draw" d={PCF_LOOP_PATH} pathLength="100" />
        </svg>
        {/* Clockwise arrows midway between the steps, once the ring is drawn. */}
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className={"pcf-ring-arrow a" + i} />)}
        {PCF_CYCLE.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={"pcf-step pcf-step-" + s.key} style={{ animationDelay: s.at + "ms" }}>
              <span className="pcf-step-icon"><Icon size={19} strokeWidth={2.3} /><b className="pcf-step-no">{i + 1}</b></span>
              <span className="pcf-step-label">{s.label}</span>
            </div>
          );
        })}
        <div className="pcf-orbit"><div className="pcf-orbit-coin"><span>₱</span></div></div>
        <div className="pcf-wallet-bills"><i /><i /></div>
        <div className="pcf-wallet"><span className="pcf-wallet-flap" /><span className="pcf-wallet-clasp" /></div>
        <div className="pcf-peso"><span>₱</span></div>
        {["c1", "c2", "c3"].map((c) => <div key={c} className={"pcf-mini-coin " + c}>₱</div>)}
      </div>
      <h1 id="pcf-splash-title" className="pcf-splash-title">
        <span className="pcf-splash-logo"><img src={LOGO_PORTAL} alt="" /></span>PCF Portal
      </h1>
      <p className="pcf-splash-sub">Petty Cash Fund Management System</p>
      <button ref={enterRef} type="button" className="pcf-splash-enter" onClick={enter}>
        Enter PCF Portal <ChevronRight size={18} />
      </button>
      <div className="pcf-splash-sound"><LoginSoundToggle /></div>
    </section>
  );
}

/* Speaker button in the sign-in card's corner: the same switch as the
   sidebar's SoundToggle, so a visitor can mute before signing in. */
function LoginSoundToggle() {
  const [on, setOn] = useState(soundsEnabled);
  useEffect(() => {
    const h = () => setOn(soundsEnabled());
    window.addEventListener(SOUND_EVENT, h);
    return () => window.removeEventListener(SOUND_EVENT, h);
  }, []);
  return (
    <button type="button" className="pcp-login-sound" aria-pressed={on}
      title={on ? "Sounds on — click to mute" : "Sounds off — click to turn on"}
      aria-label={on ? "Mute sounds" : "Turn sounds on"}
      onClick={() => { setSoundsEnabled(!on); if (!on) playSound("chime"); }}>
      {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}

function LoginScreen({ mode, onLocalLogin }) {
  const cloud = mode === "cloud";
  const [identifier, setIdentifier] = useState(() => readRememberedEmail());
  const [remember, setRemember] = useState(() => !!readRememberedEmail());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /* error: { title, text } for the banner; fieldErr: per-field hints. */
  const [error, setError] = useState(null);
  const [fieldErr, setFieldErr] = useState({});
  const [capsOn, setCapsOn] = useState(false);
  /* Changes made before the session expired, still held by this tab. */
  const blockedSaves = useBlockedSaves();
  /* The landing splash, once per tab session (PcfSplash). */
  const [splash, setSplash] = useState(() => !splashSeen());

  /* Welcome sound. Browsers allow no sound until the visitor interacts, so it
     plays on the first click, tap or key press on the page — once. */
  useEffect(() => {
    const evts = ["pointerdown", "keydown"];
    const once = (e) => {
      evts.forEach((ev) => window.removeEventListener(ev, once, true));
      /* A first click on the speaker button is the visitor choosing, and the
         splash plays its own sounds; skip the greeting for both. */
      if (!(e.target && e.target.closest && e.target.closest(".pcp-login-sound, .pcf-splash"))) playSound("welcome");
    };
    evts.forEach((ev) => window.addEventListener(ev, once, true));
    return () => evts.forEach((ev) => window.removeEventListener(ev, once, true));
  }, []);
  /* A failed sign-in gets the Double-Tone. */
  useEffect(() => { if (error) playSound("attention"); }, [error]);

  /* Checked here first so the user gets a clear hint next to the field
     instead of the browser's own pop-up. */
  const validate = () => {
    const f = {};
    const id = resolveLoginId(identifier);
    if (!id) f.id = cloud ? "Enter your email address or username." : "Enter your username.";
    else if (cloud && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) f.id = "Enter a valid email address, e.g. name@a1plus.com.";
    if (!password) f.pw = "Enter your password.";
    return f;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const f = validate();
    setFieldErr(f);
    if (f.id || f.pw) return;
    setBusy(true);
    writeRememberedEmail(remember ? identifier.trim() : "");
    try {
      if (cloud) {
        const res = await window.PCP_AUTH.signIn(resolveLoginId(identifier), password);
        if (res && res.error) setError(friendlyLoginError(res.error, true));
        /* On success, onAuthStateChange in <Root/> swaps in the app — which
           then shows the Login Successful pop-up once (markJustSignedIn). */
        else markJustSignedIn();
      } else {
        markJustSignedIn();
        const res = onLocalLogin(identifier, password);
        if (res && res.error) { takeJustSignedIn(); setError(friendlyLoginError(res.error, false)); }
      }
    } catch (err) {
      setError(friendlyLoginError(cloud ? { status: 0, message: "network" } : err, cloud));
    } finally {
      setBusy(false);
    }
  };
  const onPwKey = (e) => { if (e.getModifierState) setCapsOn(e.getModifierState("CapsLock")); };

  /* NO self-service password reset by design. The accounts are standalone
     identifiers, not real mailboxes, and no SMTP is configured — so the reset
     email could never be delivered. The button used to promise "a reset link is
     on its way", which was a promise the deployment cannot keep. Resets are done
     by the administrator in Supabase (Authentication -> Users). The
     PCP_AUTH.resetPassword helper in index.html is deliberately left in place,
     so restoring this is a small change once real mail delivery exists. */

  /* Display only: reveals the typed password on request. */
  const [showPw, setShowPw] = useState(false);

  if (splash) {
    return (
      <div className="pcp-root">
        <style>{CSS}</style>
        <PcfSplash onEnter={() => setSplash(false)} />
      </div>
    );
  }

  return (
    <div className="pcp-root">
      <style>{CSS}</style>
      <div className="pcp-login-split">
        <LoginBrandPanel />

        {/* Sign-in form */}
        <main className="pcp-login-pane">
          <div className="pcp-login-card">
            <div className="pcp-login-card-head">
              <LoginSoundToggle />
              <img className="pcp-login-card-logo" src={LOGO_PORTAL} alt="" aria-hidden="true" />
              <div className="pcp-login-greet">{homeGreeting(new Date())} 👋</div>
              <h2 className="pcp-login-title">Welcome back</h2>
              <div className="pcp-login-sub">Sign in to the Petty Cash Portal to continue.</div>
            </div>
            <form className="pcp-login-body" onSubmit={submit} noValidate aria-busy={busy}>
              {blockedSaves > 0 && (
                <div className="pcp-login-err pcp-login-alert" role="alert">
                  <AlertTriangle size={16} />
                  <div>
                    <b>Your session expired — {blockedSaves} change{blockedSaves === 1 ? " is" : "s are"} not saved yet</b>
                    <div>Sign in to save {blockedSaves === 1 ? "it" : "them"}. Closing or reloading this tab first will lose {blockedSaves === 1 ? "it" : "them"}.</div>
                  </div>
                </div>
              )}
              {error && (
                <div className="pcp-login-err pcp-login-alert" role="alert">
                  <AlertTriangle size={16} />
                  <div><b>{error.title}</b><div>{error.text}</div></div>
                </div>
              )}
              <div className="pcp-field">
                <label htmlFor="pcp-login-id">{cloud ? "Email or username" : "Username"}</label>
                <div className={"pcp-login-input" + (fieldErr.id ? " invalid" : "")}>
                  <Mail size={17} />
                  <input
                    id="pcp-login-id"
                    type="text"
                    className="pcp-input"
                    autoComplete="username"
                    autoFocus={!identifier}
                    placeholder={cloud ? "name@a1plus.com" : "e.g. a1plus"}
                    value={identifier}
                    disabled={busy}
                    aria-invalid={!!fieldErr.id}
                    aria-describedby={fieldErr.id ? "pcp-login-id-err" : undefined}
                    onChange={(e) => { setIdentifier(e.target.value); if (fieldErr.id) setFieldErr((f) => ({ ...f, id: "" })); }}
                  />
                </div>
                {fieldErr.id && <div className="pcp-login-field-err" id="pcp-login-id-err">{fieldErr.id}</div>}
              </div>
              <div className="pcp-field">
                <label htmlFor="pcp-login-pw">Password</label>
                <div className={"pcp-login-input" + (fieldErr.pw ? " invalid" : "")}>
                  <Lock size={17} />
                  <input
                    id="pcp-login-pw"
                    type={showPw ? "text" : "password"}
                    className="pcp-input"
                    autoComplete="current-password"
                    autoFocus={!!identifier}
                    placeholder="Enter your password"
                    value={password}
                    disabled={busy}
                    aria-invalid={!!fieldErr.pw}
                    aria-describedby={fieldErr.pw ? "pcp-login-pw-err" : undefined}
                    onKeyUp={onPwKey} onKeyDown={onPwKey}
                    onChange={(e) => { setPassword(e.target.value); if (fieldErr.pw) setFieldErr((f) => ({ ...f, pw: "" })); }}
                  />
                  <button type="button" className="pcp-login-eye" onClick={() => setShowPw((v) => !v)}
                    title={showPw ? "Hide password" : "Show password"} aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {fieldErr.pw && <div className="pcp-login-field-err" id="pcp-login-pw-err">{fieldErr.pw}</div>}
                {capsOn && !fieldErr.pw && (
                  <div className="pcp-login-caps" role="status"><AlertTriangle size={14} /> Caps Lock is ON — passwords are case-sensitive.</div>
                )}
              </div>
              <label className="pcp-login-remember">
                <input type="checkbox" checked={remember} disabled={busy}
                  onChange={(e) => { setRemember(e.target.checked); if (!e.target.checked) writeRememberedEmail(""); }} />
                Remember my email on this computer
              </label>
              <button type="submit" className="pcp-btn pcp-btn-primary pcp-login-submit" disabled={busy}>
                {busy ? <><span className="pcp-spinner" aria-hidden="true" /> Signing in…</> : <>Sign In <ChevronRight size={17} aria-hidden="true" /></>}
              </button>
              <div className="pcp-login-secure">
                <ShieldCheck size={14} />
                <span>Secure sign-in · for authorized A1+ Group personnel only</span>
              </div>
              <div className="pcp-login-help">
                <KeyRound size={13} />
                <span>Forgot your password? Contact your administrator to have it reset. Access is provided by your administrator.</span>
              </div>
            </form>
          </div>
          <BrandLogos all />
          <div className="pcp-login-copy">{LOGIN_COPYRIGHT}</div>
        </main>
      </div>
    </div>
  );
}

const LOGIN_COPYRIGHT = `© ${new Date().getFullYear()} A1+ Multinational Packaging, Inc · Starkson Packaging, Inc. · Happy Alliance Mono Film, Inc. · RG & Co. Property Management Corporation`;

/* Two-step sign-in for the accounts in window.PCP_MFA_EMAILS, shown after the
   password is accepted. step="enroll" sets up an authenticator app from a QR
   code (first sign-in only); step="challenge" asks for its current 6-digit
   code. onDone re-checks the session once the code is accepted. */
function MfaScreen({ step, factorId, email, onDone, onSignOut }) {
  const enrolling = step === "enroll";
  const [setup, setSetup] = useState(null); // { id, qr, secret } while enrolling
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enrolling) return;
    let active = true;
    window.PCP_AUTH.mfa.enroll().then((res) => {
      if (!active) return;
      if (res.error || !res.data) { setError((res.error && res.error.message) || "Could not start the authenticator setup."); return; }
      setSetup({ id: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret });
    }).catch(() => { if (active) setError("Could not start the authenticator setup. Check your connection."); });
    return () => { active = false; };
  }, [enrolling]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const c = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(c)) { setError("Enter the 6-digit code shown in your authenticator app."); return; }
    const id = enrolling ? (setup && setup.id) : factorId;
    if (!id) return;
    setBusy(true); setError("");
    try {
      const res = await window.PCP_AUTH.mfa.verify(id, c);
      if (res && res.error) { setError(/invalid|expired/i.test(res.error.message || "") ? "That code is incorrect or has expired. Enter the newest code from the app." : res.error.message); setCode(""); }
      else onDone();
    } catch (err) {
      setError("Could not check the code. Check your connection and try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="pcp-root">
      <style>{CSS}</style>
      <div className="pcp-login-split">
        <LoginBrandPanel />
        <main className="pcp-login-pane">
          <div className="pcp-login-card">
            <div className="pcp-login-card-head">
              <img className="pcp-login-card-logo" src={LOGO_PORTAL} alt="" aria-hidden="true" />
              <h2 className="pcp-login-title">{enrolling ? "Set up two-step sign-in" : "Enter your 6-digit code"}</h2>
              <div className="pcp-login-sub">
                {enrolling
                  ? "Your account has administrator access, so it needs an authenticator app as well as your password."
                  : "Open your authenticator app and enter the code for PCF Portal."}
              </div>
            </div>
            <form className="pcp-login-body" onSubmit={submit} noValidate aria-busy={busy}>
              {error && (
                <div className="pcp-login-err pcp-login-alert" role="alert">
                  <AlertTriangle size={16} />
                  <div>{error}</div>
                </div>
              )}
              {enrolling && (
                <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-mut)", marginBottom: 14 }}>
                  <div>1. Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone.</div>
                  <div>2. In the app, add an account and scan this QR code.</div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                    {setup
                      ? <img src={setup.qr} alt="Authenticator QR code" width={180} height={180} style={{ background: "#fff", padding: 8, borderRadius: 10 }} />
                      : <span className="pcp-spinner" aria-label="Loading QR code" />}
                  </div>
                  {setup && <div>Can't scan? Enter this key instead: <code style={{ wordBreak: "break-all" }}>{setup.secret}</code></div>}
                  <div style={{ marginTop: 6 }}>3. Enter the 6-digit code the app shows.</div>
                </div>
              )}
              <div className="pcp-field">
                <label htmlFor="pcp-mfa-code">6-digit code</label>
                <div className="pcp-login-input">
                  <ShieldCheck size={17} />
                  <input
                    id="pcp-mfa-code"
                    className="pcp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={7}
                    placeholder="123456"
                    value={code}
                    disabled={busy || (enrolling && !setup)}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                  />
                </div>
              </div>
              <button type="submit" className="pcp-btn pcp-btn-primary pcp-login-submit" disabled={busy || (enrolling && !setup)}>
                {busy ? <><span className="pcp-spinner" aria-hidden="true" /> Checking…</> : "Verify"}
              </button>
              <div className="pcp-login-help">
                <KeyRound size={13} />
                <span>
                  Signed in as {email}. Lost your phone? Ask your administrator to remove the authenticator in Supabase, then set it up again.{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); onSignOut(); }}>Sign out</a>
                </span>
              </div>
            </form>
          </div>
          <BrandLogos all />
        </main>
      </div>
    </div>
  );
}

/* Root chooses the auth mode:
   - "cloud": a Supabase database is configured → email login (shared, secure).
   - "local": no database, but built-in accounts exist → username login.
   - "off":  neither → app opens directly as admin (offline/demo). */
