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
      date: x.disb.date || "", savedTag: x.liq.replenishCutoff || "",
    };
  });
  const reimbs = reimbursementsReadyForReplenishment(reimbursements, replenishments, exceptReplenishmentId).map((x) => {
    const rv = reimbReview(x.reimb);
    return {
      kind: "reimb", id: x.reimb.id, ref: x.reimb.reimbNo, employee: x.reimb.employee, branchCode: x.reimb.branchCode,
      checkedBy: rv.checkedBy, checkedAt: rv.checkedAt, finalBy: rv.finalBy, finalAt: rv.finalAt, amount: x.amount,
      date: x.reimb.requestDate || "", savedTag: x.reimb.replenishCutoff || "",
    };
  });
  return liqs.concat(reimbs);
}

/* ---- Replenishment cut-off tag ----
   Every ready item is tagged as 1–15 expenses (due on the 30th — the last day
   in February) or 16–30/31 expenses (due on the 15th of the next month). The
   tag is saved on the liquidation / reimbursement (replenishCutoff) by the
   team; until someone sets it, it is suggested from the transaction date
   (voucher release date / reimbursement request date) and shown as "auto".
   The month the due date falls in comes from that same transaction date. */
const CUTOFF_TAGS = [
  { value: "1-15", label: "1–15 expenses", due: "due 30th" },
  { value: "16-end", label: "16–30/31 expenses", due: "due 15th" },
];
function replenishCutoff(item) {
  const s = String((item && item.date) || "").slice(0, 10);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayISO();
  const [y, m, d] = iso.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const saved = item && (item.savedTag === "1-15" || item.savedTag === "16-end") ? item.savedTag : "";
  const tag = saved || (d <= 15 ? "1-15" : "16-end");
  const lastDay = new Date(y, m, 0).getDate();
  const approveOn = tag === "1-15"
    ? `${y}-${pad(m)}-${pad(Math.min(30, lastDay))}`
    : `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-15`;
  const def = CUTOFF_TAGS.find((t) => t.value === tag);
  return {
    tag, auto: !saved, approveOn, month: `${y}-${pad(m)}`,
    monthLabel: new Date(y, m - 1, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    label: def.label,
  };
}
/* The Ready for Replenishment list as a Report Center document, so it prints
   (A4 / Save as PDF) and exports to Excel with the same letterhead, reference
   no. and signature block as every other report. Grouped by plant with the
   fund custodian and a subtotal each — one replenishment per fund. */
function readyReplenishmentDoc(readyByPlant, funds, plantTitle, generatedBy, scopeNote) {
  const col = (key, label, opt = {}) => ({ key, label, align: opt.align || (opt.money ? "right" : "left"), money: !!opt.money, width: opt.width });
  const columns = [
    col("kind", "Type"), col("ref", "Voucher / Reimb No."), col("date", "Txn Date"), col("cutoff", "Cut-off Tag", { width: "15%" }),
    col("employee", "Employee"), col("branch", "Branch"),
    col("checked", "Custodian Approved", { width: "17%" }), col("final", "Final Approval", { width: "17%" }),
    col("amount", "Approved Amount", { money: true }),
  ];
  const stamp = (by, at) => `${by || "—"}${at ? " · " + fmtDate(String(at).slice(0, 10)) : ""}`;
  const rows = [];
  let count = 0;
  const custodians = new Set();
  readyByPlant.forEach(([plantCode, items]) => {
    const fund = (funds || []).find((f) => f.branchCode === plantCode);
    if (fund && fund.custodian) custodians.add(fund.custodian);
    rows.push({ _group: true, kind: `${plantLabel(plantCode)} (${plantCode}) — ${companyOfBranch(plantCode)}${fund && fund.custodian ? " · Custodian: " + fund.custodian : ""}` });
    items.forEach((x) => {
      count++;
      const cut = replenishCutoff(x);
      rows.push({ kind: readyKindLabel(x), ref: x.ref, date: x.date ? fmtDate(x.date) : "—",
        cutoff: `${cut.label} · due ${fmtDate(cut.approveOn)}`,
        employee: x.employee, branch: plantLabel(x.branchCode) || x.branchCode,
        checked: stamp(x.checkedBy, x.checkedAt), final: stamp(x.finalBy, x.finalAt), amount: x.amount });
    });
    rows.push({ _subtotal: true, kind: `Subtotal — ${items.length} item(s) to replenish`, amount: round2(items.reduce((s, x) => s + x.amount, 0)) });
  });
  const totalsRow = { _total: true, kind: "GRAND TOTAL FOR REPLENISHMENT",
    amount: round2(readyByPlant.reduce((s, [, items]) => s + items.reduce((a, x) => a + x.amount, 0), 0)) };
  const companies = [...new Set(readyByPlant.map(([p]) => companyOfBranch(p)).filter(Boolean))];
  const company = companies.length === 1 ? companies[0] : "";
  const profile = companyProfile(company);
  return {
    title: "Ready for Replenishment", orientation: "landscape", columns, rows, totalsRow, count,
    meta: {
      "Plant": readyByPlant.length === 1 ? plantLabel(readyByPlant[0][0]) : (plantTitle || "All Plants"),
      "Company": company || "All Companies",
      "Custodian": custodians.size === 1 ? [...custodians][0] : (custodians.size ? "Multiple — see each plant" : "—"),
      "Basis": `Fully approved by ${FINAL_APPROVER_NAME}, not yet replenished`,
      ...(scopeNote ? { "Covers": scopeNote } : {}),
      "Generated By": generatedBy || "System",
      "Date Generated": nowStamp(),
    },
    reference: makeReportRef("READYREPL"), watermark: false,
    company, logo: logoForCompany(company),
    reviewer: (profile && profile.reviewer) || DEFAULT_REVIEWER,
    approver: (profile && profile.approver) || DEFAULT_APPROVER,
    approverRole: (profile && profile.approverRole) || DEFAULT_APPROVER_ROLE,
  };
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
          amount: preselect ? preselect.amount : "", preparedBy: "", status: "", remarks: (preselect && preselect.remarks) || "",
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

function ReplenishmentTab({ replenishments, allReplenishmentNos, funds, disbursements, liquidations, reimbursements, onCreate, onEdit, onComplete, onDelete, plantOptions, canEdit, plantTitle, generatedBy, onTagCutoff }) {
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
      .filter((x) => plant === "ALL" || x.branchCode === plant)
      .map((x) => ({ ...x, cut: replenishCutoff(x) }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [disbursements, liquidations, reimbursements, replenishments, plant]
  );

  /* ---- Cut-off tag filter, month, search and selection ----
     Ticked items drive Replenish, Print and Excel; with nothing ticked, those
     act on everything shown. */
  const [tagFilter, setTagFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [readySearch, setReadySearch] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const today = todayISO();
  const months = useMemo(() => {
    const m = new Map();
    ready.forEach((x) => m.set(x.cut.month, x.cut.monthLabel));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ready]);
  const rq = readySearch.trim().toLowerCase();
  const shown = ready.filter((x) => (tagFilter === "ALL" || x.cut.tag === tagFilter)
    && (monthFilter === "ALL" || x.cut.month === monthFilter)
    && (!rq || [x.ref, x.employee, plantLabel(x.branchCode), x.checkedBy, x.finalBy].some((v) => String(v || "").toLowerCase().includes(rq))));
  /* Summary per tag for the two tiles (within the month / search in force). */
  const tagBase = ready.filter((x) => (monthFilter === "ALL" || x.cut.month === monthFilter));
  const tagStats = CUTOFF_TAGS.map((t) => {
    const arr = tagBase.filter((x) => x.cut.tag === t.value);
    const dues = [...new Set(arr.map((x) => x.cut.approveOn))].sort();
    return { ...t, count: arr.length, amount: round2(arr.reduce((s, x) => s + x.amount, 0)),
      nextDue: dues[0] || "", overdue: arr.filter((x) => x.cut.approveOn < today).length,
      auto: arr.filter((x) => x.cut.auto).length };
  });
  const pickedShown = shown.filter((x) => picked.has(readyKey(x)));
  const sumOf = (arr) => round2(arr.reduce((s, x) => s + x.amount, 0));
  const togglePick = (keys, on) => setPicked((p) => {
    const n = new Set(p);
    keys.forEach((k) => (on ? n.add(k) : n.delete(k)));
    return n;
  });
  const clearPicked = () => setPicked(new Set());
  const allShownPicked = shown.length > 0 && pickedShown.length === shown.length;

  /* One replenishment per fund, so group by plant. */
  const groupByPlant = (arr) => {
    const m = new Map();
    arr.forEach((x) => {
      const p = plantOfBranch(x.branchCode);
      if (!m.has(p)) m.set(p, []);
      m.get(p).push(x);
    });
    return Array.from(m.entries());
  };
  const readyByPlant = groupByPlant(shown);
  const exportScope = pickedShown.length ? pickedShown : shown;
  const exportNote = [
    pickedShown.length ? `${pickedShown.length} selected item(s)` : "",
    tagFilter !== "ALL" ? (CUTOFF_TAGS.find((t) => t.value === tagFilter) || {}).label : "",
    monthFilter !== "ALL" ? (months.find((m) => m[0] === monthFilter) || [])[1] : "",
    rq ? `Search "${readySearch.trim()}"` : "",
  ].filter(Boolean).join(" · ");
  const exportDoc = () => readyReplenishmentDoc(groupByPlant(exportScope), funds, plantTitle, generatedBy, exportNote);

  const startFromReady = (plantCode, items) => {
    const cuts = [...new Set(items.map((x) => `${x.cut.label} ${x.cut.monthLabel}`))];
    setPreselect({
      branchCode: plantCode,
      liquidationIds: items.filter((x) => x.kind === "liq").map((x) => x.id),
      reimbursementIds: items.filter((x) => x.kind === "reimb").map((x) => x.id),
      amount: round2(items.reduce((s, x) => s + x.amount, 0)),
      remarks: `Cut-off ${cuts.join(", ")} · ${items.length} item(s)`,
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
        {/* Liquidations and reimbursements with final approval, waiting to be
            replenished — filterable by cut-off period, searchable, selectable. */}
        <div className="pcp-card pcp-card-pad pcp-rr" style={{ marginBottom: 14 }}>
          <div className="pcp-section-title" style={{ margin: "0 0 4px", flexWrap: "wrap" }}>
            <ShieldCheck size={15} color="#15803d" /> Ready for Replenishment
            <span style={{ fontSize: 11.5, color: "var(--text-mut)", fontWeight: 500 }}>
              {ready.length} item(s) · {peso(sumOf(ready))} — fully approved by {FINAL_APPROVER_NAME}, not yet replenished
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button className="pcp-btn pcp-btn-sm" disabled={!exportScope.length}
                title={pickedShown.length ? "Print or save the SELECTED items as PDF" : "Print or save everything shown as PDF"}
                onClick={() => printReportDocument(exportDoc())}>
                <Printer size={12} /> Print / PDF{pickedShown.length ? ` (${pickedShown.length})` : ""}
              </button>
              <button className="pcp-btn pcp-btn-sm" disabled={!exportScope.length}
                title={pickedShown.length ? "Export the SELECTED items to Excel" : "Export everything shown to Excel"}
                onClick={() => exportReportExcel(exportDoc())}>
                <FileSpreadsheet size={12} /> Excel{pickedShown.length ? ` (${pickedShown.length})` : ""}
              </button>
            </span>
          </div>
          {ready.length > 0 && (
            <>
              {/* Two cut-off tiles — click to filter; click again to show all. */}
              <div className="pcp-rr-tiles">
                {tagStats.map((t) => (
                  <button key={t.value} className={"pcp-rr-tile" + (tagFilter === t.value ? " active" : "") + (t.overdue ? " due" : "")}
                    onClick={() => setTagFilter(tagFilter === t.value ? "ALL" : t.value)}>
                    <span className="lbl">{t.label} <span className="tagdue">{t.due}</span></span>
                    <span className="amt pcp-num">{peso(t.amount)}</span>
                    <span className="sub">
                      {t.count} item(s)
                      {t.nextDue ? ` · next due ${fmtDate(t.nextDue)}` : ""}
                      {t.overdue ? ` · ${t.overdue} past due` : ""}
                      {t.auto ? ` · ${t.auto} auto-tagged` : ""}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search + bulk selection. */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "10px 0" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
                  <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
                  <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search voucher / reimb no., employee, approver…"
                    value={readySearch} onChange={(e) => setReadySearch(e.target.value)} />
                </div>
                <select className="pcp-select" style={{ width: 190 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} title="Cut-off tag">
                  <option value="ALL">All cut-off tags</option>
                  {CUTOFF_TAGS.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.due})</option>)}
                </select>
                <select className="pcp-select" style={{ width: 170 }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} title="Month of the transaction">
                  <option value="ALL">All months</option>
                  {months.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button className="pcp-btn pcp-btn-sm" disabled={!shown.length}
                  onClick={() => togglePick(shown.map(readyKey), !allShownPicked)}>
                  <Check size={12} /> {allShownPicked ? "Unselect all shown" : `Select all shown (${shown.length})`}
                </button>
                {pickedShown.length > 0 && canEdit && onTagCutoff && (
                  <select className="pcp-select" style={{ width: 200 }} value=""
                    onChange={(e) => { const v = e.target.value; if (v) pickedShown.forEach((x) => onTagCutoff(x.kind, x.id, v)); }}
                    title="Tag every selected item">
                    <option value="">Tag {pickedShown.length} selected as…</option>
                    {CUTOFF_TAGS.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.due})</option>)}
                  </select>
                )}
                {pickedShown.length > 0 && (
                  <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={clearPicked}><X size={12} /> Clear selection</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>
                  Showing {shown.length} of {ready.length} · {peso(sumOf(shown))}
                </span>
              </div>
            </>
          )}

          {readyByPlant.length ? readyByPlant.map(([plantCode, items]) => {
            const keys = items.map(readyKey);
            const sel = items.filter((x) => picked.has(readyKey(x)));
            const allSel = sel.length === items.length;
            const fund = (funds || []).find((f) => f.branchCode === plantCode);
            return (
              <div key={plantCode} className="pcp-rr-plant">
                <div className="pcp-rr-plant-head">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={allSel} ref={(el) => { if (el) el.indeterminate = sel.length > 0 && !allSel; }}
                      onChange={() => togglePick(keys, !allSel)} />
                    <b style={{ fontSize: 13 }}>{plantLabel(plantCode)}</b>
                  </label>
                  <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>
                    {fund && fund.custodian ? `Custodian: ${fund.custodian} · ` : ""}{items.length} item(s) · {peso(sumOf(items))}
                  </span>
                  {canEdit && (
                    <button className="pcp-btn pcp-btn-sm pcp-btn-primary" style={{ marginLeft: "auto" }}
                      onClick={() => startFromReady(plantCode, sel.length ? sel : items)}
                      title={sel.length ? "Create a replenishment for the ticked items" : "Create a replenishment for every item shown for this plant"}>
                      <RefreshCw size={12} /> {sel.length ? `Replenish selected ${sel.length} · ${peso(sumOf(sel))}` : `Replenish all ${items.length} · ${peso(sumOf(items))}`}
                    </button>
                  )}
                </div>
                <div className="pcp-table-wrap">
                  <table className="pcp-table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th><th>Type</th><th>Voucher / Reimb No.</th><th>Txn Date</th><th>Cut-off Tag</th>
                        <th>Employee</th><th>Branch</th><th>Custodian Approved</th><th>Final Approval</th>
                        <th style={{ textAlign: "right" }}>Approved Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((x) => {
                        const k = readyKey(x);
                        const on = picked.has(k);
                        return (
                          <tr key={k} className={"pcp-rr-row" + (on ? " on" : "")} onClick={() => togglePick([k], !on)}>
                            <td onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={on} onChange={() => togglePick([k], !on)} />
                            </td>
                            <td><span className={"pcp-badge " + (x.kind === "reimb" ? "pcp-badge-blue" : "pcp-badge-gray")}>{readyKindLabel(x)}</span></td>
                            <td><strong>{x.ref}</strong></td>
                            <td>{x.date ? fmtDate(x.date) : "—"}</td>
                            {/* Tag dropdown — saved on the record for everyone.
                                "auto" = suggested from the date, not yet confirmed. */}
                            <td onClick={(e) => e.stopPropagation()} style={{ minWidth: 170 }}>
                              {canEdit && onTagCutoff ? (
                                <select className={"pcp-select pcp-rr-tag" + (x.cut.tag === "1-15" ? " t1" : " t2")}
                                  value={x.cut.tag} onChange={(e) => onTagCutoff(x.kind, x.id, e.target.value)}>
                                  {CUTOFF_TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              ) : (
                                <span className={"pcp-badge " + (x.cut.tag === "1-15" ? "pcp-badge-blue" : "pcp-badge-amber")}>{x.cut.label}</span>
                              )}
                              <div style={{ fontSize: 10.5, marginTop: 2, color: x.cut.approveOn < today ? "var(--brand)" : "var(--text-mut)", fontWeight: x.cut.approveOn < today ? 700 : 400 }}>
                                {x.cut.approveOn < today ? "Past due " : x.cut.approveOn === today ? "Due today " : "Due "}{fmtDate(x.cut.approveOn)}
                                {x.cut.auto && <span style={{ fontWeight: 400, color: "var(--text-mut)" }}> · auto</span>}
                              </div>
                            </td>
                            <td>{x.employee}</td>
                            <td>{plantLabel(x.branchCode)}</td>
                            <td>{x.checkedBy} · {fmtDate(String(x.checkedAt || "").slice(0, 10))}</td>
                            <td>{x.finalBy} · {fmtDate(String(x.finalAt || "").slice(0, 10))}</td>
                            <td className="pcp-num" style={{ textAlign: "right", fontWeight: 700 }}>{peso(x.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }) : (
            <div style={{ fontSize: 12, color: "var(--text-mut)" }}>
              {ready.length
                ? "Nothing matches this cut-off / search."
                : `Nothing waiting. A liquidation or reimbursement appears here once the custodian has approved it and ${FINAL_APPROVER_NAME} has given final approval (a liquidation's cash must also be settled).`}
            </div>
          )}

          {/* Selection summary — stays in view while scrolling a long list. */}
          {pickedShown.length > 0 && (
            <div className="pcp-rr-bar">
              <span><b>{pickedShown.length}</b> selected · <b className="pcp-num">{peso(sumOf(pickedShown))}</b>
                {" "}across {groupByPlant(pickedShown).length} plant(s)</span>
              {groupByPlant(pickedShown).length > 1 && (
                <span style={{ fontSize: 11, opacity: 0.8 }}>One replenishment is created per plant — use each plant's Replenish button.</span>
              )}
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {canEdit && groupByPlant(pickedShown).length === 1 && (
                  <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => startFromReady(groupByPlant(pickedShown)[0][0], pickedShown)}>
                    <RefreshCw size={12} /> Replenish selected
                  </button>
                )}
                <button className="pcp-btn pcp-btn-sm" onClick={clearPicked}><X size={12} /> Clear</button>
              </span>
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

