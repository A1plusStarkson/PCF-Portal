/* ============================= ACCOUNT & ADMIN ============================= */

/* Change the signed-in user's own password. Uses the Supabase auth client
   (window.PCP_AUTH.updatePassword) so the new password is hashed server-side. */
function ChangePasswordModal({ onClose, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setOk("");
    if (pw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      const auth = window.PCP_AUTH;
      if (!auth || !auth.updatePassword) { setError("Password changes are handled by your administrator in this deployment."); setBusy(false); return; }
      const res = await auth.updatePassword(pw);
      if (res && res.error) { setError(res.error.message || "Could not update password."); }
      else { setOk("Password updated successfully."); if (onDone) onDone("Password updated"); setTimeout(onClose, 1200); }
    } catch (err) {
      setError("Could not update password. Check your connection.");
    } finally { setBusy(false); }
  };

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Change Password</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <form className="pcp-modal-body" onSubmit={submit}>
          {error && <div className="pcp-login-err">{error}</div>}
          {ok && <div className="pcp-login-ok">{ok}</div>}
          <div className="pcp-field">
            <label>New Password</label>
            <input type="password" className="pcp-input" autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </div>
          <div className="pcp-field">
            <label>Confirm New Password</label>
            <input type="password" className="pcp-input" autoComplete="new-password" placeholder="Re-type new password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </div>
          <div className="pcp-modal-foot" style={{ padding: "8px 0 0" }}>
            <button type="button" className="pcp-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="pcp-btn pcp-btn-primary" disabled={busy}>{busy ? "Saving…" : "Update Password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Read-only roster of the configured users and their access — Accounting only.
   Accounts themselves are created/reset in the Supabase dashboard, so this view
   documents who has access to what. */
function UserManagementTab({ currentEmail, onChangePassword }) {
  const users = window.PCP_USERS || {};
  const plantsLabel = (p) => (p === "ALL" || !p) ? "All plants" : resolvePlants(p).map(plantLabel).join(", ");
  /* No sort key on open, so the roster keeps its configured order. */
  const sort = useTableSort(null);
  const rows = sort.sortRows(
    Object.keys(users).map((email) => ({ email, ...users[email] })),
    {
      name: (u) => u.name,
      email: (u) => u.email,
      role: (u) => (ROLES[u.role] ? ROLES[u.role].label : (u.role || "Custodian")),
      plants: (u) => plantsLabel(u.plants),
      admin: (u) => (u.role === "Accounting" ? 0 : 1),
    }
  );
  return (
    <div>
      <TopBar
        title="User Management"
        sub="Authorized users, their roles and plant access (Role-Based Access Control)"
        right={<button className="pcp-btn" onClick={onChangePassword}><KeyRound size={14} /> Change My Password</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card">
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr>
                <SortTh field="name" sort={sort}>Name</SortTh>
                <SortTh field="email" sort={sort}>Login (email)</SortTh>
                <SortTh field="role" sort={sort}>Role</SortTh>
                <SortTh field="plants" sort={sort}>Plant Access</SortTh>
                <SortTh field="admin" sort={sort}>Admin</SortTh>
              </tr></thead>
              <tbody>
                {rows.length ? rows.map((u) => (
                  <tr key={u.email}>
                    <td style={{ fontWeight: 600 }}>{u.name}{String(u.email).toLowerCase() === String(currentEmail || "").toLowerCase() ? " (you)" : ""}</td>
                    <td>{u.email}</td>
                    <td>{ROLES[u.role] ? ROLES[u.role].label : (u.role || "Custodian")}</td>
                    <td>{plantsLabel(u.plants)}</td>
                    <td>{(u.role === "Accounting") ? <Badge status="Approved" /> : <span style={{ color: "var(--text-mut)" }}>—</span>}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="pcp-empty">No users configured. Add them in index.html (window.PCP_USERS) and in your Supabase project.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pcp-card pcp-card-pad" style={{ marginTop: 16, fontSize: 12.5, color: "var(--text-mut)", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Managing accounts</div>
          Passwords are hashed and stored securely by the authentication provider (Supabase). To add, remove or reset a user's
          password, use the Supabase dashboard (Authentication → Users). Each user can also change their own password from the
          sidebar. Role and plant access for each account are configured in <code>index.html</code> under <code>window.PCP_USERS</code>.
        </div>
      </div>
    </div>
  );
}

function SystemSettingsTab({ userName, userEmail, role, plants, requests, disbursements, liquidations, replenishments, isAdmin }) {
  const cloud = !!(window.PCP_AUTH && window.PCP_AUTH.enabled);
  const plantsLabel = (plants && plants.length) ? plants.map(plantLabel).join(", ") : "All plants";
  return (
    <div>
      <TopBar title="System Settings" sub="Environment, data storage and access configuration" />
      <div className="pcp-content">
        <div className="pcp-grid-2">
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><Settings size={15} color="#c8102e" /> Your Account</div>
            <table className="pcp-table"><tbody>
              <tr><td style={{ fontWeight: 600 }}>Name</td><td>{userName || "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Login</td><td>{userEmail || "Local mode"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Role</td><td>{ROLES[role] ? ROLES[role].label : role}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Plant Access</td><td>{plantsLabel}</td></tr>
            </tbody></table>
          </div>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><ShieldCheck size={15} color="#c8102e" /> Security & Storage</div>
            <table className="pcp-table"><tbody>
              <tr><td style={{ fontWeight: 600 }}>Authentication</td><td>{cloud ? "Supabase (secure, hashed passwords)" : "Local mode"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Access control</td><td>Role-Based Access Control (RBAC) with plant scoping</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Shared database</td><td>{cloud ? "Enabled" : "Local browser only"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Data version</td><td>{DATA_VERSION}</td></tr>
            </tbody></table>
          </div>
        </div>
        {isAdmin && (
          <DataIntegrityPanel
            requests={requests} disbursements={disbursements}
            liquidations={liquidations} replenishments={replenishments}
          />
        )}
      </div>
    </div>
  );
}

/* ---- Data Integrity, Reconciliation & Recovery (admin only) ----
   Surfaces the cross-module reconciliation report, flags orphans/duplicates and
   lets an administrator take a manual backup or restore an earlier snapshot.
   This is the operator-facing side of the automatic backup system that protects
   completed financial records from ever disappearing. */
function DataIntegrityPanel({ requests, disbursements, liquidations, replenishments }) {
  const report = useMemo(
    () => buildIntegrityReport(requests, disbursements, liquidations, replenishments),
    [requests, disbursements, liquidations, replenishments]
  );

  const exportReconciliation = () => {
    const rows = report.rows.map((r) => ({
      Transaction: r.ref,
      Request: r.request ? "✓" : "✗",
      Release: r.release ? "✓" : "✗",
      Liquidation: r.liquidation ? "✓" : "✗",
      Replenishment: r.replenishment ? "✓" : "—",
      Status: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Transaction: "(no requests)" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
    downloadWorkbook(wb, `PCF_Reconciliation_${todayISO()}.xlsx`);
  };

  const c = report.counts;
  const flag = (arr) => (arr && arr.length ? arr.join(", ") : "None");

  return (
    <div className="pcp-card pcp-card-pad" style={{ marginTop: 16 }}>
      <div className="pcp-section-title"><Database size={15} color="#c8102e" /> Data Integrity & Reconciliation</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 14px" }}>
        <button className="pcp-btn" onClick={exportReconciliation}><Download size={14} /> Export reconciliation</button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: 13 }}>
        <span><strong>{c.requests}</strong> requests</span>
        <span><strong>{c.disbursements}</strong> releases</span>
        <span><strong>{c.liquidations}</strong> liquidations</span>
        <span><strong>{c.replenishments}</strong> replenishments</span>
        <span style={{ color: "#127a3e" }}><strong>{c.complete}</strong> complete</span>
        <span style={{ color: "#b45309" }}><strong>{c.missingRelease}</strong> missing release</span>
        <span style={{ color: "#b45309" }}><strong>{c.missingLiquidation}</strong> missing liquidation</span>
      </div>

      <div style={{
        padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 12.5,
        background: report.healthy ? "#effaf1" : "#fef3f2",
        border: "1px solid " + (report.healthy ? "#b7e4c7" : "#f5c2c0"),
        color: report.healthy ? "#127a3e" : "#b42318",
      }}>
        {report.healthy ? "No integrity problems detected — all relationships intact, no orphans or duplicates." : "Integrity issues detected — review the flags below."}
        {!report.healthy && (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Orphaned releases (no parent request): {flag(report.orphanDisbursements)}</li>
            <li>Orphaned liquidations (no parent release): {flag(report.orphanLiquidations)}</li>
            <li>Duplicate request numbers: {flag(report.duplicateRequestNos)}</li>
            <li>Duplicate voucher numbers: {flag(report.duplicateVoucherNos)}</li>
            <li>Duplicate replenishment numbers: {flag(report.duplicateReplenishmentNos)}</li>
            <li>Releases with more than one liquidation: {flag(report.duplicateLiquidations)}</li>
          </ul>
        )}
      </div>

      <div className="pcp-table-wrap" style={{ maxHeight: 280, overflow: "auto", marginBottom: 16 }}>
        <table className="pcp-table">
          <thead><tr><th>Transaction</th><th>Request</th><th>Release</th><th>Liquidation</th><th>Replenishment</th><th>Status</th></tr></thead>
          <tbody>
            {report.rows.length ? report.rows.map((r) => (
              <tr key={r.ref}>
                <td style={{ fontWeight: 600 }}>{r.ref}</td>
                <td>{r.request ? "✓" : "✗"}</td>
                <td>{r.release ? "✓" : "✗"}</td>
                <td>{r.liquidation ? "✓" : "✗"}</td>
                <td>{r.replenishment ? "✓" : "—"}</td>
                <td>{r.status}</td>
              </tr>
            )) : <tr><td colSpan={6} className="pcp-empty">No requests recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pcp-section-title" style={{ fontSize: 13 }}><ArchiveRestore size={14} color="#c8102e" /> Backup &amp; recovery</div>
      <div className="pcp-hint" style={{ lineHeight: 1.7 }}>
        Every record lives in one place — the Supabase database — and backups are taken by Supabase itself:
        a <strong>daily backup retained for 7 days</strong> on the current plan. To restore, use
        <strong> Supabase dashboard → Database → Backups</strong>. Ask for point-in-time recovery to be added
        if a finer recovery point is ever needed.
        <br /><br />
        The portal no longer keeps its own rolling snapshots in the browser. It used to, and a browser holding an
        old snapshot could silently re-seed the shared database — which is how deleted records came back. Removing
        that means what you see here is what the database holds, for every account.
      </div>
    </div>
  );
}

