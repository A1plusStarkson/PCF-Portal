/* ============================= DISBURSEMENTS ============================= */

/* outstanding: the employee's advances not yet fully liquidated. Shown for
   reference only — they do not block the release. */
function DisburseModal({ request, onClose, onConfirm, nextVoucherNo, outstanding }) {
  const [amount, setAmount] = useState(request.amount);
  /* Free-text expense description. Cash is released before the receipts exist,
     so pinning a chart-of-accounts category here was always a guess — the real
     GL classification is captured per receipt line during liquidation. */
  const [expense, setExpense] = useState("");
  const [date, setDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Disburse Cash Advance</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ background: "var(--paper)", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12.5 }}>
            <div><strong>{request.requestNo}</strong> — {request.employee}</div>
            <div style={{ color: "var(--text-mut)", marginTop: 3 }}>{request.purpose}</div>
          </div>
          {!!(outstanding && outstanding.length) && (
            <div className="pcp-hint" style={{ marginBottom: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                For reference: {request.employee} has {outstanding.length} advance(s) not yet fully liquidated
              </div>
              {outstanding.map((o) => (
                <div key={o.disb.id} style={{ color: "var(--text-mut)" }}>
                  {o.disb.voucherNo} · {fmtDate(o.disb.date)} · {peso(o.disb.amount)} · {o.status}
                </div>
              ))}
              <div style={{ color: "var(--text-mut)", marginTop: 4 }}>This does not prevent the release.</div>
            </div>
          )}
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Voucher No.</label>
              <input className="pcp-input" value={nextVoucherNo} disabled />
            </div>
            <div className="pcp-field">
              <label>Disbursement Date</label>
              <input type="date" className="pcp-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Amount Disbursed (₱)</label>
              <input type="number" className="pcp-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Expense</label>
              <input
                className="pcp-input" value={expense}
                onChange={(e) => setExpense(e.target.value)}
                placeholder="Type the expense, e.g. Fuel and toll for Cavite delivery"
              />
            </div>
          </div>
          <div className="pcp-field">
            <label>Remarks</label>
            <input className="pcp-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button
            className="pcp-btn pcp-btn-primary"
            onClick={() => onConfirm({ amount: Number(amount), expense: expense.trim(), date, remarks })}
          >
            Confirm Disbursement
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDisbursementModal({ disbursement, onClose, onSave }) {
  const [form, setForm] = useState({
    date: disbursement.date, employee: disbursement.employee, branchCode: disbursement.branchCode,
    department: disbursement.department, expense: disbExpense(disbursement),
    amount: disbursement.amount, remarks: disbursement.remarks || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.employee.trim() && Number(form.amount) > 0;

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Edit Disbursement — {disbursement.voucherNo}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Disbursement Date</label>
              <input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Employee</label>
              <input className="pcp-input" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Company / Branch</label>
              <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
                {COMPANIES.map((c) => (
                  <optgroup label={c} key={c}>
                    {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="pcp-field">
              <label>Department</label>
              <select className="pcp-select" value={form.department} onChange={(e) => set("department", e.target.value)}>
                {SUBACCOUNTS.filter((s) => s.desc).map((s) => <option key={s.code} value={s.code}>{s.desc} ({s.code})</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Amount Disbursed (₱)</label>
              <input type="number" min="0" step="0.01" className="pcp-input" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Expense</label>
              <input className="pcp-input" value={form.expense} onChange={(e) => set("expense", e.target.value)} placeholder="Expense description" />
            </div>
          </div>
          <div className="pcp-field">
            <label>Remarks</label>
            <input className="pcp-input" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave(disbursement.id, { ...form, amount: Number(form.amount) })}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

const SORT_FIELDS = {
  voucherNo: (d) => d.voucherNo,
  requestNo: (d) => d.pcrNo,
  date: (d) => d.date,
  employee: (d) => d.employee,
  branchCode: (d) => d.branchCode,
  amount: (d) => Number(d.amount) || 0,
  company: (d) => companyOfBranch(d.branchCode),
  department: (d) => subaccountLabel(d.department),
  expense: (d) => disbExpense(d),
  liqStatus: (d) => d.liqStatus,
  billed: (d) => (d.billed ? 0 : 1),
  remarks: (d) => d.remarks,
};
/* Column header filters: the text each cell shows. */
const LEDGER_COL_TEXT = {
  voucherNo: (d) => cfText(d.voucherNo),
  requestNo: (d) => cfText(d.pcrNo),
  date: (d) => (d.date ? fmtDate(d.date) : "—"),
  employee: (d) => cfText(d.employee),
  branchCode: (d) => cfText(d.branchCode),
  company: (d) => cfText(companyOfBranch(d.branchCode)),
  department: (d) => cfText(subaccountLabel(d.department)),
  expense: (d) => cfText(disbExpense(d)),
  amount: (d) => peso(d.amount),
  liqStatus: (d) => cfText(d.liqStatus),
  billed: (d) => (d.billed ? "Billed" : "Not billed"),
  remarks: (d) => cfText(d.remarks),
};

function DisbursementsTab({ disbursements, liquidations, requests, onOpenRequest, onUpdateRemarks, onToggleBilled, onEditDisbursement, plantOptions, plantTitle, canEdit = true, canDelete, onDelete }) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const sort = useTableSort("date", "desc");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editDisb, setEditDisb] = useState(null);

  /* Request each voucher was released from (PCF Request No. column). */
  const reqById = useMemo(() => new Map((requests || []).map((r) => [r.id, r])), [requests]);
  const matching = useMemo(() => {
    let list = disbursements.map((d) => ({ ...d, liqStatus: liqStatusFor(d, liquidations), pcrNo: pcrNoOf(d, reqById) }));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((d) => d.voucherNo.toLowerCase().includes(s) || d.employee.toLowerCase().includes(s) || String(d.pcrNo || "").toLowerCase().includes(s));
    }
    if (branchFilter !== "All") list = list.filter((d) => d.branchCode === branchFilter);
    if (statusFilter !== "All") list = list.filter((d) => d.liqStatus === statusFilter);
    return list;
  }, [disbursements, liquidations, reqById, search, branchFilter, statusFilter]);

  const cf = useTableColumnFilters(matching, LEDGER_COL_TEXT);
  const rows = sort.sortRows(cf.rows, SORT_FIELDS);

  const exportLedger = () => {
    const data = rows.map((d) => ({
      "Voucher No.": d.voucherNo, "PCF Request No.": d.pcrNo || "", "Date": d.date, "Employee": d.employee,
      "Branch": d.branchCode, "Company": companyOfBranch(d.branchCode),
      "Department": subaccountLabel(d.department), "Expense": disbExpense(d),
      "Amount": d.amount, "Status": d.status, "Liquidation Status": d.liqStatus, "Remarks": d.remarks || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disbursement Ledger");
    downloadWorkbook(wb, `Disbursement_Ledger_${todayISO()}.xlsx`);
  };

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Release Ledger"}
        sub="Full transaction history of all petty cash releases (vouchers)"
        right={
          <>
            <button className="pcp-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button className="pcp-btn pcp-btn-primary" onClick={exportLedger}><Download size={14} /> Export to Excel</button>
          </>
        }
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={branchFilter === "All" ? "ALL" : branchFilter} onChange={(v) => setBranchFilter(v === "ALL" ? "All" : v)} />
        <div className="pcp-card">
          <div className="pcp-filterbar" style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search voucher or employee" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ColFiltersClear cf={cf} />
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{rows.length} of {disbursements.length} vouchers</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <SortTh field="voucherNo" sort={sort} cf={cf}>Voucher No.</SortTh>
                  <SortTh field="requestNo" sort={sort} cf={cf}>PCF Request No.</SortTh>
                  <SortTh field="date" sort={sort} cf={cf}>Date</SortTh>
                  <SortTh field="employee" sort={sort} cf={cf}>Employee</SortTh>
                  <SortTh field="branchCode" sort={sort} cf={cf}>Branch</SortTh>
                  <SortTh field="company" sort={sort} cf={cf}>Company</SortTh>
                  <SortTh field="department" sort={sort} cf={cf}>Department</SortTh>
                  <SortTh field="expense" sort={sort} cf={cf}>Expense</SortTh>
                  <SortTh field="amount" sort={sort} cf={cf}>Amount</SortTh>
                  <SortTh field="liqStatus" sort={sort} cf={cf}>Liquidation Status</SortTh>
                  <SortTh field="billed" sort={sort} cf={cf}>Billed</SortTh>
                  <SortTh field="remarks" sort={sort} cf={cf}>Remarks</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.voucherNo}</strong><PrevNo rec={d} /></td>
                    <td><RequestNoLink disb={d} reqById={reqById} onOpen={onOpenRequest} /></td>
                    <td>{fmtDate(d.date)}</td>
                    <td><strong>{d.employee}</strong></td>
                    <td>{d.branchCode}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{companyOfBranch(d.branchCode)}</td>
                    <td title={subaccountLabel(d.department)} style={{ maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subaccountLabel(d.department)}</td>
                    <td style={{ maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={disbExpense(d)}>{disbExpense(d) || "—"}</td>
                    <td className="pcp-num"><strong>{peso(d.amount)}</strong></td>
                    <td><Badge status={d.liqStatus} /></td>
                    <td>
                      {canEdit ? (
                        <button className="pcp-btn pcp-btn-sm" onClick={() => onToggleBilled(d.id)} title="Toggle billed">
                          {d.billed ? <Check size={12} color="#15803d" /> : <span style={{ color: "#8fa397" }}>—</span>}
                        </button>
                      ) : (
                        d.billed ? <Check size={12} color="#15803d" /> : <span style={{ color: "#8fa397" }}>—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 150 }}>
                      {!canEdit ? (
                        <span style={{ color: d.remarks ? "inherit" : "var(--text-mut)" }}>{d.remarks || "—"}</span>
                      ) : editingId === d.id ? (
                        <input
                          className="pcp-input" autoFocus value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => { onUpdateRemarks(d.id, editValue); setEditingId(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => { setEditingId(d.id); setEditValue(d.remarks || ""); }}>
                          <span style={{ color: d.remarks ? "inherit" : "var(--text-mut)" }}>{d.remarks || "Add remarks…"}</span>
                          <Edit3 size={11} color="#8fa397" />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setEditDisb(d)} title="Edit disbursement"><Edit3 size={12} /></button>
                        )}
                        {canDelete && onDelete && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onDelete(d.id)} title="Delete voucher and its liquidation (super admin)">
                            <Trash2 size={13} color="var(--danger)" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={13} className="pcp-empty">No disbursements match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editDisb && (
        <EditDisbursementModal
          disbursement={editDisb}
          onClose={() => setEditDisb(null)}
          onSave={(id, patch) => { onEditDisbursement(id, patch); setEditDisb(null); }}
        />
      )}
    </div>
  );
}
