/* ============================= APPROVAL MODULE =============================
   One cross-plant workspace for checking and approving everything that needs a
   decision: Petty Cash Advance liquidations and Employee Reimbursements.

   Why it is not a per-plant tab: the approver (Grace Gan) signs off for every
   company, so splitting the queue by plant would mean opening four tabs to find
   out whether anything is waiting. This module deliberately spans ALL plants the
   signed-in user can see, and states how many items are waiting.

   It adds no new authority. Every action routes through the same handlers the
   Liquidation and Reimbursement modules use, so the existing rules still hold:
   only the authorized approver can decide a receipt or reject a liquidation, and
   nobody can approve their own reimbursement.
--------------------------------------------------------------------------- */

/* Petty cash advances that still need a decision, newest first. A voucher with
   no liquidation filed yet has nothing to check, so it stays out of the queue. */
function pcaApprovalQueue(disbursements, liquidations) {
  return (disbursements || [])
    .map((d) => {
      const liq = liquidationFor(d.id, liquidations);
      if (!liq) return null;
      const approval = receiptApprovalSummary(liq);
      const amounts = receiptAmountSummary(liq);
      return {
        disb: d,
        liq,
        approval,
        amounts,
        submissionStatus: liq.submissionStatus || "Draft",
        finalStatus: liqFinalStatus(d, liq),
        liqStatus: liqStatusFor(d, liquidations),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.disb.date || "").localeCompare(String(a.disb.date || "")));
}

/* The approver's view of where an advance stands. Distinct from liqFinalStatus,
   which answers "is the cash settled" — this answers "is a decision owed". */
const PCA_APPROVAL_STAGE = {
  AWAITING: "Awaiting Approval",
  PARTIAL: "Partially Approved",
  APPROVED: "Receipts Approved",
  REJECTED: "Rejected",
  COMPLETE: "Approved & Settled",
};
function pcaApprovalStage(row) {
  if (row.submissionStatus === "Rejected") return PCA_APPROVAL_STAGE.REJECTED;
  if (row.finalStatus === "LIQUIDATED") return PCA_APPROVAL_STAGE.COMPLETE;
  if (row.approval.anyRejected) return PCA_APPROVAL_STAGE.REJECTED;
  if (row.approval.allApproved) return PCA_APPROVAL_STAGE.APPROVED;
  if (row.approval.approved > 0) return PCA_APPROVAL_STAGE.PARTIAL;
  return PCA_APPROVAL_STAGE.AWAITING;
}
const PCA_APPROVAL_STAGES = ["All statuses"].concat(Object.keys(PCA_APPROVAL_STAGE).map((k) => PCA_APPROVAL_STAGE[k]));

/* Reimbursements are "waiting" from submission until they are paid/completed. */
const REIMB_APPROVAL_STAGES = () => ["All statuses"].concat(REIMB_OPEN_STATUSES, [
  REIMB_STATUS.PAID, REIMB_STATUS.COMPLETED, REIMB_STATUS.RETURNED, REIMB_STATUS.REJECTED,
]);

/* ---- Petty Cash Advance liquidation: check & approve panel ----
   Shows what the approver has to judge — the released amount, the expense
   lines, and every supporting document rendered inline with its own decision —
   and nothing they do not need. */
function PcaApprovalPanel({ row, canApprove, onDecideReceipt, onRejectLiquidation, onReopenLiquidation }) {
  const [remarks, setRemarks] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const { disb, liq, approval, amounts } = row;
  const rec = reconcileReceipts(disb.amount, amounts.approvedTotal);
  const stage = pcaApprovalStage(row);
  const rejections = liqRejections(liq);

  const decide = (att, decision) => {
    onDecideReceipt(disb.id, att.id, decision, remarks.trim());
    setRemarks("");
  };

  return (
    <div>
      <div className="pcp-liq-sticky">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="pcp-eyebrow">Petty Cash Advance · {disb.voucherNo}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{disb.employee}</div>
            <div style={{ fontSize: 12, color: "var(--text-mut)", marginTop: 2 }}>
              {subaccountLabel(disb.department)} · {plantLabel(disb.branchCode)} · {companyOfBranch(disb.branchCode)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7, flexWrap: "wrap" }}>
              <Badge status={stage} />
              <Badge status={row.finalStatus} />
              <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                Released {fmtDate(disb.date)}
                {liq.submittedBy ? ` · submitted by ${liq.submittedBy}` : ""}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canApprove && row.submissionStatus === "Submitted" && (
              <button className="pcp-btn pcp-btn-sm" onClick={() => onReopenLiquidation(disb.id, "Reopened from the Approval Module for correction")}>
                <RefreshCw size={12} /> Reopen for Correction
              </button>
            )}
            {canApprove && row.submissionStatus !== "Rejected" && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => setRejecting(true)}>
                <X size={12} /> Reject Liquidation
              </button>
            )}
          </div>
        </div>
        <div className="pcp-liq-sticky-grid" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Cash Released</div><div className="pcp-num">{peso(disb.amount)}</div></div>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Approved Receipts</div><div className="pcp-num">{peso(amounts.approvedTotal)}</div></div>
          <div className="pcp-liq-metric">
            <div className="pcp-kpi-label">{rec.type === "excess" ? "Refund Due" : rec.type === "reimburse" ? "Reimbursement Due" : "Variance"}</div>
            <div className="pcp-num" style={{ color: rec.type === "exact" ? "var(--green)" : "var(--brand)" }}>{peso(rec.expected)}</div>
          </div>
          <div className="pcp-liq-metric">
            <div className="pcp-kpi-label">Documents Decided</div>
            <div className="pcp-num">{approval.approved + approval.rejected} / {approval.total}</div>
          </div>
        </div>
      </div>

      {!canApprove && (
        <div className="pcp-hint" style={{ marginBottom: 12 }}>
          You can review everything here, but only {RECEIPT_APPROVER_NAME} is authorized to approve or
          reject a liquidation.
        </div>
      )}

      {!!rejections.length && (
        <div className="pcp-card pcp-card-pad" style={{ marginBottom: 12, borderColor: "#f0c0c0" }}>
          <div className="pcp-section-title" style={{ margin: "0 0 8px", color: "var(--brand)" }}>
            <AlertTriangle size={15} /> Rejection History ({rejections.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rejections.map((r) => (
              <div key={r.id} style={{ fontSize: 11.5, color: "var(--text-mut)" }}>
                {r.rejectedAt} · <b>{r.reason}</b> · by {r.rejectedBy}
                {r.comment ? ` · "${r.comment}"` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 12 }}>
        <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>Expense / Liquidation Details</div>
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead>
              <tr>
                <th>Date</th><th>Expense</th><th>Expense Category</th>
                <th>Department</th><th>Tax Category</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(liq.lines || []).length ? (liq.lines || []).map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.date)}</td>
                  <td>{l.expense || "—"}</td>
                  <td>{l.category}</td>
                  <td>{deptDesc(l.department)}</td>
                  <td title={taxCategoryLabel(l.taxCategory)}>{l.taxCategory || "—"}</td>
                  <td className="pcp-num">{peso(l.amount)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="pcp-empty">No expense lines captured yet</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: "right", fontWeight: 600 }}>Total Liquidated</td>
                <td className="pcp-num" style={{ fontWeight: 700 }}>{peso(liquidatedTotal(liq))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="pcp-card pcp-card-pad">
        <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>
          <Receipt size={15} color="#c8102e" /> Supporting Documents ({approval.total})
        </div>
        {canApprove && (
          <div className="pcp-field">
            <label>Decision Remarks <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(optional — recorded against the next decision)</span></label>
            <input
              className="pcp-input" value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. OR is legible and the amount agrees"
            />
          </div>
        )}
        {/* Each receipt is legible in place, with its decision on the same tile. */}
        <AttachmentGallery
          attachments={liq.attachments}
          emptyLabel="No supporting documents were uploaded for this liquidation."
          renderFooter={(a) => {
            const status = a.approvalStatus || "Pending";
            return (
              <div style={{ padding: "7px 9px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge status={status} />
                  <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                    {a.receiptNo ? `${a.receiptNo} · ` : ""}{docRequiresAmount(a) ? peso(receiptAmountOf(a)) : "no amount"}
                  </span>
                  {canApprove && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                      <button
                        className="pcp-btn pcp-btn-sm pcp-btn-primary" title="Approve this document"
                        disabled={status === "Approved"} onClick={() => decide(a, "Approved")}
                      ><Check size={12} /></button>
                      <button
                        className="pcp-btn pcp-btn-sm pcp-btn-danger" title="Reject this document"
                        disabled={status === "Rejected"} onClick={() => decide(a, "Rejected")}
                      ><X size={12} /></button>
                    </span>
                  )}
                </div>
                {!!(a.approvalHistory || []).length && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                    {a.approvalHistory[a.approvalHistory.length - 1].status} by{" "}
                    {a.approvalHistory[a.approvalHistory.length - 1].approver} ·{" "}
                    {a.approvalHistory[a.approvalHistory.length - 1].ts}
                    {a.approvalHistory[a.approvalHistory.length - 1].remarks
                      ? ` · "${a.approvalHistory[a.approvalHistory.length - 1].remarks}"` : ""}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      {rejecting && (
        <RejectLiquidationModal
          voucherNo={disb.voucherNo}
          employee={disb.employee}
          onClose={() => setRejecting(false)}
          onConfirm={(payload) => { onRejectLiquidation(disb.id, payload); setRejecting(false); }}
        />
      )}
    </div>
  );
}

function ApprovalModuleTab({
  disbursements, liquidations, reimbursements,
  onDecideReceipt, onRejectLiquidation, onReopenLiquidation,
  onReimbursementAction, onExportReimbursementAcumatica,
  canApproveLiquidation, canApproveReimbursement, canFinance,
  currentUser, plantOptions,
}) {
  const [source, setSource] = useState("pettycash");
  const [plant, setPlant] = useState("ALL");
  const [search, setSearch] = useState("");
  const [pcaStage, setPcaStage] = useState("All statuses");
  const [reimbStage, setReimbStage] = useState("All statuses");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reimbSortDir, setReimbSortDir] = useState("desc");

  const inPlant = (code) => plant === "ALL" || code === plant;
  const matches = (...fields) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return fields.some((f) => String(f || "").toLowerCase().includes(s));
  };

  /* ---- Petty Cash Advance liquidations ---- */
  const pcaAll = useMemo(
    () => pcaApprovalQueue(disbursements, liquidations),
    [disbursements, liquidations]
  );
  const pcaRows = pcaAll.filter((r) => inPlant(r.disb.branchCode)
    && matches(r.disb.voucherNo, r.disb.employee, r.disb.branchCode)
    && (pcaStage === "All statuses" || pcaApprovalStage(r) === pcaStage));
  const selected = pcaRows.find((r) => r.disb.id === selectedId) || pcaRows[0] || null;
  const pcaWaiting = pcaAll.filter((r) => {
    const s = pcaApprovalStage(r);
    return s === PCA_APPROVAL_STAGE.AWAITING || s === PCA_APPROVAL_STAGE.PARTIAL;
  }).length;

  /* ---- Employee reimbursements ---- */
  const reimbAll = useMemo(
    () => (reimbursements || []).slice().sort((a, b) => String(b.requestDate || "").localeCompare(String(a.requestDate || ""))),
    [reimbursements]
  );
  /* Newest reimbursement no. first by default; the header flips to ascending. */
  const reimbRows = reimbAll.filter((r) => inPlant(r.branchCode)
    && r.status !== REIMB_STATUS.DRAFT
    && matches(r.reimbNo, r.employee, r.branchCode, r.purpose)
    && (reimbStage === "All statuses" || r.status === reimbStage))
    .sort((a, b) => {
      const cmp = String(a.reimbNo || "").localeCompare(String(b.reimbNo || ""), undefined, { numeric: true });
      return reimbSortDir === "asc" ? cmp : -cmp;
    });
  const reimbWaiting = reimbAll.filter((r) => r.status === REIMB_STATUS.SUBMITTED
    || r.status === REIMB_STATUS.FOR_REVIEW || r.status === REIMB_STATUS.FOR_APPROVAL).length;

  const stageOptions = source === "pettycash" ? PCA_APPROVAL_STAGES : REIMB_APPROVAL_STAGES();

  return (
    <div className="pcp-liq-full">
      <TopBar
        title="Approval Module"
        sub="Check and approve Petty Cash Advance liquidations and Employee Reimbursements across every plant"
      />
      <div className="pcp-content">
        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
          <KpiCard label="Advances Awaiting Approval" value={pcaWaiting} icon={FileSpreadsheet} tint="#b9790a" />
          <KpiCard label="Reimbursements Awaiting Approval" value={reimbWaiting} icon={ArrowLeftRight} tint="#2054a3" />
          <KpiCard label="Advance Liquidations Filed" value={pcaAll.length} icon={Receipt} tint="#7c3aed" />
          <KpiCard label="Reimbursements Submitted" value={reimbAll.length} icon={ClipboardList} tint="#15803d" />
        </div>

        <PlantScopeTabs plants={plantOptions} value={plant} onChange={(v) => { setPlant(v); setSelectedId(null); }} />

        <div className="pcp-tabs" style={{ marginBottom: 14 }}>
          <button className={"pcp-tab" + (source === "pettycash" ? " active" : "")} onClick={() => setSource("pettycash")}>
            Petty Cash Advance Liquidations ({pcaRows.length})
          </button>
          <button className={"pcp-tab" + (source === "reimbursement" ? " active" : "")} onClick={() => setSource("reimbursement")}>
            Employee Reimbursements ({reimbRows.length})
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
            <input
              className="pcp-input" style={{ paddingLeft: 28 }}
              placeholder={source === "pettycash" ? "Search voucher, employee or branch" : "Search reimbursement no., employee or purpose"}
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterIcon size={14} color="var(--text-mut)" />
          <SearchSelect
            value={source === "pettycash" ? pcaStage : reimbStage}
            onChange={(v) => {
              if (source === "pettycash") setPcaStage(v || "All statuses");
              else setReimbStage(v || "All statuses");
              setSelectedId(null);
            }}
            options={stageOptions.map((s) => ({ value: s, label: s }))}
            searchPlaceholder="Search status…"
            style={{ width: 240 }}
          />
        </div>

        {source === "pettycash" ? (
          <div className="pcp-liq-workspace">
            <div className="pcp-card pcp-card-pad">
              <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>Liquidations</div>
              {pcaRows.length ? pcaRows.map((r) => (
                <div
                  key={r.disb.id}
                  className={"pcp-voucher-card" + (selected && selected.disb.id === r.disb.id ? " active" : "")}
                  onClick={() => setSelectedId(r.disb.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 12.5 }}>{r.disb.voucherNo}</strong>
                    <span className="pcp-num" style={{ fontSize: 12.5, fontWeight: 700 }}>{peso(r.disb.amount)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginTop: 2 }}>
                    {r.disb.employee} · {plantLabel(r.disb.branchCode)}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <Badge status={pcaApprovalStage(r)} />
                    <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                      {r.approval.approved + r.approval.rejected}/{r.approval.total} docs decided
                    </span>
                  </div>
                </div>
              )) : <div className="pcp-empty">Nothing to approve here</div>}
            </div>
            {selected ? (
              <PcaApprovalPanel
                key={selected.disb.id}
                row={selected}
                canApprove={canApproveLiquidation}
                onDecideReceipt={onDecideReceipt}
                onRejectLiquidation={onRejectLiquidation}
                onReopenLiquidation={onReopenLiquidation}
              />
            ) : (
              <div className="pcp-card pcp-card-pad"><div className="pcp-empty">Select a liquidation to check and approve</div></div>
            )}
          </div>
        ) : (
          <div className="pcp-card">
            <div className="pcp-table-wrap">
              <table className="pcp-table">
                <thead>
                  <tr>
                    <th className="pcp-sortable" onClick={() => setReimbSortDir((d) => (d === "asc" ? "desc" : "asc"))} title="Sort by reimbursement no.">
                      Reimb No.<span className="pcp-sort-ind">{reimbSortDir === "asc" ? "▲" : "▼"}</span>
                    </th>
                    <th>Req Date</th><th>Employee</th><th>Department</th><th>Plant</th>
                    <th>Purpose</th><th>Docs</th><th>Amount</th><th>Compliance</th><th>Status</th><th>Aging</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {reimbRows.length ? reimbRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.reimbNo}</td>
                      <td>{fmtDate(r.requestDate)}</td>
                      <td>{r.employee}</td>
                      <td title={subaccountLabel(r.department)}>{deptDesc(r.department)}</td>
                      <td>{plantLabel(r.branchCode)}</td>
                      <td title={r.purpose || ""} style={{ maxWidth: 220, whiteSpace: "normal" }}>
                        {r.purpose
                          ? <span>{purposeCategory(r.purpose) && <span className="pcp-badge pcp-badge-gray" style={{ marginRight: 6 }}>{purposeCategory(r.purpose)}</span>}{r.purpose}</span>
                          : <span style={{ color: "var(--text-mut)" }}>&mdash;</span>}
                      </td>
                      <td>{(r.attachments || []).length}</td>
                      <td className="pcp-num">{peso(reimbTotal(r))}</td>
                      <td><CompliancePill level={(r.compliance && r.compliance.level) || "PASS"} /></td>
                      <td><Badge status={r.status} /></td>
                      <td>{reimbAgingBucket(r)}</td>
                      <td>
                        <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => setDetail(r)} title="Check documents and decide">
                          <Eye size={12} /> Review
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={12} className="pcp-empty">Nothing to approve here</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <ReimbursementDetail
          reimb={(reimbursements || []).find((x) => x.id === detail.id) || detail}
          currentUser={currentUser}
          canApprove={canApproveReimbursement}
          canFinance={canFinance}
          onExportAcumatica={onExportReimbursementAcumatica}
          onAction={(id, action, opts) => { onReimbursementAction(id, action, opts); setDetail(null); }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
