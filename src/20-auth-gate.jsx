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
  return { user: u.user, role: (u.role && ROLES[u.role]) ? u.role : "Custodian", name: u.name || u.user, plants: u.plants || "ALL" };
}

/* Sign-in screen. mode="cloud" uses Supabase email/password; mode="local"
   uses the built-in accounts (username/password). */
function LoginScreen({ mode, onLocalLogin }) {
  const cloud = mode === "cloud";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (cloud) {
        const res = await window.PCP_AUTH.signIn(identifier.trim(), password);
        if (res && res.error) setError(res.error.message || "Sign-in failed.");
        /* On success, onAuthStateChange in <Root/> swaps in the app. */
      } else {
        const res = onLocalLogin(identifier, password);
        if (res && res.error) setError(res.error.message);
      }
    } catch (err) {
      setError(cloud ? "Could not reach the server. Check your connection." : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  /* NO self-service password reset by design. The accounts are standalone
     identifiers, not real mailboxes, and no SMTP is configured — so the reset
     email could never be delivered. The button used to promise "a reset link is
     on its way", which was a promise the deployment cannot keep. Resets are done
     by the administrator in Supabase (Authentication -> Users). The
     PCP_AUTH.resetPassword helper in index.html is deliberately left in place,
     so restoring this is a small change once real mail delivery exists. */

  /* Display only: reveals the typed password on request. */
  const [showPw, setShowPw] = useState(false);
  const LOGIN_FEATURES = [
    "Petty cash requests and release",
    "Liquidation with receipt review",
    "Employee reimbursements",
    "Two-level approvals and replenishment",
  ];

  return (
    <div className="pcp-root">
      <style>{CSS}</style>
      <div className="pcp-login-split">
        {/* Brand panel */}
        <aside className="pcp-login-brand">
          <div className="pcp-login-brand-top">
            <div className="pcp-brand-mark"><Wallet size={20} /></div>
            <div>
              <div className="pcp-login-brand-name">Petty Cash Portal</div>
              <div className="pcp-login-brand-sub">Imprest Fund Management System</div>
            </div>
          </div>
          <div className="pcp-login-brand-mid">
            <h1 className="pcp-login-hero">Manage petty cash with confidence.</h1>
            <p className="pcp-login-lead">Request, release, liquidate and replenish — with every approval and receipt on record.</p>
            <ul className="pcp-login-features">
              {LOGIN_FEATURES.map((f) => (
                <li key={f}><CircleCheck size={15} /> {f}</li>
              ))}
            </ul>
          </div>
          <div className="pcp-login-logos">
            <img src={LOGO_A1} alt="A1+ Multinational Packaging, Inc" />
            <img src={LOGO_SPI} alt="Starkson Packaging, Inc." />
          </div>
        </aside>

        {/* Sign-in form */}
        <main className="pcp-login-pane">
          <div className="pcp-login-card">
            <div className="pcp-login-card-head">
              <h2 className="pcp-login-title">Welcome back</h2>
              <div className="pcp-login-sub">Sign in to the Petty Cash Portal to continue.</div>
            </div>
            <form className="pcp-login-body" onSubmit={submit}>
              {error && <div className="pcp-login-err" role="alert">{error}</div>}
              <div className="pcp-field">
                <label htmlFor="pcp-login-id">{cloud ? "Email" : "Username"}</label>
                <div className="pcp-login-input">
                  <Mail size={15} />
                  <input
                    id="pcp-login-id"
                    type={cloud ? "email" : "text"}
                    className="pcp-input"
                    autoComplete="username"
                    placeholder={cloud ? "you@company.com" : "e.g. a1plus"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="pcp-field">
                <label htmlFor="pcp-login-pw">Password</label>
                <div className="pcp-login-input">
                  <Lock size={15} />
                  <input
                    id="pcp-login-pw"
                    type={showPw ? "text" : "password"}
                    className="pcp-input"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="pcp-login-eye" onClick={() => setShowPw((v) => !v)}
                    title={showPw ? "Hide password" : "Show password"} aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="pcp-btn pcp-btn-primary pcp-login-submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign In"}
              </button>
              <div className="pcp-login-help">
                <KeyRound size={13} />
                <span>Forgot your password? Contact your administrator to have it reset. Access is provided by your administrator.</span>
              </div>
            </form>
          </div>
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
