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

/* Decorative ₱ animation for the login brand panel: a stack of peso bills
   floating gently with gold coins rising past them. Pure CSS (transform and
   opacity only, no images or libraries), so it costs nothing to load; it
   stands still for users who ask their system for reduced motion. */
function PesoVisual() {
  const bills = [
    { cls: "b3", value: "1000" },
    { cls: "b2", value: "500" },
    { cls: "b1", value: "1000" },
  ];
  return (
    <div className="pcp-peso-scene" aria-hidden="true">
      <div className="pcp-peso-glow" />
      <div className="pcp-peso-bills">
        {bills.map((b) => (
          <div key={b.cls} className={"pcp-peso-bill " + b.cls}>
            <span className="pcp-peso-bill-val tl">₱{b.value}</span>
            <span className="pcp-peso-bill-seal">₱</span>
            <span className="pcp-peso-bill-lines"><i /><i /><i /></span>
            <span className="pcp-peso-bill-val br">{b.value}</span>
          </div>
        ))}
      </div>
      {["c1", "c2", "c3", "c4", "c5"].map((c) => (
        <div key={c} className={"pcp-peso-coin " + c}><span>₱</span></div>
      ))}
    </div>
  );
}

function LoginScreen({ mode, onLocalLogin }) {
  const cloud = mode === "cloud";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /* error: { title, text } for the banner; fieldErr: per-field hints. */
  const [error, setError] = useState(null);
  const [fieldErr, setFieldErr] = useState({});
  const [capsOn, setCapsOn] = useState(false);

  /* Checked here first so the user gets a clear hint next to the field
     instead of the browser's own pop-up. */
  const validate = () => {
    const f = {};
    const id = identifier.trim();
    if (!id) f.id = cloud ? "Enter your email address." : "Enter your username.";
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
    try {
      if (cloud) {
        const res = await window.PCP_AUTH.signIn(identifier.trim(), password);
        if (res && res.error) setError(friendlyLoginError(res.error, true));
        /* On success, onAuthStateChange in <Root/> swaps in the app. */
      } else {
        const res = onLocalLogin(identifier, password);
        if (res && res.error) setError(friendlyLoginError(res.error, false));
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

  return (
    <div className="pcp-root">
      <style>{CSS}</style>
      <div className="pcp-login-split">
        {/* Brand panel */}
        <aside className="pcp-login-brand">
          <div className="pcp-login-brand-top">
            <div className="pcp-login-logo-tile"><img src={LOGO_PORTAL} alt="Petty Cash Portal logo" /></div>
            <div>
              <div className="pcp-login-brand-name">Petty Cash Portal</div>
              <div className="pcp-login-brand-sub">Imprest Fund Management System</div>
            </div>
          </div>
          <div className="pcp-login-brand-mid">
            <h1 className="pcp-login-hero">Manage petty cash with confidence.</h1>
            <p className="pcp-login-lead">Request, release, liquidate and replenish — with every approval and receipt on record.</p>
            <PesoVisual />
          </div>
        </aside>

        {/* Sign-in form */}
        <main className="pcp-login-pane">
          <div className="pcp-login-card">
            <div className="pcp-login-card-head">
              <img className="pcp-login-card-logo" src={LOGO_PORTAL} alt="" aria-hidden="true" />
              <h2 className="pcp-login-title">Welcome back</h2>
              <div className="pcp-login-sub">Sign in to the Petty Cash Portal to continue.</div>
            </div>
            <form className="pcp-login-body" onSubmit={submit} noValidate aria-busy={busy}>
              {error && (
                <div className="pcp-login-err pcp-login-alert" role="alert">
                  <AlertTriangle size={16} />
                  <div><b>{error.title}</b><div>{error.text}</div></div>
                </div>
              )}
              <div className="pcp-field">
                <label htmlFor="pcp-login-id">{cloud ? "Email" : "Username"}</label>
                <div className={"pcp-login-input" + (fieldErr.id ? " invalid" : "")}>
                  <Mail size={17} />
                  <input
                    id="pcp-login-id"
                    type={cloud ? "email" : "text"}
                    className="pcp-input"
                    autoComplete="username"
                    autoFocus
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
                {capsOn && !fieldErr.pw && <div className="pcp-login-caps">Caps Lock is on.</div>}
              </div>
              <button type="submit" className="pcp-btn pcp-btn-primary pcp-login-submit" disabled={busy}>
                {busy ? <><span className="pcp-spinner" aria-hidden="true" /> Signing in…</> : "Sign In"}
              </button>
              <div className="pcp-login-help">
                <KeyRound size={13} />
                <span>Forgot your password? Contact your administrator to have it reset. Access is provided by your administrator.</span>
              </div>
            </form>
          </div>
          <BrandLogos />
          <div className="pcp-login-copy">© {new Date().getFullYear()} A1+ Multinational Packaging, Inc · Starkson Packaging, Inc.</div>
        </main>
      </div>
    </div>
  );
}

/* Root chooses the auth mode:
   - "cloud": a Supabase database is configured → email login (shared, secure).
   - "local": no database, but built-in accounts exist → username login.
   - "off":  neither → app opens directly as admin (offline/demo). */
