/* ============================= MASTER DATA ============================= */

function FundFormModal({ onClose, onSave, fund }) {
  const [form, setForm] = useState(fund || { branchCode: BRANCHES[0].code, label: "", custodian: "", beginningBalance: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.label.trim() && form.custodian.trim() && Number(form.beginningBalance) >= 0;

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{fund ? "Edit Petty Cash Fund" : "New Petty Cash Fund"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field">
            <label>Plant / Fund Name</label>
            <input className="pcp-input" placeholder="e.g. Manila" value={form.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="pcp-field">
            <label>Branch (ERP Code)</label>
            <select className="pcp-select" value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}>
              {COMPANIES.map((c) => (
                <optgroup label={c} key={c}>
                  {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Custodian</label>
              <input className="pcp-input" placeholder="Full name" value={form.custodian} onChange={(e) => set("custodian", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Beginning Balance (₱)</label>
              <input type="number" min="0" step="0.01" className="pcp-input" value={form.beginningBalance} onChange={(e) => set("beginningBalance", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" disabled={!valid} onClick={() => onSave({ ...form, beginningBalance: Number(form.beginningBalance) })}>Save Fund</button>
        </div>
      </div>
    </div>
  );
}

function ReferenceTable({ title, columns, rows }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <div className="pcp-card" style={{ marginBottom: 14 }}>
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({rows.length})</span></div>
        <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <div style={{ padding: "10px 18px" }}>
            <input className="pcp-input" placeholder={`Search ${title.toLowerCase()}...`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          </div>
          <div className="pcp-table-wrap" style={{ maxHeight: 340, overflowY: "auto" }}>
            <table className="pcp-table">
              <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const FUND_SORT_FIELDS = {
  label: (f) => f.label,
  branchCode: (f) => f.branchCode,
  company: (f) => companyOfBranch(f.branchCode),
  custodian: (f) => f.custodian,
  beginningBalance: (f) => Number(f.beginningBalance) || 0,
  available: (f) => Number(f.available) || 0,
};

function MasterDataTab({ funds, disbursements, liquidations, replenishments, onAddFund, onEditFund, onDeleteFund }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  /* No sort key on open, so the funds keep their configured order until the
     reader picks a column. */
  const sort = useTableSort(null);

  /* Available balance is derived, so it is resolved once per fund here rather
     than inside the row — that way the column can be sorted on it too. */
  const fundRows = sort.sortRows(
    funds.map((f) => ({ ...f, available: monitoringForFund(f, disbursements, liquidations, replenishments).available })),
    FUND_SORT_FIELDS
  );

  return (
    <div>
      <TopBar
        title="Funds & Master Data"
        sub="Manage petty cash funds and view reference data used across the system"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Fund</button>}
      />
      <div className="pcp-content">
        <div className="pcp-card" style={{ marginBottom: 18 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>
            Petty Cash Funds (Plants)
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr>
                <SortTh field="label" sort={sort}>Plant</SortTh>
                <SortTh field="branchCode" sort={sort}>Branch</SortTh>
                <SortTh field="company" sort={sort}>Company</SortTh>
                <SortTh field="custodian" sort={sort}>Custodian</SortTh>
                <SortTh field="beginningBalance" sort={sort}>Beginning Balance</SortTh>
                <SortTh field="available" sort={sort}>Available Balance</SortTh>
                <th></th>
              </tr></thead>
              <tbody>
                {fundRows.map((f) => {
                  return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.label}</td>
                    <td>{f.branchCode}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{companyOfBranch(f.branchCode)}</td>
                    <td>{f.custodian}</td>
                    <td className="pcp-num">{peso(f.beginningBalance)}</td>
                    <td className="pcp-num" style={{ fontWeight: 700, color: f.available < 0 ? "var(--brand)" : "var(--green)" }}>{peso(f.available)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Edit the stored fund, not the row copy — the row carries a
                            derived `available` that must never be saved back. */}
                        <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(funds.find((x) => x.id === f.id))} title="Edit fund"><Edit3 size={12} /></button>
                        <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onDeleteFund(f.id)} title="Delete fund"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pcp-eyebrow" style={{ marginBottom: 8 }}>Reference Data (from Acumatica master files)</div>
        <ReferenceTable
          title="Branches"
          columns={[{ key: "code", label: "Branch ID" }, { key: "name", label: "Branch Name" }, { key: "company", label: "Company" }]}
          rows={BRANCHES}
        />
        <ReferenceTable
          title="Departments (Subaccounts)"
          columns={[{ key: "code", label: "Code" }, { key: "desc", label: "Description" }]}
          rows={SUBACCOUNTS.filter((s) => s.desc)}
        />
        <ReferenceTable
          title="Expense Categories"
          columns={[{ key: "account", label: "Account" }, { key: "name", label: "Expense Category" }]}
          rows={EXPENSE_CATEGORIES.map((c) => ({ name: c, account: accountForCategory(c) }))}
        />
        <ReferenceTable
          title="Tax Categories"
          columns={[{ key: "code", label: "Tax Category ID" }, { key: "desc", label: "Description" }]}
          rows={TAX_CATEGORIES}
        />
      </div>
      {showForm && (
        <FundFormModal onClose={() => setShowForm(false)} onSave={(f) => { onAddFund(f); setShowForm(false); }} />
      )}
      {editing && (
        <FundFormModal fund={editing} onClose={() => setEditing(null)} onSave={(f) => { onEditFund(editing.id, f); setEditing(null); }} />
      )}
    </div>
  );
}
