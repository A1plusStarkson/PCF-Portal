/* ============================= REQUESTS ============================= */

function RequestFormModal({ onClose, onSave, request, plantOptions, allRequestNos }) {
  const isEdit = !!request;
  const defaultBranch = (plantOptions && plantOptions[0]) ? plantOptions[0].code : PCR_BRANCH_OPTIONS[0].code;
  const [form, setForm] = useState(
    request
      ? {
          requestNo: request.requestNo || "",
          date: request.date, employee: request.employee, department: request.department,
          branchCode: request.branchCode, purpose: request.purpose,
          purposeJustification: request.purposeJustification || "",
          amount: request.amount, approver: request.approver || "",
        }
      : {
          /* Left blank on purpose. The number is issued by the database when the
             request is saved (addRequest in 19-app.jsx), so two people saving at
             once can never get the same one. */
          requestNo: "",
          date: todayISO(), employee: "", department: SUBACCOUNTS[1].code,
          branchCode: defaultBranch, purpose: "", purposeJustification: "", amount: "", approver: "",
        }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  /* Option lists for the searchable pickers. Same values as the old <select>s —
     only the way they are browsed changed (a search box over the list). */
  const branchChoices = (plantOptions || PCR_BRANCH_OPTIONS)
    .map((b) => ({ value: b.code, label: `${b.label} (${b.code})` }));
  const purposeChoices = ALLOWABLE_PURPOSES.map((p) => ({ value: p, label: p }))
    .concat([{ value: OTHERS_PURPOSE, label: `${OTHERS_PURPOSE} (requires justification)` }]);
  const isOthers = form.purpose === OTHERS_PURPOSE;
  const validPurpose = !!form.purpose && (!isOthers || form.purposeJustification.trim());
  /* Request No. is issued by the database and locked for every user. A NEW
     request previews the next number (useNextSeriesNo); it is only issued on
     save, and addRequest says so if someone else took it in the meantime. */
  const valid = form.employee.trim() && !!form.branchCode && validPurpose && Number(form.amount) > 0 && form.approver.trim();
  const assignedLabel = `Auto-generated on submit (${requestNoPrefix(form.branchCode)}…)`;
  const previewNo = useNextSeriesNo(requestNoPrefix(form.branchCode), allRequestNos, !isEdit);

  return (
    <div className="pcp-modal-backdrop" {...backdropCloseProps(onClose)}>
      <div className="pcp-modal pcp-modal-resizable" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{isEdit ? "Edit Petty Cash Request" : "New Petty Cash Request"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Request No.</label>
              <input className="pcp-input" value={isEdit ? form.requestNo : (previewNo || assignedLabel)} disabled title="System-generated — cannot be changed" />
              {!isEdit && previewNo && (
                <div style={{ fontSize: 11.5, color: "var(--text-mut)" }}>System-generated · confirmed when you submit</div>
              )}
            </div>
            <div className="pcp-field">
              <label>Date</label>
              <input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Employee</label>
              <input className="pcp-input" placeholder="Full name" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Approver</label>
              <input className="pcp-input" placeholder="Approver name" value={form.approver} onChange={(e) => set("approver", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Plant / Branch <span style={{ color: "var(--danger)" }}>*</span></label>
              <SearchSelect
                value={form.branchCode}
                onChange={(v) => set("branchCode", v)}
                options={branchChoices}
                placeholder="— Select Plant / Branch —"
                emptyOptionLabel="— Select Plant / Branch —"
                searchPlaceholder="Search plant or branch code…"
                invalid={!form.branchCode}
              />
            </div>
            <div className="pcp-field">
              <label>Department</label>
              <SearchSelect
                value={form.department}
                onChange={(v) => set("department", v)}
                options={DEPARTMENT_CHOICES}
                placeholder="— Select Department —"
                searchPlaceholder="Search department or sub-account…"
              />
            </div>
          </div>
          <div className="pcp-field">
            <label>Purpose</label>
            <SearchSelect
              value={form.purpose}
              onChange={(v) => set("purpose", v)}
              options={purposeChoices}
              placeholder="— Select an allowable purpose —"
              emptyOptionLabel="— Select an allowable purpose —"
              searchPlaceholder="Search allowable purpose…"
              invalid={!form.purpose}
            />
          </div>
          {isOthers && (
            <div className="pcp-field">
              <label>Justification for "Others" <span style={{ color: "var(--danger)" }}>*</span></label>
              <textarea
                className="pcp-input"
                rows={2}
                placeholder="Provide a mandatory justification for this expense (reviewed by Finance)."
                value={form.purposeJustification}
                onChange={(e) => set("purposeJustification", e.target.value)}
              />
            </div>
          )}
          <div className="pcp-field">
            <label>Amount Requested (₱)</label>
            <input type="number" min="0" step="0.01" className="pcp-input" placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave({ ...form, previewNo })}>{isEdit ? "Save Changes" : "Submit Request"}</button>
        </div>
        <ModalResizeGrip />
      </div>
    </div>
  );
}

const REQUEST_SORT_FIELDS = {
  requestNo: (r) => r.requestNo,
  date: (r) => r.date,
  employee: (r) => r.employee,
  department: (r) => subaccountLabel(r.department),
  branchCode: (r) => plantLabel(r.branchCode),
  purpose: (r) => r.purpose,
  amount: (r) => Number(r.amount) || 0,
  approver: (r) => r.approver,
  status: (r) => r.status,
};

function RequestsTab({ requests, funds, onCreate, onEdit, onApprove, onReject, onDisburse, canEditDisbursed, plantOptions, canApprove, canRelease, plantTitle, canDelete, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");
  /* Newest request no. first on open; any header can take over from there. */
  const sort = useTableSort("requestNo", "desc");

  /* Sort on what the column actually shows, not the raw field, so Department
     and Plant order the way the reader sees them. */
  const filtered = sort.sortRows(
    requests.filter((r) => {
      if (plant !== "ALL" && r.branchCode !== plant) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      /* The legacy number is searchable too. Requests issued before the series
         became per-plant went out on paper under their old portal-wide number,
         so someone holding a signed PCR-2026-0022 must be able to find it by
         the number printed in their hand — the record now reads
         PCR-M-2026-0001 and would otherwise be unfindable outside SQL. */
      if (search) {
        const q = search.toLowerCase();
        const hit = r.employee.toLowerCase().includes(q)
          || r.requestNo.toLowerCase().includes(q)
          || String(r.legacyRequestNo || "").toLowerCase().includes(q)
          || (r.numberHistory || []).some((h) => String(h.from || "").toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    }),
    REQUEST_SORT_FIELDS
  );

  const formPlantOptions = (plantOptions && plantOptions.length)
    ? (plant !== "ALL" ? plantOptions.filter((p) => p.code === plant) : plantOptions)
    : null;

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Petty Cash Requests"}
        sub="Submit and approve cash advance requests before release"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Request</button>}
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search employee, request no. or old no." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", "Pending", "Approved", "Rejected", "Disbursed"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {requests.length} requests</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <SortTh field="requestNo" sort={sort}>Request No.</SortTh>
                  <SortTh field="date" sort={sort}>Date</SortTh>
                  <SortTh field="employee" sort={sort}>Employee</SortTh>
                  <SortTh field="department" sort={sort}>Department</SortTh>
                  <SortTh field="branchCode" sort={sort}>Plant</SortTh>
                  <SortTh field="purpose" sort={sort}>Purpose</SortTh>
                  <SortTh field="amount" sort={sort}>Amount</SortTh>
                  <SortTh field="approver" sort={sort}>Approver</SortTh>
                  <SortTh field="status" sort={sort}>Status</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    {/* The old portal-wide number sits under the current one so a
                        signed paper voucher can be matched to the record on sight,
                        without anyone having to remember the renumbering. Only
                        shown on records that actually carry one. */}
                    <td>
                      <strong>{r.requestNo}</strong>
                      <PrevNo rec={r} legacy={r.legacyRequestNo} />
                    </td>
                    <td>{fmtDate(r.date)}</td>
                    <td><strong>{r.employee}</strong></td>
                    <td title={subaccountLabel(r.department)}>{subaccountLabel(r.department)}</td>
                    <td>{plantLabel(r.branchCode)}</td>
                    <td style={{ maxWidth: 220, whiteSpace: "normal" }}>
                      {r.purpose === OTHERS_PURPOSE && r.purposeJustification
                        ? <span title={r.purposeJustification}>{OTHERS_PURPOSE}: {r.purposeJustification}</span>
                        : r.purpose}
                    </td>
                    <td className="pcp-num"><strong>{peso(r.amount)}</strong></td>
                    <td>{r.approver || "—"}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canApprove && r.status === "Pending" && (
                          <>
                            <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onApprove(r.id)} title="Approve request"><Check size={12} /> Approve</button>
                            <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onReject(r.id)} title="Reject request"><X size={12} /></button>
                          </>
                        )}
                        {/* Disbursed requests are locked, except for the Accounting override. */}
                        {(r.status !== "Disbursed" || canEditDisbursed) && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)}
                            title={r.status === "Disbursed" ? "Edit released request (Accounting) — the Release Ledger voucher is not changed" : "Edit request"}>
                            <Edit3 size={12} />
                          </button>
                        )}
                        {canDelete && onDelete && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onDelete(r.id)} title="Delete request (super admin)">
                            <Trash2 size={13} color="var(--danger)" />
                          </button>
                        )}
                        {canRelease && r.status === "Approved" && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onDisburse(r)}>Release</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={10} className="pcp-empty">No requests match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* The Request No. is issued by the app on save (addRequest), never taken
          from the form. */}
      {showForm && (
        <RequestFormModal
          allRequestNos={requests.map((r) => r.requestNo)}
          plantOptions={formPlantOptions}
          onClose={() => setShowForm(false)}
          onSave={(form) => { onCreate(form); setShowForm(false); }}
        />
      )}
      {editing && (
        <RequestFormModal
          allRequestNos={requests.map((r) => r.requestNo)}
          request={editing}
          plantOptions={formPlantOptions}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
    </div>
  );
}
