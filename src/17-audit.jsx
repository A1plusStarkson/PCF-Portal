/* ============================= AUDIT TRAIL ============================= */

const AUDIT_ACTIONS = ["Signed In", "Signed Out", "Request Created", "Edited", "Request No. Changed", "Approved", "Rejected", "Released", "Liquidated", "Liquidation Submitted", "Receipt Approved", "Receipt Rejected", "Liquidation Custodian Approved", "Liquidation Final Approved", "Liquidation Rejected", "Liquidation Approval Voided", "Replenished", "Deleted", "Password Changed", "Audit Entry Deleted"];

const AUDIT_SORT_FIELDS = {
  ts: (a) => a.ts,
  user: (a) => a.user,
  action: (a) => a.action,
  entity: (a) => a.entity,
  remarks: (a) => a.remarks,
};

function AuditTrailTab({ auditLog, canDelete, onDelete }) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("All");
  /* Ids ticked for deletion (super admin only). */
  const [selected, setSelected] = useState([]);
  /* Newest entry first, the way an audit trail is normally read. */
  const sort = useTableSort("ts", "desc");

  const rows = useMemo(() => [...auditLog].sort((a, b) => (b.ts || "").localeCompare(a.ts || "")), [auditLog]);
  const filtered = sort.sortRows(rows.filter((a) => {
    if (action !== "All" && a.action !== action) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((a.entity || "").toLowerCase().includes(q) || (a.user || "").toLowerCase().includes(q) || (a.remarks || "").toLowerCase().includes(q) || (a.action || "").toLowerCase().includes(q))) return false;
    }
    return true;
  }), AUDIT_SORT_FIELDS);

  const fmtTs = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const exportExcel = useCallback(() => {
    const out = filtered.map((a) => ({ "Date & Time": fmtTs(a.ts), "User": a.user, "Action": a.action, "Reference": a.entity, "Remarks": a.remarks }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out.length ? out : [{}]), "Audit Trail");
    downloadWorkbook(wb, `Audit_Trail_${todayISO()}.xlsx`);
  }, [filtered]);

  /* Selection is kept to whatever is currently visible, so a filter change can
     never leave hidden rows silently ticked for deletion. */
  const visibleIds = filtered.map((a) => a.id);
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected((s) => (selectedVisible.length === visibleIds.length ? s.filter((id) => !visibleIds.includes(id)) : visibleIds));

  const deleteSelected = () => {
    if (!onDelete || !selectedVisible.length) return;
    if (!window.confirm(
      `Permanently delete ${selectedVisible.length} audit entr${selectedVisible.length === 1 ? "y" : "ies"}?\n\n`
      + "The audit trail is the record of who did what. Removing entries cannot be undone and weakens "
      + "the traceability of every other action in the system.\n\n"
      + "A single summary entry will be written in their place."
    )) return;
    onDelete(selectedVisible);
    setSelected([]);
  };

  const deleteOne = (a) => {
    if (!onDelete) return;
    if (!window.confirm(`Permanently delete this audit entry?\n\n${fmtTs(a.ts)} · ${a.user} · ${a.action} · ${a.entity}\n\nThis cannot be undone.`)) return;
    onDelete([a.id]);
    setSelected((s) => s.filter((x) => x !== a.id));
  };

  return (
    <div>
      <TopBar
        title="Audit Trail"
        sub="Complete chronological history of every action taken in the system"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            {canDelete && selectedVisible.length > 0 && (
              <button className="pcp-btn pcp-btn-danger" onClick={deleteSelected}>
                <Trash2 size={14} /> Delete Selected ({selectedVisible.length})
              </button>
            )}
            <button className="pcp-btn pcp-btn-primary" onClick={exportExcel}><FileSpreadsheet size={14} /> Export to Excel</button>
          </div>
        }
      />
      <div className="pcp-content">
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search user, reference or remarks" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 180 }} value={action} onChange={(e) => setAction(e.target.value)}>
              {["All", ...AUDIT_ACTIONS].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {auditLog.length} entries</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr>
                {canDelete && (
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      checked={visibleIds.length > 0 && selectedVisible.length === visibleIds.length}
                      onChange={toggleAll}
                      title="Select all visible entries"
                    />
                  </th>
                )}
                <SortTh field="ts" sort={sort}>Date &amp; Time</SortTh>
                <SortTh field="user" sort={sort}>User</SortTh>
                <SortTh field="action" sort={sort}>Action</SortTh>
                <SortTh field="entity" sort={sort}>Reference</SortTh>
                <SortTh field="remarks" sort={sort}>Remarks</SortTh>
                {canDelete && <th style={{ width: 44 }}></th>}
              </tr></thead>
              <tbody>
                {filtered.length ? filtered.map((a) => (
                  <tr key={a.id}>
                    {canDelete && (
                      <td><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleOne(a.id)} /></td>
                    )}
                    <td style={{ whiteSpace: "nowrap" }}><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 5, color: "#9098b3" }} />{fmtTs(a.ts)}</td>
                    <td>{a.user}</td>
                    <td><span className={"pcp-badge pcp-badge-" + (a.action === "Rejected" || a.action === "Liquidation Rejected" || a.action === "Receipt Rejected" || a.action === "Deleted" || a.action === "Audit Entry Deleted" || a.action === "Fund Deleted" ? "red" : a.action === "Beginning Balance Changed" ? "amber" : a.action === "Approved" || a.action === "Released" || a.action === "Replenished" ? "green" : a.action === "Liquidated" ? "blue" : "gray")}>{a.action}</span></td>
                    <td>{a.entity}</td>
                    <td style={{ whiteSpace: "normal" }}>{a.remarks}</td>
                    {canDelete && (
                      <td>
                        <button className="pcp-iconbtn" title="Delete this audit entry" onClick={() => deleteOne(a)}>
                          <Trash2 size={14} color="#c8102e" />
                        </button>
                      </td>
                    )}
                  </tr>
                )) : <tr><td colSpan={canDelete ? 7 : 5} className="pcp-empty">No audit entries match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

