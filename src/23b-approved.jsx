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
const APPROVED_ALL_BATCHES = "All batches";

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
  /* Batch Number filter — the batches offered follow the plant tab. */
  const [batch, setBatch] = useState(APPROVED_ALL_BATCHES);
  const [batchQuery, setBatchQuery] = useState("");
  /* Ticked rows (keys). Only rows still shown count, so a filter change can
     never print or export a hidden row. Selection never touches a record. */
  const [selected, setSelected] = useState([]);
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
  /* Batches in the selected plant, newest number first, with their counts;
     narrowed by the batch search box. */
  const plantBatches = useMemo(() => {
    const counts = new Map();
    allRows.filter(inPlant).forEach((r) => { if (r.batchNo) counts.set(r.batchNo, (counts.get(r.batchNo) || 0) + 1); });
    return [...counts].sort((a, b) => b[0].localeCompare(a[0])).map(([batchNo, count]) => ({ batchNo, count }));
  }, [allRows, plant]); // eslint-disable-line
  const bq = batchQuery.trim().toLowerCase();
  const batchChoices = plantBatches.filter((b) => !bq || b.batchNo.toLowerCase().includes(bq) || b.batchNo === batch);
  /* A batch with nothing in the newly picked plant is let go. */
  useEffect(() => {
    if (batch !== APPROVED_ALL_BATCHES && !plantBatches.some((b) => b.batchNo === batch)) setBatch(APPROVED_ALL_BATCHES);
  }, [plantBatches]); // eslint-disable-line
  const baseRows = allRows.filter((r) => inPlant(r)
    && (batch === APPROVED_ALL_BATCHES || r.batchNo === batch)
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
  const filtersOn = plant !== "ALL" || kind !== "all" || !!s || approver !== APPROVED_ALL_APPROVERS || !!dateFrom || !!dateTo
    || batch !== APPROVED_ALL_BATCHES || !!batchQuery;
  const clearFilters = () => {
    setPlant("ALL"); setKind("all"); setSearch(""); setApprover(APPROVED_ALL_APPROVERS); setDateFrom(""); setDateTo("");
    setBatch(APPROVED_ALL_BATCHES); setBatchQuery("");
  };

  /* ---- Select ---- */
  const selectedRows = rows.filter((r) => selected.includes(r.key));
  const allTicked = rows.length > 0 && selectedRows.length === rows.length;
  const toggleRow = (key) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const toggleAll = () => setSelected(allTicked ? [] : rows.map((r) => r.key));
  /* What Print / Export take: the ticked rows, else every row shown. */
  const outRows = selectedRows.length ? selectedRows : rows;
  const outLabel = selectedRows.length ? `${selectedRows.length} selected` : `all ${rows.length} shown`;

  const scopeLabel = plant === "ALL" ? "All Plants" : plantLabel(plantOfBranch(plant));
  const scopeNote = () => [
    selectedRows.length ? `${selectedRows.length} selected transaction(s)` : `${rows.length} transaction(s)`,
  ].concat(batch !== APPROVED_ALL_BATCHES ? [`Batch ${batch}`] : []).concat([
    kind === "all" ? "liquidations and reimbursements" : kind === "Liquidation" ? "Petty Cash Advance liquidations" : "Employee reimbursements",
    approver === APPROVED_ALL_APPROVERS ? "every final approver" : `approved by ${approver}`,
  ]).concat(dateFrom || dateTo ? [`approved ${dateFrom ? fmtDate(dateFrom) : "…"} to ${dateTo ? fmtDate(dateTo) : "…"}`] : [])
    .concat(s ? [`search "${search.trim()}"`] : []).join(" · ");

  /* Both take the ticked rows, else exactly the rows shown. Read-only. */
  const exportExcel = () => {
    if (!outRows.length) { window.alert("There is nothing to export."); return; }
    const out = outRows.map((r) => ({
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
    const name = (plant === "ALL" ? "All_Approved_Transactions"
      : `Approved_${scopeLabel.replace(/[^A-Za-z0-9]+/g, "_")}_Transactions`)
      + (batch !== APPROVED_ALL_BATCHES ? `_${batch.replace(/[^A-Za-z0-9-]+/g, "_")}` : "")
      + (selectedRows.length ? "_Selected" : "");
    downloadWorkbook(wb, `${name}_${todayISO()}.xlsx`);
  };
  const printPdf = () => {
    if (!outRows.length) { window.alert("There is nothing to print."); return; }
    const label = scopeLabel + (batch !== APPROVED_ALL_BATCHES ? ` · ${batch}` : "");
    printReportDocument(approvedModuleDoc(outRows, label, currentUser, scopeNote()));
  };

  const mut = { fontSize: 10.5, color: "var(--text-mut)" };
  return (
    <div className="pcp-liq-full pcp-approval-page">
      <TopBar title="Approved Module" sub="View only — every transaction that has received Grace Gan's final approval, by plant." />
      <div className="pcp-content">
        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
          <KpiCard label={`Approved Transactions — ${scopeLabel}${batch !== APPROVED_ALL_BATCHES ? ` · ${batch}` : ""}`} value={baseRows.length} icon={CircleCheck} tint="#15803d" />
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
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Batch</span>
          <input className="pcp-input" style={{ width: 120 }} placeholder="Find batch…" value={batchQuery}
            onChange={(e) => setBatchQuery(e.target.value)} title="Type to narrow the batch list" />
          <select className="pcp-select" style={{ width: 190 }} value={batch} onChange={(e) => setBatch(e.target.value)}
            title={`Batches in ${scopeLabel}`}>
            <option value={APPROVED_ALL_BATCHES}>{APPROVED_ALL_BATCHES} ({plantBatches.length})</option>
            {batchChoices.map((b) => <option key={b.batchNo} value={b.batchNo}>{b.batchNo} · {b.count} txn</option>)}
          </select>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Approved By</span>
          <select className="pcp-select" style={{ width: 170 }} value={approver} onChange={(e) => setApprover(e.target.value)}>
            {[APPROVED_ALL_APPROVERS].concat(approvers).map((a) => <option key={a}>{a}</option>)}
          </select>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Approval Date</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
          <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>to</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          {filtersOn && <button className="pcp-btn pcp-btn-sm" onClick={clearFilters}><X size={12} /> Clear</button>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="pcp-btn pcp-btn-sm" onClick={toggleAll} disabled={!rows.length}
              title={allTicked ? "Untick every row shown" : "Tick every row shown"}>
              <CircleCheck size={12} /> {allTicked ? "Deselect All" : `Select All (${rows.length})`}
            </button>
            {selectedRows.length > 0 && !allTicked && (
              <button className="pcp-btn pcp-btn-sm" onClick={() => setSelected([])} title="Untick every row">
                <X size={12} /> Clear selection
              </button>
            )}
            <button className="pcp-btn pcp-btn-sm" onClick={printPdf} disabled={!outRows.length}
              title={selectedRows.length ? "Print or save the ticked rows as PDF" : "Print or save every row shown as PDF (tick rows to print only those)"}>
              <Printer size={12} /> Print as PDF ({outLabel})
            </button>
            <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={exportExcel} disabled={!outRows.length}
              title={selectedRows.length ? "Export the ticked rows to Excel" : "Export every row shown to Excel (tick rows to export only those)"}>
              <FileSpreadsheet size={12} /> Export to Excel ({outLabel})
            </button>
          </div>
        </div>

        <div className="pcp-card">
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input type="checkbox" checked={allTicked} onChange={toggleAll} disabled={!rows.length}
                      title="Select all shown" aria-label="Select all shown" />
                  </th>
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
                  <tr key={r.key} style={selected.includes(r.key) ? { background: "var(--brand-soft)" } : undefined}>
                    <td>
                      <input type="checkbox" checked={selected.includes(r.key)} onChange={() => toggleRow(r.key)}
                        aria-label={`Select ${r.txnNo || "row"}`} />
                    </td>
                    <td>
                      <strong>{r.txnNo || "—"}</strong>
                      {r.batchNo && (
                        <div>
                          <button type="button" className="pcp-linkbtn" onClick={() => setBatch(r.batchNo)} title={`Show only ${r.batchNo}`}
                            style={{ ...mut, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline dotted" }}>
                            {r.batchNo}
                          </button>
                        </div>
                      )}
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
                  <tr><td colSpan={12} className="pcp-empty">
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
