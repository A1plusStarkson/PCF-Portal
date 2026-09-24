/* ============================= REPLENISHMENT ============================= */

const REPLENISH_STATUSES = ["Pending", "Approved", "Completed"];

/* Amount already liquidated for a branch that has not yet been reimbursed by a
   completed replenishment — the natural amount to replenish next. */
function suggestedReplenishment(branchCode, disbursements, liquidations, replenishments) {
  const liquidated = disbursements
    .filter((d) => d.branchCode === branchCode)
    .reduce((s, d) => s + liquidatedTotal(liquidationFor(d.id, liquidations)), 0);
  const replenished = replenishments
    .filter((r) => r.branchCode === branchCode && r.status === "Completed")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return Math.max(0, liquidated - replenished);
}

/* Everything with Grace Gan's final approval that no replenishment has claimed
   yet — petty cash liquidations and employee reimbursements — in one shape so
   the ready panel and the form can list them together. A liquidation is
   claimed through replenishment.liquidationIds, a reimbursement through
   replenishment.reimbursementIds. */
function replenishmentReadyItems(disbursements, liquidations, reimbursements, replenishments, exceptReplenishmentId) {
  const liqs = liquidationsReadyForReplenishment(disbursements, liquidations, replenishments, exceptReplenishmentId).map((x) => {
    const rv = liqReview(x.liq);
    return {
      kind: "liq", id: x.liq.id, ref: x.disb.voucherNo, employee: x.disb.employee, branchCode: x.disb.branchCode,
      checkedBy: rv.checkedBy, checkedAt: rv.checkedAt, finalBy: rv.finalBy, finalAt: rv.finalAt, amount: x.amount,
    };
  });
  const reimbs = reimbursementsReadyForReplenishment(reimbursements, replenishments, exceptReplenishmentId).map((x) => {
    const rv = reimbReview(x.reimb);
    return {
      kind: "reimb", id: x.reimb.id, ref: x.reimb.reimbNo, employee: x.reimb.employee, branchCode: x.reimb.branchCode,
      checkedBy: rv.checkedBy, checkedAt: rv.checkedAt, finalBy: rv.finalBy, finalAt: rv.finalAt, amount: x.amount,
    };
  });
  return liqs.concat(reimbs);
}
const readyKey = (x) => x.kind + ":" + x.id;
const readyKindLabel = (x) => (x.kind === "reimb" ? "Reimbursement" : "Liquidation");

function ReplenishmentFormModal({ onClose, onSave, nextNo, funds, disbursements, liquidations, reimbursements, replenishments, replenishment, plantOptions, preselect }) {
  const isEdit = !!replenishment;
  const defaultBranch = (preselect && preselect.branchCode)
    || ((plantOptions && plantOptions[0]) ? plantOptions[0].code : (funds[0] ? funds[0].branchCode : BRANCHES[0].code));
  const [form, setForm] = useState(
    replenishment
      ? {
          ...replenishment, amount: replenishment.amount, preparedBy: replenishment.preparedBy || "",
          liquidationIds: replenishment.liquidationIds || [], reimbursementIds: replenishment.reimbursementIds || [],
        }
      : {
          date: todayISO(), branchCode: defaultBranch,
          amount: preselect ? preselect.amount : "", preparedBy: "", status: "", remarks: "",
          liquidationIds: preselect ? preselect.liquidationIds : [],
          reimbursementIds: preselect ? preselect.reimbursementIds : [],
        }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const suggested = useMemo(() => suggestedReplenishment(form.branchCode, disbursements, liquidations, replenishments), [form.branchCode, disbursements, liquidations, replenishments]);

  /* Grace Gan-approved liquidations and reimbursements this replenishment may
     claim: the same plant family as the fund being replenished, not already
     claimed by another replenishment (this one's own claims stay selectable
     when editing). */
  const ready = useMemo(() => {
    const plant = plantOfBranch(form.branchCode);
    return replenishmentReadyItems(disbursements, liquidations, reimbursements, replenishments, replenishment && replenishment.id)
      .filter((x) => plantOfBranch(x.branchCode) === plant);
  }, [form.branchCode, disbursements, liquidations, reimbursements, replenishments, replenishment]);
  const pickedKeys = (f) => new Set(
    (f.liquidationIds || []).map((id) => "liq:" + id).concat((f.reimbursementIds || []).map((id) => "reimb:" + id))
  );
  const picked = pickedKeys(form);
  const pickedTotal = round2(ready.filter((x) => picked.has(readyKey(x))).reduce((s, x) => s + x.amount, 0));
  /* Picking items sets the amount to exactly what they total — the figure
     the fund actually spent on approved expenses. */
  const togglePick = (item) => setForm((f) => {
    const field = item.kind === "reimb" ? "reimbursementIds" : "liquidationIds";
    const ids = new Set(f[field] || []);
    if (ids.has(item.id)) ids.delete(item.id); else ids.add(item.id);
    const nf = { ...f, [field]: Array.from(ids) };
    const keys = pickedKeys(nf);
    const total = round2(ready.filter((x) => keys.has(readyKey(x))).reduce((s, x) => s + x.amount, 0));
    return { ...nf, amount: keys.size ? total : f.amount };
  });
  const valid = String(form.preparedBy || "").trim() && Number(form.amount) > 0;

  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{isEdit ? "Edit Replenishment" : "New Replenishment"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Replenishment No.</label>
              <input className="pcp-input" value={isEdit ? replenishment.replenishmentNo : nextNo} disabled />
            </div>
            <div className="pcp-field">
              <label>Date</label>
              <input type="date" className="pcp-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Fund / Plant</label>
              <select className="pcp-select" value={form.branchCode} onChange={(e) => setForm((f) => ({ ...f, branchCode: e.target.value, liquidationIds: [], reimbursementIds: [] }))}>
                {plantOptions ? (
                  plantOptions.map((p) => <option key={p.code} value={p.code}>{p.label} ({p.code})</option>)
                ) : (
                  COMPANIES.map((c) => (
                    <optgroup label={c} key={c}>
                      {branchesForCompany(c).map((b) => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                    </optgroup>
                  ))
                )}
              </select>
            </div>
            <div className="pcp-field">
              <label>Amount (₱)</label>
              <input type="number" min="0" step="0.01" className="pcp-input" placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              <div style={{ fontSize: 11, color: "var(--text-mut)", marginTop: 4 }}>
                Suggested (unreimbursed liquidations): <strong>{peso(suggested)}</strong>
                {suggested > 0 && <button className="pcp-btn pcp-btn-sm" style={{ marginLeft: 8 }} onClick={() => set("amount", suggested)}>Use</button>}
              </div>
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Prepared By</label>
              <input className="pcp-input" placeholder="Full name" value={form.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Status <span style={{ color: "var(--text-mut)", fontWeight: 400 }}>(optional)</span></label>
              <select className="pcp-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="">—</option>
                {REPLENISH_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="pcp-field">
            <label>Remarks</label>
            <input className="pcp-input" placeholder="Optional notes" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
          </div>
          <div className="pcp-field">
            <label>
              Ready for Replenishment
              <span style={{ color: "var(--text-mut)", fontWeight: 400 }}> — liquidations and reimbursements final-approved by {FINAL_APPROVER_NAME}</span>
            </label>
            {ready.length ? (
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}>
                {ready.map((x) => (
                  <label key={readyKey(x)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: "1px solid var(--line)", fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={picked.has(readyKey(x))} onChange={() => togglePick(x)} />
                    <span style={{ flex: 1 }}>
                      <span className="pcp-badge pcp-badge-gray" style={{ marginRight: 6 }}>{readyKindLabel(x)}</span>
                      <b>{x.ref}</b> · {x.employee} · {plantLabel(x.branchCode)}
                    </span>
                    <span className="pcp-num">{peso(x.amount)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--text-mut)" }}>No fully approved liquidations or reimbursements are waiting for this fund.</div>
            )}
            {picked.size > 0 && (
              <div style={{ fontSize: 11.5, marginTop: 4 }}>
                {picked.size} item(s) selected · <b>{peso(pickedTotal)}</b>
                {round2(form.amount) !== pickedTotal && (
                  <span style={{ color: "var(--brand)" }}> — the amount differs from the selected items</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button
            className="pcp-btn pcp-btn-primary" disabled={!valid}
            onClick={() => onSave({
              ...form, amount: Number(form.amount),
              /* Only ids still eligible for this fund survive — a plant change
                 or another user's replenishment cannot leave a stale claim. */
              liquidationIds: (form.liquidationIds || []).filter((id) => ready.some((x) => x.kind === "liq" && x.id === id)),
              reimbursementIds: (form.reimbursementIds || []).filter((id) => ready.some((x) => x.kind === "reimb" && x.id === id)),
            })}
          >{isEdit ? "Save Changes" : "Create Replenishment"}</button>
        </div>
      </div>
    </div>
  );
}

const REPLENISH_SORT_FIELDS = {
  replenishmentNo: (r) => r.replenishmentNo,
  date: (r) => r.date,
  branchCode: (r) => plantLabel(r.branchCode),
  amount: (r) => Number(r.amount) || 0,
  preparedBy: (r) => r.preparedBy,
  status: (r) => r.status,
  remarks: (r) => r.remarks,
};

function ReplenishmentTab({ replenishments, allReplenishmentNos, funds, disbursements, liquidations, reimbursements, onCreate, onEdit, onComplete, onDelete, plantOptions, canEdit, plantTitle }) {
  const [showForm, setShowForm] = useState(false);
  /* Liquidations + amount handed to a new form from the Ready panel. */
  const [preselect, setPreselect] = useState(null);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");
  /* Newest replenishment no. first on open; any header can take over. */
  const sort = useTableSort("replenishmentNo", "desc");

  /* Numbered from EVERY plant's replenishments, not this plant's slice — the
     plant-scoped count restarted at 0001 for each plant, so every plant's
     first replenishment carried the same number. */
  const nextNo = nextSeriesNo("PCRP-2026-", allReplenishmentNos || replenishments.map((r) => r.replenishmentNo));

  /* Grace Gan-approved liquidations and reimbursements not yet claimed by a
     replenishment. */
  const ready = useMemo(
    () => replenishmentReadyItems(disbursements, liquidations, reimbursements, replenishments)
      .filter((x) => plant === "ALL" || x.branchCode === plant),
    [disbursements, liquidations, reimbursements, replenishments, plant]
  );
  /* One replenishment per fund, so group the ready items by plant. */
  const readyByPlant = useMemo(() => {
    const m = new Map();
    ready.forEach((x) => {
      const p = plantOfBranch(x.branchCode);
      if (!m.has(p)) m.set(p, []);
      m.get(p).push(x);
    });
    return Array.from(m.entries());
  }, [ready]);
  const startFromReady = (plantCode, items) => {
    setPreselect({
      branchCode: plantCode,
      liquidationIds: items.filter((x) => x.kind === "liq").map((x) => x.id),
      reimbursementIds: items.filter((x) => x.kind === "reimb").map((x) => x.id),
      amount: round2(items.reduce((s, x) => s + x.amount, 0)),
    });
    setShowForm(true);
  };
  const totalCompleted = replenishments.filter((r) => r.status === "Completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPending = replenishments.filter((r) => r.status !== "Completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const filtered = sort.sortRows(
    replenishments.filter((r) => {
      if (plant !== "ALL" && r.branchCode !== plant) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(r.replenishmentNo.toLowerCase().includes(q) || (r.preparedBy || "").toLowerCase().includes(q))) return false;
      }
      return true;
    }),
    REPLENISH_SORT_FIELDS
  );

  const formPlantOptions = (plantOptions && plantOptions.length)
    ? (plant !== "ALL" ? plantOptions.filter((p) => p.code === plant) : plantOptions)
    : null;

  return (
    <div>
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Replenishment"}
        sub="Reimburse funds for liquidated expenses to restore the imprest balance"
        right={<button className="pcp-btn pcp-btn-primary" onClick={() => { setPreselect(null); setShowForm(true); }}><Plus size={14} /> New Replenishment</button>}
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />
        {/* Liquidations with Grace Gan's final approval, waiting to be replenished. */}
        <div className="pcp-card pcp-card-pad" style={{ marginBottom: 14 }}>
          <div className="pcp-section-title" style={{ margin: "0 0 8px" }}>
            <ShieldCheck size={15} color="#15803d" /> Ready for Replenishment
            <span style={{ fontSize: 11.5, color: "var(--text-mut)", fontWeight: 500, marginLeft: 6 }}>
              ({ready.length}) — fully approved by {FINAL_APPROVER_NAME}, not yet replenished · {peso(ready.reduce((s, x) => s + x.amount, 0))}
            </span>
          </div>
          {readyByPlant.length ? readyByPlant.map(([plantCode, items]) => (
            <div key={plantCode} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <b style={{ fontSize: 12.5 }}>{plantLabel(plantCode)}</b>
                {canEdit && (
                  <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => startFromReady(plantCode, items)}>
                    <RefreshCw size={12} /> Replenish {items.length} · {peso(items.reduce((s, x) => s + x.amount, 0))}
                  </button>
                )}
              </div>
              <div className="pcp-table-wrap">
                <table className="pcp-table">
                  <thead><tr><th>Type</th><th>Voucher / Reimb No.</th><th>Employee</th><th>Branch</th><th>Custodian Approved</th><th>Final Approval</th><th style={{ textAlign: "right" }}>Approved Amount</th></tr></thead>
                  <tbody>
                    {items.map((x) => (
                      <tr key={readyKey(x)}>
                        <td>{readyKindLabel(x)}</td>
                        <td>{x.ref}</td>
                        <td>{x.employee}</td>
                        <td>{plantLabel(x.branchCode)}</td>
                        <td>{x.checkedBy} · {fmtDate(x.checkedAt.slice(0, 10))}</td>
                        <td>{x.finalBy} · {fmtDate(x.finalAt.slice(0, 10))}</td>
                        <td className="pcp-num">{peso(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 12, color: "var(--text-mut)" }}>
              Nothing waiting. A liquidation or reimbursement appears here once the custodian has approved it and {FINAL_APPROVER_NAME} has given final approval (a liquidation's cash must also be settled).
            </div>
          )}
        </div>
        <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <KpiCard label="Total Replenished" value={peso(totalCompleted)} icon={RefreshCw} tint="#15803d" foot="Completed reimbursements" />
          <KpiCard label="Pending Replenishments" value={replenishments.filter((r) => r.status !== "Completed").length} icon={Clock} tint="#b9790a" foot={peso(totalPending) + " in progress"} />
          <KpiCard label="Replenishment Records" value={replenishments.length} icon={Landmark} tint="#2054a3" />
        </div>
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search no. or preparer" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", ...REPLENISH_STATUSES].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>{filtered.length} of {replenishments.length} records</div>
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <SortTh field="replenishmentNo" sort={sort}>Replenishment No.</SortTh>
                  <SortTh field="date" sort={sort}>Date</SortTh>
                  <SortTh field="branchCode" sort={sort}>Fund / Plant</SortTh>
                  <SortTh field="amount" sort={sort}>Amount</SortTh>
                  <SortTh field="preparedBy" sort={sort}>Prepared By</SortTh>
                  <SortTh field="status" sort={sort}>Status</SortTh>
                  <SortTh field="remarks" sort={sort}>Remarks</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.replenishmentNo}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{plantLabel(r.branchCode)}</td>
                    <td className="pcp-num">{peso(r.amount)}</td>
                    <td>{r.preparedBy || "—"}</td>
                    <td>{r.status ? <Badge status={r.status} /> : <span style={{ color: "var(--text-mut)" }}>—</span>}</td>
                    <td style={{ maxWidth: 200, whiteSpace: "normal" }}>
                      {r.remarks || "—"}
                      {!!(r.liquidationIds || []).length && (
                        <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>{r.liquidationIds.length} approved liquidation(s)</div>
                      )}
                      {!!(r.reimbursementIds || []).length && (
                        <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>{r.reimbursementIds.length} approved reimbursement(s)</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && r.status !== "Completed" && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onComplete(r.id)} title="Mark completed"><Check size={12} /></button>
                        )}
                        <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit"><Edit3 size={12} /></button>
                        {canEdit && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onDelete(r.id)} title="Delete"><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={8} className="pcp-empty">No replenishment records match your filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showForm && (
        <ReplenishmentFormModal
          nextNo={nextNo} funds={funds} disbursements={disbursements} liquidations={liquidations} reimbursements={reimbursements} replenishments={replenishments}
          plantOptions={preselect ? (plantOptions || []).filter((p) => plantOfBranch(p.code) === preselect.branchCode) : formPlantOptions}
          preselect={preselect}
          onClose={() => { setShowForm(false); setPreselect(null); }}
          onSave={(form) => { onCreate({ ...form, replenishmentNo: nextNo }); setShowForm(false); setPreselect(null); }}
        />
      )}
      {editing && (
        <ReplenishmentFormModal
          replenishment={editing} funds={funds} disbursements={disbursements} liquidations={liquidations} reimbursements={reimbursements} replenishments={replenishments} plantOptions={formPlantOptions}
          onClose={() => setEditing(null)}
          onSave={(form) => { onEdit(editing.id, form); setEditing(null); }}
        />
      )}
    </div>
  );
}

