/* ============================= REQUESTS ============================= */

function RequestFormModal({ onClose, onSave, nextRequestNo, request, plantOptions, canEditRequestNo, isRequestNoTaken }) {
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
          requestNo: nextRequestNo || "",
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
  /* Request No. is system-generated and locked for every role except Accounting.
     When Accounting overrides it, it must stay present and unique — a duplicated
     series breaks the reference the audit trail and integrity report rely on. */
  const typedRequestNo = String(form.requestNo || "").trim();
  const requestNoDuplicate = !!canEditRequestNo && !!typedRequestNo && !!isRequestNoTaken
    && isRequestNoTaken(typedRequestNo, request ? request.id : null);
  const validRequestNo = !canEditRequestNo || (!!typedRequestNo && !requestNoDuplicate);
  const valid = validRequestNo && form.employee.trim() && !!form.branchCode && validPurpose && Number(form.amount) > 0 && form.approver.trim();

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{isEdit ? "Edit Petty Cash Request" : "New Petty Cash Request"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Request No.{canEditRequestNo && <span style={{ color: "var(--brand)" }}> *</span>}</label>
              {canEditRequestNo ? (
                <input
                  className="pcp-input"
                  value={form.requestNo}
                  onChange={(e) => set("requestNo", e.target.value)}
                  placeholder={REQUEST_NO_PREFIX + "0001"}
                  title="Accounting Department only — overrides the system-generated series"
                />
              ) : (
                <input className="pcp-input" value={isEdit ? request.requestNo : nextRequestNo} disabled />
              )}
              {canEditRequestNo && !typedRequestNo && (
                <div style={{ fontSize: 11.5, color: "var(--brand)" }}>Request No. is required.</div>
              )}
              {requestNoDuplicate && (
                <div style={{ fontSize: 11.5, color: "var(--brand)" }}>{typedRequestNo} is already used by another request.</div>
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
              <label>Plant / Branch <span style={{ color: "var(--brand)" }}>*</span></label>
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
              <label>Justification for "Others" <span style={{ color: "var(--brand)" }}>*</span></label>
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
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave({ ...form, requestNo: typedRequestNo })}>{isEdit ? "Save Changes" : "Submit Request"}</button>
        </div>
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

function RequestsTab({ requests, funds, onCreate, onEdit, onApprove, onReject, onDisburse, plantOptions, canApprove, canRelease, plantTitle, canDelete, onDelete, canEditRequestNo, isRequestNoTaken, nextRequestNo: nextRequestNoProp }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");
  /* Newest request no. first on open; any header can take over from there. */
  const sort = useTableSort("requestNo", "desc");

  /* Always supplied by App, which sees every plant's numbers. The local
     fallback only exists for the plant-scoped `requests` prop and is therefore
     a last resort — App is the single source of the series. */
  const nextRequestNo = nextRequestNoProp || nextSeriesNo(REQUEST_NO_PREFIX, requests.map((r) => r.requestNo));

  /* Sort on what the column actually shows, not the raw field, so Department
     and Plant order the way the reader sees them. */
  const filtered = sort.sortRows(
    requests.filter((r) => {
      if (plant !== "ALL" && r.branchCode !== plant) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (search && !(r.employee.toLowerCase().includes(search.toLowerCase()) || r.requestNo.toLowerCase().includes(search.toLowerCase()))) return false;
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
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search employee or request no." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <td>{r.requestNo}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.employee}</td>
                    <td title={subaccountLabel(r.department)}>{subaccountLabel(r.department)}</td>
                    <td>{plantLabel(r.branchCode)}</td>
                    <td style={{ maxWidth: 220, whiteSpace: "normal" }}>
                      {r.purpose === OTHERS_PURPOSE && r.purposeJustification
                        ? <span title={r.purposeJustification}>{OTHERS_PURPOSE}: {r.purposeJustification}</span>
                        : r.purpose}
                    </td>
                    <td className="pcp-num">{peso(r.amount)}</td>
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
                        {r.status !== "Disbursed" && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit request"><Edit3 size={12} /></button>
                        )}
                        {canDelete && onDelete && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onDelete(r.id)} title="Delete request (super admin)">
                            <Trash2 size={13} color="var(--brand)" />
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
      {showForm && (
        <RequestFormModal
          nextRequestNo={nextRequestNo}
          plantOptions={formPlantOptions}
          canEditRequestNo={canEditRequestNo}
          isRequestNoTaken={isRequestNoTaken}
          onClose={() => setShowForm(false)}
          onSave={(form) => { onCreate({ ...form, requestNo: (canEditRequestNo && form.requestNo) ? form.requestNo : nextRequestNo }); setShowForm(false); }}
        />
      )}
      {editing && (
        <RequestFormModal
          request={editing}
          plantOptions={formPlantOptions}
          canEditRequestNo={canEditRequestNo}
          isRequestNoTaken={isRequestNoTaken}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
    </div>
  );
}
