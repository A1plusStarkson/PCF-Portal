function Root() {
  const cloudEnabled = !!(window.PCP_AUTH && window.PCP_AUTH.enabled);
  const localUsers = window.PCP_LOCAL_USERS || [];
  const localEnabled = !cloudEnabled && localUsers.length > 0;

  const [checking, setChecking] = useState(cloudEnabled);
  const [user, setUser] = useState(null);
  const [localSession, setLocalSession] = useState(() => {
    try { const v = localStorage.getItem(LOCAL_SESSION_KEY); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  });

  useEffect(() => {
    if (!cloudEnabled) return;
    let active = true;
    window.PCP_AUTH.getUser().then((u) => { if (active) { setUser(u); setChecking(false); } });
    window.PCP_AUTH.onChange((session) => { if (active) { setUser(session ? session.user : null); setChecking(false); } });
    return () => { active = false; };
  }, [cloudEnabled]);

  const cloudSignOut = useCallback(() => { window.PCP_AUTH.signOut(); }, []);

  /* Two-step sign-in for the accounts in window.PCP_MFA_EMAILS. Keyed on the
     user id, not the user object: the hourly token refresh hands back a new
     object, and re-checking on that would unmount the open portal. mfaCheck
     bumps once a code is accepted. */
  const userId = user ? user.id : null;
  const needsMfa = !!user && (window.PCP_MFA_EMAILS || [])
    .map((s) => String(s).toLowerCase())
    .includes(String(user.email || "").toLowerCase());
  const [mfa, setMfa] = useState(null); // { step, factorId, uid }
  const [mfaCheck, setMfaCheck] = useState(0);
  useEffect(() => {
    if (!needsMfa) return;
    let active = true;
    window.PCP_AUTH.mfa.status()
      .then((s) => { if (active) setMfa({ ...s, uid: userId }); })
      .catch(() => { if (active) setMfa({ step: "error", uid: userId }); });
    return () => { active = false; };
  }, [userId, needsMfa, mfaCheck]);

  const doLocalLogin = useCallback((username, password) => {
    const s = localSignIn(username, password);
    if (!s) return { error: { message: "Invalid username or password." } };
    try { localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(s)); } catch (e) {}
    setLocalSession(s);
    return {};
  }, []);

  const localSignOut = useCallback(() => {
    try { localStorage.removeItem(LOCAL_SESSION_KEY); } catch (e) {}
    setLocalSession(null);
  }, []);

  /* ---- Cloud mode ---- */
  if (cloudEnabled) {
    if (checking) {
      return (
        <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
          <style>{CSS}</style>
          <div style={{ color: "var(--text-mut)", fontSize: 13 }}>Checking sign-in…</div>
        </div>
      );
    }
    if (!user) return <LoginScreen mode="cloud" />;
    if (needsMfa && (!mfa || mfa.uid !== userId || mfa.step !== "ok")) {
      if (mfa && mfa.uid === userId && (mfa.step === "enroll" || mfa.step === "challenge")) {
        return <MfaScreen key={mfa.step} step={mfa.step} factorId={mfa.factorId} email={user.email} onDone={() => setMfaCheck((n) => n + 1)} onSignOut={cloudSignOut} />;
      }
      return (
        <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
          <style>{CSS}</style>
          <div style={{ color: "var(--text-mut)", fontSize: 13 }}>
            {mfa && mfa.uid === userId && mfa.step === "error"
              ? <>Could not check two-step sign-in. <a href="#" onClick={(e) => { e.preventDefault(); setMfaCheck((n) => n + 1); }}>Try again</a></>
              : "Checking sign-in…"}
          </div>
        </div>
      );
    }
    const access = resolveUserAccess(user.email);
    return <App userEmail={user.email} userName={access.name} onSignOut={cloudSignOut} userRole={access.role} isAdmin={access.isAdmin} userPlants={access.plants} userExcludePlants={access.excludePlants} />;
  }

  /* ---- Local mode (built-in accounts) ---- */
  if (localEnabled) {
    if (!localSession) return <LoginScreen mode="local" onLocalLogin={doLocalLogin} />;
    return (
      <App
        userEmail={localSession.user}
        userName={localSession.name}
        onSignOut={localSignOut}
        userRole={localSession.role}
        isAdmin={localSession.role === "Accounting"}
        userPlants={localSession.plants}
        userExcludePlants={localSession.excludePlants}
      />
    );
  }

  /* ---- No auth configured ---- */
  return <App />;
}

/* ============================= MOUNT ============================= */

createRoot(document.getElementById("root")).render(<Root />);
