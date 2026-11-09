/* ========================= ACCOUNTING MODULES =========================
   Two modules for the Accounting step of the approval chain:

     Requestor submits → Custodian approves → ACCOUNTING - APPROVAL
       (pending Accounting) → Accounting checks and assigns a Batch Number
       → ACCOUNTING - APPROVED (and on to Grace Gan's final approval).

   Accounting - Approval: every Petty Cash Advance liquidation and Employee
     Reimbursement a custodian has approved and Accounting has not yet
     checked (stage For Accounting Check). Opening one shows the whole
     transaction — documents, receipts, approval history — with the usual
     Accounting Review box: assign a Batch Number, add remarks, mark it
     checked (= Accounting approval), or revert it to the custodian for
     correction. Once checked it leaves this list and shows in
     Accounting - Approved; nothing is moved or copied, the list is derived
     from the record's own review stamps, so a transaction can never sit in
     both or be approved twice (the handler refuses an already-checked one).

   Accounting - Approved: every transaction Accounting has checked and
     batched, with where it stands now (awaiting Grace Gan, approved by her,
     replenished). View only. A transaction reverted to the custodian has its
     Accounting check cleared, so it is not counted as Accounting-approved.

   Who sees them: ACCOUNTING_MODULE_EMAILS — Accounting and the System
   Superuser. Only an Accounting checker (ACCOUNTING_CHECKER_EMAILS) can act;
   the Superuser views. Every action goes through the existing handlers in
   19-app.jsx (accountingReview / escalationRevert), which re-check who is
   calling — this file adds no authority.

   Print / PDF and Export Excel take the ticked rows, else exactly the rows
   the filters show.
--------------------------------------------------------------------------- */

const ACCOUNTING_MODULE_EMAILS = ["accounting@a1plus.com", "superuser@a1plus.com"];

const ACCT_STATUS_PENDING = "Pending Accounting Approval";
const ACCT_ALL_STATUSES = "All statuses";
const ACCT_ALL_AGING = "All aging";

/* Pending aging — days since the custodian approved it (owner's buckets). */
const ACCT_AGING = [
  { key: "new", label: "0–2 days · Newly received", short: "Newly received", max: 2, badge: "green", tint: "#15803d" },
  { key: "follow", label: "3–5 days · For follow-up", short: "For follow-up", max: 5, badge: "blue", tint: "#2f64a6" },
  { key: "attention", label: "6–7 days · Needs attention", short: "Needs attention", max: 7, badge: "amber", tint: "#b9790a" },
  { key: "overdue", label: "More than 7 days · Overdue", short: "Overdue", max: Infinity, badge: "red", tint: "#b42318" },
];
const acctAgingOf = (days) => ACCT_AGING.find((b) => days <= b.max) || ACCT_AGING[ACCT_AGING.length - 1];
/* Whole days from a stamp to now (never negative; 0 when unknown). */
function acctDaysSince(ts) {
  if (!ts) return 0;
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(ts) ? ts : String(ts).replace(" ", "T") + "Z");
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
const fmtAcctModStamp = (ts) => (ts ? fmtApprovalStamp(ts) : "—");

/* Where an Accounting-approved transaction stands now. */
function acctApprovedStatus(stage) {
  const k = approvalStageKey(stage);
  if (k === approvalStageKey(LIQ_STAGE.FOR_FINAL)) return "For Final Approval of Grace Gan";
  if (k === approvalStageKey(LIQ_STAGE.AWAITING_SETTLEMENT)) return "Awaiting Settlement";
  if (k === approvalStageKey(LIQ_STAGE.READY) || k === approvalStageKey(LIQ_STAGE.LEGACY)
    || (typeof REIMB_STATUS !== "undefined" && k === approvalStageKey(REIMB_STATUS.READY))) return "Approved by Grace Gan";
  if (k === approvalStageKey(LIQ_STAGE.REPLENISHED)) return "Replenished";
  return String(stage || "—");
}
const ACCT_STATUS_BADGE = {
  [ACCT_STATUS_PENDING]: "amber",
  "For Final Approval of Grace Gan": "blue",
  "Awaiting Settlement": "amber",
  "Approved by Grace Gan": "green",
  "Replenished": "green",
};

/* Every submitted transaction in one row shape, with its Accounting state. */
function accountingRows(disbursements, liquidations, reimbursements, replenishments) {
  const rows = [];
  pcaApprovalQueue(disbursements, liquidations, replenishments).forEach((x) => {
    if (x.stage === LIQ_STAGE.REJECTED) return;
    const rv = x.review;
    const d = x.disb;
    rows.push({
      key: "liq:" + d.id, id: d.id, kind: "Liquidation",
      txnNo: d.voucherNo || "", plantCode: d.branchCode, requestor: d.employee || "",
      particulars: d.purpose || disbExpense(d) || "",
      cashAdvance: Number(d.amount) || 0,
      amount: round2(x.amounts.approvedTotal || liquidatedTotal(x.liq)),
      txnDate: String(d.date || "").slice(0, 10),
      stage: x.stage, rv,
      pending: x.stage === LIQ_STAGE.FOR_ACCOUNTING && rv.checked && !rv.acctChecked,
      approved: rv.acctChecked && !!rv.batchNo,
      escRevert: liqEscalationRevert(d, x.liq),
    });
  });
  const replenishedIds = replenishedReimbursementIds(replenishments);
  (reimbursements || []).forEach((r) => {
    if (r.status === REIMB_STATUS.DRAFT || r.status === REIMB_STATUS.REJECTED) return;
    const rv = reimbReview(r);
    const stage = reimbApprovalStage(r, replenishedIds);
    rows.push({
      key: "reimb:" + r.id, id: r.id, kind: "Reimbursement",
      txnNo: r.reimbNo || "", plantCode: r.branchCode, requestor: r.employee || "",
      particulars: r.purpose || "",
      cashAdvance: null,
      amount: round2(reimbTotal(r)),
      txnDate: String(r.requestDate || r.submittedAt || "").slice(0, 10),
      stage, rv,
      pending: approvalStageKey(stage) === approvalStageKey(REIMB_STAGE.FOR_ACCOUNTING) && rv.checked && !rv.acctChecked,
      approved: rv.acctChecked && !!rv.batchNo,
      escRevert: reimbEscalationRevert(r),
    });
  });
  return rows.map((r) => {
    const days = acctDaysSince(r.rv.checkedAt);
    return {
      ...r,
      company: companyOfBranch(r.plantCode) || "",
      custodian: custodianCheckerLabel(r.rv) || "",
      custodianAt: r.rv.checkedAt || "",
      acctAt: r.rv.acctChecked ? r.rv.acctCheckedAt || "" : "",
      acctBy: r.rv.acctChecked ? acctCheckerLabel(r.rv) : "",
      acctRemarks: r.rv.acctRemarks || "",
      batchNo: r.rv.batchNo || "",
      finalAt: r.rv.final ? r.rv.finalAt || "" : "",
      status: r.pending ? ACCT_STATUS_PENDING : acctApprovedStatus(r.stage),
      days, aging: acctAgingOf(days),
    };
  });
}

/* Report document for printReportDocument — grouped by plant with subtotals. */
function accountingModuleDoc(list, mode, scopeLabel, generatedBy, scopeNote) {
  const pending = mode === "pending";
  const col = (key, label, opt = {}) => ({ key, label, align: opt.align || (opt.money ? "right" : "left"), money: !!opt.money });
  const columns = [
    col("txnNo", "Transaction / Ref. No."), col("branch", "Company / Plant"), col("requestor", "Requestor"),
    col("custodian", "Custodian"), col("txnDate", "Transaction Date"), col("kind", "Type"),
    col("particulars", "Particulars"), col("custodianAt", "Custodian Approval"),
  ].concat(pending ? [col("aging", "Pending Aging")] : [col("acctAt", "Accounting Approval"), col("batchNo", "Batch No.")])
    .concat([col("status", "Status"), col("amount", "Amount", { money: true })]);
  const byPlant = new Map();
  list.forEach((r) => {
    const p = plantOfBranch(r.plantCode);
    if (!byPlant.has(p)) byPlant.set(p, []);
    byPlant.get(p).push(r);
  });
  const rows = [];
  byPlant.forEach((items, plantCode) => {
    rows.push({ _group: true, txnNo: `${plantLabel(plantCode)} — ${companyOfBranch(plantCode)}` });
    items.forEach((r) => rows.push({
      txnNo: r.txnNo || "—", branch: `${r.company || "—"} / ${plantLabel(r.plantCode)}`, requestor: r.requestor || "—",
      custodian: r.custodian || "—", txnDate: r.txnDate ? fmtDate(r.txnDate) : "—", kind: r.kind,
      particulars: r.particulars || "—", custodianAt: fmtAcctModStamp(r.custodianAt),
      aging: `${r.days} day(s) · ${r.aging.short}`, acctAt: fmtAcctModStamp(r.acctAt), batchNo: r.batchNo || "—",
      status: r.status, amount: r.amount,
    }));
    rows.push({ _subtotal: true, txnNo: `Subtotal — ${plantLabel(plantCode)} · ${items.length} transaction(s)`,
      amount: round2(items.reduce((s, r) => s + r.amount, 0)) });
  });
  const totalsRow = { _total: true, txnNo: `GRAND TOTAL — ${list.length} transaction(s)`,
    amount: round2(list.reduce((s, r) => s + r.amount, 0)) };
  const companies = [...new Set([...byPlant.keys()].map((p) => companyOfBranch(p)).filter(Boolean))];
  const company = companies.length === 1 ? companies[0] : "";
  const profile = companyProfile(company);
  return {
    title: `${pending ? "Accounting - Approval (Pending Accounting Approval)" : "Accounting - Approved"} — ${scopeLabel}`,
    orientation: "landscape", columns, rows, totalsRow, count: list.length,
    meta: {
      "Plant": scopeLabel,
      "Company": company || "All Companies",
      "Covers": scopeNote,
      "Generated By": generatedBy || "System",
      "Date Generated": nowStamp(),
    },
    reference: makeReportRef(pending ? "ACCT-APPROVAL" : "ACCT-APPROVED"), watermark: false,
    company, logo: logoForCompany(company),
    reviewer: (profile && profile.reviewer) || DEFAULT_REVIEWER,
    approver: (profile && profile.approver) || DEFAULT_APPROVER,
    approverRole: (profile && profile.approverRole) || DEFAULT_APPROVER_ROLE,
  };
}

/* mode: "pending" (Accounting - Approval) | "approved" (Accounting - Approved). */
function AccountingModuleTab({
  mode, disbursements, liquidations, reimbursements, replenishments, plantOptions, currentUser,
  accounting, onDecideReceipt, onRejectLiquidation, onReopenLiquidation, onCheckLiquidation, onFinalApprove,
  onReimbursementAction, onOpenOther,
}) {
  const pendingMode = mode === "pending";
  const title = pendingMode ? "Accounting - Approval" : "Accounting - Approved";
  /* Acting is for an Accounting checker on a pending transaction only. */
  const canAct = pendingMode && !!(accounting && accounting.isChecker);
  const readOnlyAccounting = useMemo(() => ({ ...(accounting || {}), isChecker: false, onReview: undefined, onEscalationRevert: undefined }), [accounting]);

  const [plant, setPlant] = useState("ALL");
  const [kind, setKind] = useState("all");
  const [company, setCompany] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState(ACCT_ALL_STATUSES);
  const [aging, setAging] = useState(ACCT_ALL_AGING);
  const [selected, setSelected] = useState([]);
  const [openRow, setOpenRow] = useState(null);
  const sort = useTableSort(pendingMode ? "custodianAt" : "acctAt", pendingMode ? "asc" : "desc", "txnNo");

  const everyRow = useMemo(
    () => accountingRows(disbursements, liquidations, reimbursements, replenishments),
    [disbursements, liquidations, reimbursements, replenishments]
  );
  const pendingAll = everyRow.filter((r) => r.pending);
  const approvedAll = everyRow.filter((r) => r.approved);
  const allRows = pendingMode ? pendingAll : approvedAll;

  const inPlant = (r) => plant === "ALL" || plantOfBranch(r.plantCode) === plantOfBranch(plant);
  const rowPlantLabel = (r) => plantLabel(plantOfBranch(r.plantCode));
  const companyOptions = [...new Set(allRows.map((r) => r.company).filter(Boolean))].sort();
  const statusOptions = [...new Set(approvedAll.map((r) => r.status))].sort();
  const s = search.trim().toLowerCase();
  const baseRows = allRows.filter((r) => inPlant(r)
    && (company === "ALL" || r.company === company)
    && (pendingMode || status === ACCT_ALL_STATUSES || r.status === status)
    && (!pendingMode || aging === ACCT_ALL_AGING || r.aging.key === aging)
    && (!s || [r.txnNo, r.requestor, r.particulars, r.custodian, r.batchNo, r.company, plantLabel(r.plantCode), rowPlantLabel(r)]
      .some((f) => String(f || "").toLowerCase().includes(s)))
    && (!dateFrom || r.txnDate >= dateFrom)
    && (!dateTo || r.txnDate <= dateTo));
  const countKind = (k) => baseRows.filter((r) => r.kind === k).length;
  const cf = useTableColumnFilters(baseRows.filter((r) => kind === "all" || r.kind === kind), {
    txnNo: (r) => cfText(r.txnNo),
    plant: (r) => cfText(rowPlantLabel(r)),
    requestor: (r) => cfText(r.requestor),
    custodian: (r) => cfText(r.custodian),
    kind: (r) => cfText(r.kind),
    amount: (r) => peso(r.amount),
    txnDate: (r) => (r.txnDate ? fmtDate(r.txnDate) : "—"),
    custodianAt: (r) => cfText(fmtAcctModStamp(r.custodianAt)),
    acctAt: (r) => cfText(fmtAcctModStamp(r.acctAt)),
    aging: (r) => r.aging.short,
    status: (r) => cfText(r.status),
  });
  const rows = sort.sortRows(cf.rows, {
    txnNo: (r) => r.txnNo,
    plant: (r) => rowPlantLabel(r) + " " + plantLabel(r.plantCode),
    requestor: (r) => r.requestor,
    custodian: (r) => r.custodian,
    kind: (r) => r.kind,
    amount: (r) => r.amount,
    txnDate: (r) => r.txnDate,
    custodianAt: (r) => r.custodianAt,
    acctAt: (r) => r.acctAt,
    aging: (r) => r.days,
    status: (r) => r.status,
  });
  const filtersOn = plant !== "ALL" || kind !== "all" || company !== "ALL" || !!s || !!dateFrom || !!dateTo
    || status !== ACCT_ALL_STATUSES || aging !== ACCT_ALL_AGING || cf.active;
  const clearFilters = () => {
    setPlant("ALL"); setKind("all"); setCompany("ALL"); setSearch(""); setDateFrom(""); setDateTo("");
    setStatus(ACCT_ALL_STATUSES); setAging(ACCT_ALL_AGING); cf.clear();
  };

  /* ---- Select (only rows still shown count) ---- */
  const selectedRows = rows.filter((r) => selected.includes(r.key));
  const allTicked = rows.length > 0 && selectedRows.length === rows.length;
  const toggleRow = (key) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const toggleAll = () => setSelected(allTicked ? [] : rows.map((r) => r.key));
  const outRows = selectedRows.length ? selectedRows : rows;
  const outLabel = selectedRows.length ? `${selectedRows.length} selected` : `all ${rows.length} shown`;

  const scopeLabel = plant === "ALL" ? "All Plants" : plantLabel(plantOfBranch(plant));
  const scopeNote = () => [
    selectedRows.length ? `${selectedRows.length} selected transaction(s)` : `${rows.length} transaction(s)`,
    kind === "all" ? "liquidations and reimbursements" : kind === "Liquidation" ? "Petty Cash Advance liquidations" : "Employee reimbursements",
  ].concat(company !== "ALL" ? [company] : [])
    .concat(!pendingMode && status !== ACCT_ALL_STATUSES ? [status] : [])
    .concat(pendingMode && aging !== ACCT_ALL_AGING ? [(ACCT_AGING.find((b) => b.key === aging) || {}).label] : [])
    .concat(dateFrom || dateTo ? [`transaction date ${dateFrom ? fmtDate(dateFrom) : "…"} to ${dateTo ? fmtDate(dateTo) : "…"}`] : [])
    .concat(s ? [`search "${search.trim()}"`] : []).join(" · ");

  const exportExcel = () => {
    if (!outRows.length) { window.alert("There is nothing to export."); return; }
    const out = outRows.map((r) => ({
      "Transaction / Reference No.": r.txnNo,
      "Company": r.company,
      "Plant": rowPlantLabel(r),
      "Branch": plantLabel(r.plantCode),
      "Requestor Name": r.requestor,
      "Custodian Name": r.custodian,
      "Transaction Date": r.txnDate,
      "Transaction Type": r.kind,
      "Particulars / Description": r.particulars,
      "Cash Advance": r.cashAdvance == null ? "" : r.cashAdvance,
      "Amount": r.amount,
      "Custodian Approval Date": r.custodianAt ? fmtAcctModStamp(r.custodianAt) : "",
      "Accounting Approval Date": r.acctAt ? fmtAcctModStamp(r.acctAt) : "",
      "Accounting Approved By": r.acctBy,
      "Accounting Remarks": r.acctRemarks,
      "Batch No.": r.batchNo,
      ...(pendingMode ? { "Pending Days": r.days, "Pending Aging": r.aging.short } : {
        "Final Approval (Grace Gan)": r.finalAt ? fmtAcctModStamp(r.finalAt) : "",
      }),
      "Status": r.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), pendingMode ? "Accounting Approval" : "Accounting Approved");
    const name = `${pendingMode ? "Accounting_Approval" : "Accounting_Approved"}_${scopeLabel.replace(/[^A-Za-z0-9]+/g, "_")}`
      + (selectedRows.length ? "_Selected" : "");
    downloadWorkbook(wb, `${name}_${todayISO()}.xlsx`);
  };
  const printPdf = () => {
    if (!outRows.length) { window.alert("There is nothing to print."); return; }
    printReportDocument(accountingModuleDoc(outRows, mode, scopeLabel, currentUser, scopeNote()));
  };

  const mut = { fontSize: 10.5, color: "var(--text-mut)" };
  const sum = (xs) => round2(xs.reduce((t, r) => t + r.amount, 0));
  const inScopeAll = (xs) => xs.filter(inPlant);

  /* ---- An opened liquidation: its full details in place of the list ---- */
  const noop = () => {};
  const openPca = openRow && openRow.kind === "Liquidation"
    ? pcaApprovalQueue(disbursements, liquidations, replenishments).find((x) => x.disb.id === openRow.id) : null;
  if (openPca) {
    const live = canAct && openPca.stage === LIQ_STAGE.FOR_ACCOUNTING;
    return (
      <div className="pcp-liq-full pcp-approval-page">
        <TopBar title={title} sub={`Liquidation ${openPca.disb.voucherNo} · ${openPca.disb.employee}${live ? "" : " · view only"}`} />
        <div className="pcp-content">
          <button className="pcp-btn pcp-btn-sm" style={{ marginBottom: 12 }} onClick={() => setOpenRow(null)}>
            <ChevronLeft size={12} /> Back to {title}
          </button>
          <PcaApprovalPanel
            key={openPca.disb.id} row={openPca}
            isChecker={false} isFinalApprover={false} currentUser={currentUser}
            accounting={live ? accounting : readOnlyAccounting}
            onDecideReceipt={live ? onDecideReceipt : noop} onRejectLiquidation={noop} onReopenLiquidation={noop}
            onCheckLiquidation={live ? onCheckLiquidation : noop} onFinalApprove={noop}
            canRevert={false} onRevertLiquidation={undefined}
          />
        </div>
      </div>
    );
  }
  const openReimb = openRow && openRow.kind === "Reimbursement"
    ? (reimbursements || []).find((x) => x.id === openRow.id) : null;
  const reimbLive = !!openReimb && canAct && reimbAwaitingAccounting(openReimb);
  const open = (r) => setOpenRow({ kind: r.kind, id: r.id });

  const pendScope = inScopeAll(pendingAll);
  const apprScope = inScopeAll(approvedAll);
  const agingCount = (k) => pendScope.filter((r) => r.aging.key === k).length;

  return (
    <div className="pcp-liq-full pcp-approval-page">
      <TopBar title={title}
        sub={pendingMode
          ? (canAct
            ? "Custodian-approved transactions waiting for Accounting. Open one to review its documents, assign a Batch Number and approve, or return it to the custodian."
            : "View only — custodian-approved transactions waiting for Accounting.")
          : "View only — every transaction Accounting has checked and approved, and where it stands now."} />
      <div className="pcp-content">
        {/* Dashboard summary: both modules show both totals. */}
        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 12 }}>
          <KpiCard label={`Pending Accounting Approval — ${scopeLabel}`} value={pendScope.length} icon={Clock} tint="#b9790a"
            foot={pesoB(sum(pendScope))} onClick={!pendingMode && onOpenOther ? () => onOpenOther("acct-approval") : undefined} />
          <KpiCard label={`Approved by Accounting — ${scopeLabel}`} value={apprScope.length} icon={ShieldCheck} tint="#15803d"
            foot={pesoB(sum(apprScope))} onClick={pendingMode && onOpenOther ? () => onOpenOther("acct-approved") : undefined} />
          <KpiCard label="Liquidations (shown)" value={countKind("Liquidation")} icon={FileSpreadsheet} tint="#2f64a6" />
          <KpiCard label="Reimbursements (shown)" value={countKind("Reimbursement")} icon={ArrowLeftRight} tint="#3f9c8f" />
          <KpiCard label="Total Amount (shown)" value={pesoB(sum(rows))} icon={Landmark} tint="#6a4fb8" />
        </div>

        {pendingMode && (
          <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 16 }}>
            {ACCT_AGING.map((b) => (
              <KpiCard key={b.key} label={b.label} value={agingCount(b.key)} icon={b.key === "overdue" ? AlertTriangle : Clock} tint={b.tint}
                active={aging === b.key} onClick={() => setAging(aging === b.key ? ACCT_ALL_AGING : b.key)} />
            ))}
          </div>
        )}

        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />

        <div className="pcp-tabs" style={{ marginBottom: 14 }}>
          <button className={"pcp-tab" + (kind === "all" ? " active" : "")} onClick={() => setKind("all")}>All ({baseRows.length})</button>
          <button className={"pcp-tab" + (kind === "Liquidation" ? " active" : "")} onClick={() => setKind("Liquidation")}>
            Petty Cash Advance Liquidations ({countKind("Liquidation")})
          </button>
          <button className={"pcp-tab" + (kind === "Reimbursement" ? " active" : "")} onClick={() => setKind("Reimbursement")}>
            Employee Reimbursements ({countKind("Reimbursement")})
          </button>
        </div>

        <div className="pcp-filterbar" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 300 }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
            <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search no., requestor, custodian, particulars or batch"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="pcp-filter-label">Company</span>
          <select className="pcp-select" style={{ width: 190 }} value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="ALL">All companies</option>
            {companyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {pendingMode ? (
            <>
              <span className="pcp-filter-label">Aging</span>
              <select className="pcp-select" style={{ width: 210 }} value={aging} onChange={(e) => setAging(e.target.value)}>
                <option value={ACCT_ALL_AGING}>{ACCT_ALL_AGING}</option>
                {ACCT_AGING.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </>
          ) : (
            <>
              <span className="pcp-filter-label">Status</span>
              <select className="pcp-select" style={{ width: 210 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value={ACCT_ALL_STATUSES}>{ACCT_ALL_STATUSES}</option>
                {statusOptions.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </>
          )}
          <span className="pcp-filter-label">Transaction Date</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
          <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>to</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          {filtersOn && <button className="pcp-btn pcp-btn-sm" onClick={clearFilters}><X size={12} /> Clear</button>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="pcp-btn pcp-btn-sm" onClick={toggleAll} disabled={!rows.length}>
              <CircleCheck size={12} /> {allTicked ? "Deselect All" : `Select All (${rows.length})`}
            </button>
            {selectedRows.length > 0 && !allTicked && (
              <button className="pcp-btn pcp-btn-sm" onClick={() => setSelected([])}><X size={12} /> Clear selection</button>
            )}
            <button className="pcp-btn pcp-btn-sm" onClick={printPdf} disabled={!outRows.length}
              title="Print or save as PDF — the ticked rows, else every row shown">
              <Printer size={12} /> Generate PDF ({outLabel})
            </button>
            <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={exportExcel} disabled={!outRows.length}
              title="Export to Excel — the ticked rows, else every row shown">
              <FileSpreadsheet size={12} /> Export to Excel ({outLabel})
            </button>
          </div>
        </div>

        <div className="pcp-card">
          <StickyHScroll>
            <table className="pcp-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input type="checkbox" checked={allTicked} onChange={toggleAll} disabled={!rows.length} aria-label="Select all shown" />
                  </th>
                  <SortTh field="txnNo" sort={sort} cf={cf}>Transaction No.</SortTh>
                  <SortTh field="plant" sort={sort} cf={cf}>Company / Plant</SortTh>
                  <SortTh field="requestor" sort={sort} cf={cf}>Requestor</SortTh>
                  <SortTh field="custodian" sort={sort} cf={cf}>Custodian</SortTh>
                  <SortTh field="kind" sort={sort} cf={cf}>Type</SortTh>
                  <SortTh field="txnDate" sort={sort} cf={cf}>Transaction Date</SortTh>
                  <SortTh field="amount" sort={sort} cf={cf} align="right">Amount</SortTh>
                  <SortTh field="custodianAt" sort={sort} cf={cf}>Custodian Approval</SortTh>
                  {pendingMode
                    ? <SortTh field="aging" sort={sort} cf={cf}>Pending Aging</SortTh>
                    : <SortTh field="acctAt" sort={sort} cf={cf}>Accounting Approval</SortTh>}
                  <SortTh field="status" sort={sort} cf={cf}>Status</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r.key} className="pcp-liq-row" tabIndex={0}
                    onClick={() => open(r)} onKeyDown={(e) => { if (e.key === "Enter") open(r); }}
                    title={`Open ${r.txnNo || "this transaction"}`}
                    style={selected.includes(r.key) ? { background: "var(--brand-soft)" } : undefined}>
                    <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(r.key)} onChange={() => toggleRow(r.key)} aria-label={`Select ${r.txnNo || "row"}`} />
                    </td>
                    <td>
                      <strong>{r.txnNo || "—"}</strong>
                      {r.batchNo && <div style={mut}>{r.batchNo}</div>}
                      {r.escRevert && <div><span className="pcp-badge pcp-badge-red" style={{ whiteSpace: "nowrap" }} title={r.escRevert.reason || ""}>Reverted to {r.escRevert.to === "ACCOUNTING" ? "Accounting" : "Custodian"}</span></div>}
                    </td>
                    <td>
                      {rowPlantLabel(r)}
                      <div style={mut}>{r.company}{plantOfBranch(r.plantCode) !== r.plantCode ? ` · ${plantLabel(r.plantCode)}` : ""}</div>
                    </td>
                    <td>
                      {r.requestor || "—"}
                      {r.particulars && <div style={{ ...mut, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.particulars}>{r.particulars}</div>}
                    </td>
                    <td style={{ fontSize: 11.5 }}>{r.custodian || "—"}</td>
                    <td>{r.kind}</td>
                    <td>{r.txnDate ? fmtDate(r.txnDate) : "—"}</td>
                    <td className="pcp-num" style={{ textAlign: "right" }}>
                      {pesoB(r.amount)}
                      {r.cashAdvance != null && r.cashAdvance !== r.amount && <div style={mut}>Advance {pesoB(r.cashAdvance)}</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 11.5 }}>{fmtAcctModStamp(r.custodianAt)}</td>
                    {pendingMode ? (
                      <td><span className={"pcp-badge pcp-badge-" + r.aging.badge} style={{ whiteSpace: "nowrap" }}>{r.days} day{r.days === 1 ? "" : "s"} · {r.aging.short}</span></td>
                    ) : (
                      <td>
                        <div style={{ whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700, color: "#15803d" }}>{fmtAcctModStamp(r.acctAt)}</div>
                        {r.acctBy && <div style={mut}>{r.acctBy}</div>}
                        {r.acctRemarks && <div style={mut} title={r.acctRemarks}>"{r.acctRemarks}"</div>}
                      </td>
                    )}
                    <td><span className={"pcp-badge pcp-badge-" + (ACCT_STATUS_BADGE[r.status] || "gray")} style={{ whiteSpace: "nowrap" }}>{r.status}</span></td>
                    <td>
                      <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={(e) => { e.stopPropagation(); open(r); }}>
                        <Eye size={12} /> {pendingMode && canAct ? "Review" : "Open"}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={12} className="pcp-empty">
                    {allRows.length ? "No transaction matches these filters"
                      : pendingMode ? "Nothing is waiting for Accounting approval" : "Accounting has not approved any transaction yet"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </StickyHScroll>
        </div>
      </div>

      {openReimb && (
        <ReimbursementDetail
          reimb={openReimb}
          currentUser={currentUser}
          isChecker={false} isFinalApprover={false} canFinance={false} allowPayment={false} canRevert={false}
          accounting={reimbLive ? accounting : readOnlyAccounting}
          onAction={reimbLive ? (id, action, opts) => { onReimbursementAction(id, action, opts); setOpenRow(null); } : noop}
          onClose={() => setOpenRow(null)}
        />
      )}
    </div>
  );
}
