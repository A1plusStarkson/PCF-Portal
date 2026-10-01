/* ============================= APPROVED MODULE =============================
   A read-only monitoring view of every transaction that has received the
   FINAL approval (Grace Gan, or the System Superuser who holds the same
   authority) — Petty Cash Advance liquidations and Employee Reimbursements —
   filterable by plant (Manila / Warner / Disney / RG and Co. / All Plants),
   with Print / PDF and Export Excel that follow the filters.

   Who sees it: APPROVED_MODULE_EMAILS (11-liquidation.jsx) — Grace Gan, the
   System Superuser and Accounting. It offers NO action: nothing here writes to
   a record. It only reads review.finalBy / finalAt, which the final-approval
   handlers in 19-app.jsx stamp. Approvals from before the two-level workflow
   (legacy) have no final-approval stamp and are not listed.
--------------------------------------------------------------------------- */

const APPROVED_ALL_APPROVERS = "All approvers";

/* One row per final-approved transaction, both kinds in one shape. */
function approvedTransactions(disbursements, liquidations, reimbursements, replenishments) {
  const liqRepl = new Map();
  const reimbRepl = new Map();
  (replenishments || []).forEach((rp) => {
    (rp.liquidationIds || []).forEach((id) => liqRepl.set(id, rp));
    (rp.reimbursementIds || []).forEach((id) => reimbRepl.set(id, rp));
  });
  const replLabel = (rp) => (!rp ? "Not yet replenished"
    : `${rp.replenishmentNo || "—"} (${rp.status === "Completed" ? "Replenished" : "In Replenishment"})`);
  const rows = [];
  (disbursements || []).forEach((d) => {
    const liq = liquidationFor(d.id, liquidations || []);
    if (!liq || !liq.workflow) return;
    const rv = liqReview(liq);
    if (!rv.final || rv.legacy) return;
    const replIds = new Set(liqRepl.has(liq.id) ? [liq.id] : []);
    rows.push({
      key: "liq:" + d.id, kind: "Liquidation",
      txnNo: d.voucherNo || "", plantCode: d.branchCode, requestor: d.employee || "",
      purpose: d.purpose || disbExpense(d) || "",
      cashAdvance: Number(d.amount) || 0,
      amount: round2(receiptAmountSummary(liq).approvedTotal),
      txnDate: String(d.date || "").slice(0, 10),
      approvedAt: String(rv.finalAt || ""), approvedBy: rv.finalBy || "",
      finalRemarks: rv.finalRemarks || "",
      status: String(liqApprovalStage(d, liq, replIds) || ""),
      batchNo: rv.batchNo || "",
      custodianBy: custodianCheckerLabel(rv), acctBy: acctCheckerLabel(rv),
      replenishment: replLabel(liqRepl.get(liq.id)),
    });
  });
  (reimbursements || []).forEach((r) => {
    const rv = reimbReview(r);
    if (!rv.final) return;
    const replIds = new Set(reimbRepl.has(r.id) ? [r.id] : []);
    rows.push({
      key: "reimb:" + r.id, kind: "Reimbursement",
      txnNo: r.reimbNo || "", plantCode: r.branchCode, requestor: r.employee || "",
      purpose: r.purpose || "",
      cashAdvance: null,
      amount: round2(reimbTotal(r)),
      txnDate: String(r.requestDate || r.submittedAt || "").slice(0, 10),
      approvedAt: String(rv.finalAt || ""), approvedBy: rv.finalBy || "",
      finalRemarks: rv.finalRemarks || "",
      status: String(reimbApprovalStage(r, replIds) || r.status || ""),
      batchNo: rv.batchNo || "",
      custodianBy: custodianCheckerLabel(rv), acctBy: acctCheckerLabel(rv),
      replenishment: replLabel(reimbRepl.get(r.id)),
    });
  });
  return rows;
}

const fmtApprovedAt = (ts) => (ts ? `${fmtDate(ts.slice(0, 10))}${ts.length > 10 ? " " + ts.slice(11, 16) : ""}` : "—");

/* Report document for printReportDocument — grouped by plant with subtotals. */
function approvedModuleDoc(list, scopeLabel, generatedBy, scopeNote) {
  const col = (key, label, opt = {}) => ({ key, label, align: opt.align || (opt.money ? "right" : "left"), money: !!opt.money });
  const columns = [
    col("txnNo", "Transaction No."), col("branch", "Branch"), col("requestor", "Requestor"), col("kind", "Type"),
    col("txnDate", "Transaction Date"), col("approvedAt", "Approval Date"), col("approvedBy", "Approved By"),
    col("batchNo", "Batch No."), col("status", "Current Status"), col("amount", "Amount", { money: true }),
  ];
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
      txnNo: r.txnNo || "—", branch: plantLabel(r.plantCode), requestor: r.requestor || "—", kind: r.kind,
      txnDate: r.txnDate ? fmtDate(r.txnDate) : "—", approvedAt: fmtApprovedAt(r.approvedAt), approvedBy: r.approvedBy || "—",
      batchNo: r.batchNo || "—", status: r.status || "—", amount: r.amount,
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
    title: `Approved Transactions — ${scopeLabel}`, orientation: "landscape", columns, rows, totalsRow, count: list.length,
    meta: {
      "Plant": scopeLabel,
      "Company": company || "All Companies",
      "Covers": scopeNote,
      "Generated By": generatedBy || "System",
      "Date Generated": nowStamp(),
    },
    reference: makeReportRef("APPROVED"), watermark: false,
    company, logo: logoForCompany(company),
    reviewer: (profile && profile.reviewer) || DEFAULT_REVIEWER,
    approver: (profile && profile.approver) || DEFAULT_APPROVER,
    approverRole: (profile && profile.approverRole) || DEFAULT_APPROVER_ROLE,
  };
}

function ApprovedModuleTab({ disbursements, liquidations, reimbursements, replenishments, plantOptions, currentUser }) {
  const [plant, setPlant] = useState("ALL");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [approver, setApprover] = useState(APPROVED_ALL_APPROVERS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const sort = useTableSort("approvedAt", "desc");

  const allRows = useMemo(
    () => approvedTransactions(disbursements, liquidations, reimbursements, replenishments),
    [disbursements, liquidations, reimbursements, replenishments]
  );
  const approvers = useMemo(() => [...new Set(allRows.map((r) => r.approvedBy).filter(Boolean))].sort(), [allRows]);

  /* Plant tabs are plants; rows carry a branch — compare by the plant it rolls up to. */
  const inPlant = (r) => plant === "ALL" || plantOfBranch(r.plantCode) === plantOfBranch(plant);
  const rowPlantLabel = (r) => plantLabel(plantOfBranch(r.plantCode));
  const s = search.trim().toLowerCase();
  const approvalDay = (r) => r.approvedAt.slice(0, 10);
  const baseRows = allRows.filter((r) => inPlant(r)
    && (approver === APPROVED_ALL_APPROVERS || r.approvedBy === approver)
    && (!s || [r.txnNo, r.requestor, r.purpose, r.batchNo, plantLabel(r.plantCode), rowPlantLabel(r)]
      .some((f) => String(f || "").toLowerCase().includes(s)))
    && (!dateFrom || approvalDay(r) >= dateFrom)
    && (!dateTo || approvalDay(r) <= dateTo));
  const countKind = (k) => baseRows.filter((r) => r.kind === k).length;
  const rows = sort.sortRows(
    baseRows.filter((r) => kind === "all" || r.kind === kind),
    {
      txnNo: (r) => r.txnNo,
      plant: (r) => rowPlantLabel(r) + " " + plantLabel(r.plantCode),
      requestor: (r) => r.requestor,
      kind: (r) => r.kind,
      amount: (r) => r.amount,
      txnDate: (r) => r.txnDate,
      approvedAt: (r) => r.approvedAt,
      approvedBy: (r) => r.approvedBy,
      status: (r) => r.status,
    }
  );
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const filtersOn = plant !== "ALL" || kind !== "all" || !!s || approver !== APPROVED_ALL_APPROVERS || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setPlant("ALL"); setKind("all"); setSearch(""); setApprover(APPROVED_ALL_APPROVERS); setDateFrom(""); setDateTo("");
  };

  const scopeLabel = plant === "ALL" ? "All Plants" : plantLabel(plantOfBranch(plant));
  const scopeNote = () => [
    `${rows.length} transaction(s)`,
    kind === "all" ? "liquidations and reimbursements" : kind === "Liquidation" ? "Petty Cash Advance liquidations" : "Employee reimbursements",
    approver === APPROVED_ALL_APPROVERS ? "every final approver" : `approved by ${approver}`,
  ].concat(dateFrom || dateTo ? [`approved ${dateFrom ? fmtDate(dateFrom) : "…"} to ${dateTo ? fmtDate(dateTo) : "…"}`] : [])
    .concat(s ? [`search "${search.trim()}"`] : []).join(" · ");

  /* Both follow the filters: exactly the rows shown. Read-only. */
  const exportExcel = () => {
    if (!rows.length) { window.alert("There is nothing to export."); return; }
    const out = rows.map((r) => ({
      "Transaction No.": r.txnNo,
      "Plant": rowPlantLabel(r),
      "Branch": plantLabel(r.plantCode),
      "Requestor": r.requestor,
      "Transaction Type": r.kind,
      "Purpose": r.purpose,
      "Cash Advance": r.cashAdvance == null ? "" : r.cashAdvance,
      "Approved Amount": r.amount,
      "Transaction Date": r.txnDate,
      "Approval Date": r.approvedAt.replace("T", " ").slice(0, 16),
      "Approved By": r.approvedBy,
      "Final Approval Remarks": r.finalRemarks,
      "Current Status": r.status,
      "Batch No.": r.batchNo,
      "Custodian Approved By": r.custodianBy,
      "Accounting Checked By": r.acctBy,
      "Replenishment": r.replenishment,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), "Approved");
    const name = plant === "ALL" ? "All_Approved_Transactions"
      : `Approved_${scopeLabel.replace(/[^A-Za-z0-9]+/g, "_")}_Transactions`;
    downloadWorkbook(wb, `${name}_${todayISO()}.xlsx`);
  };
  const printPdf = () => {
    if (!rows.length) { window.alert("There is nothing to print."); return; }
    printReportDocument(approvedModuleDoc(rows, scopeLabel, currentUser, scopeNote()));
  };

  const mut = { fontSize: 10.5, color: "var(--text-mut)" };
  return (
    <div className="pcp-liq-full pcp-approval-page">
      <TopBar title="Approved Module" sub="View only — every transaction that has received Grace Gan's final approval, by plant." />
      <div className="pcp-content">
        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
          <KpiCard label={`Approved Transactions — ${scopeLabel}`} value={baseRows.length} icon={CircleCheck} tint="#15803d" />
          <KpiCard label="Approved Liquidations" value={countKind("Liquidation")} icon={FileSpreadsheet} tint="#15803d" />
          <KpiCard label="Approved Reimbursements" value={countKind("Reimbursement")} icon={ArrowLeftRight} tint="#15803d" />
          <KpiCard label="Total Approved Amount (shown)" value={peso(total)} icon={ShieldCheck} tint="#15803d" />
        </div>

        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />

        <div className="pcp-tabs" style={{ marginBottom: 14 }}>
          <button className={"pcp-tab" + (kind === "all" ? " active" : "")} onClick={() => setKind("all")}>All Approved ({baseRows.length})</button>
          <button className={"pcp-tab" + (kind === "Liquidation" ? " active" : "")} onClick={() => setKind("Liquidation")}>
            Petty Cash Advance Liquidations ({countKind("Liquidation")})
          </button>
          <button className={"pcp-tab" + (kind === "Reimbursement" ? " active" : "")} onClick={() => setKind("Reimbursement")}>
            Employee Reimbursements ({countKind("Reimbursement")})
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 300 }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
            <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search transaction no., requestor, purpose or batch"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Approved By</span>
          <select className="pcp-select" style={{ width: 170 }} value={approver} onChange={(e) => setApprover(e.target.value)}>
            {[APPROVED_ALL_APPROVERS].concat(approvers).map((a) => <option key={a}>{a}</option>)}
          </select>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Approval Date</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
          <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>to</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          {filtersOn && <button className="pcp-btn pcp-btn-sm" onClick={clearFilters}><X size={12} /> Clear</button>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="pcp-btn pcp-btn-sm" onClick={printPdf} disabled={!rows.length} title={`Print or save the ${rows.length} rows shown as PDF`}>
              <Printer size={12} /> Print as PDF ({rows.length})
            </button>
            <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={exportExcel} disabled={!rows.length} title={`Export the ${rows.length} rows shown to Excel`}>
              <FileSpreadsheet size={12} /> Export to Excel ({rows.length})
            </button>
          </div>
        </div>

        <div className="pcp-card">
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <SortTh field="txnNo" sort={sort}>Transaction No.</SortTh>
                  <SortTh field="plant" sort={sort}>Plant</SortTh>
                  <SortTh field="requestor" sort={sort}>Requestor</SortTh>
                  <SortTh field="kind" sort={sort}>Type</SortTh>
                  <SortTh field="amount" sort={sort} align="right">Amount</SortTh>
                  <SortTh field="txnDate" sort={sort}>Transaction Date</SortTh>
                  <SortTh field="approvedAt" sort={sort}>Approval Date</SortTh>
                  <SortTh field="approvedBy" sort={sort}>Approved By</SortTh>
                  <SortTh field="status" sort={sort}>Current Status</SortTh>
                  <th>Checked By</th>
                  <th>Replenishment</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <strong>{r.txnNo || "—"}</strong>
                      {r.batchNo && <div style={mut}>{r.batchNo}</div>}
                    </td>
                    <td>
                      {rowPlantLabel(r)}
                      {plantOfBranch(r.plantCode) !== r.plantCode && <div style={mut}>{plantLabel(r.plantCode)}</div>}
                    </td>
                    <td>
                      {r.requestor || "—"}
                      {r.purpose && <div style={{ ...mut, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.purpose}>{r.purpose}</div>}
                    </td>
                    <td>{r.kind}</td>
                    <td className="pcp-num" style={{ textAlign: "right" }}>
                      {peso(r.amount)}
                      {r.cashAdvance != null && r.cashAdvance !== r.amount && <div style={mut}>Advance {peso(r.cashAdvance)}</div>}
                    </td>
                    <td>{r.txnDate ? fmtDate(r.txnDate) : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtApprovedAt(r.approvedAt)}</td>
                    <td>
                      <strong>{r.approvedBy || "—"}</strong>
                      {r.finalRemarks && <div style={mut} title={r.finalRemarks}>"{r.finalRemarks}"</div>}
                    </td>
                    <td><Badge status={r.status} /></td>
                    <td style={{ fontSize: 11 }}>
                      {r.custodianBy && <div>Custodian: {r.custodianBy}</div>}
                      {r.acctBy && <div>Accounting: {r.acctBy}</div>}
                    </td>
                    <td style={{ fontSize: 11 }}>{r.replenishment}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={11} className="pcp-empty">
                    {allRows.length ? "No approved transaction matches these filters" : "No transaction has received final approval yet"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
