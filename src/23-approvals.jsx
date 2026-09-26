/* ============================= APPROVAL MODULE =============================
   One cross-plant workspace for checking and approving everything that needs a
   decision: Petty Cash Advance liquidations and Employee Reimbursements.

   Petty cash liquidations go through TWO levels (see 11-liquidation.jsx):
     1. Custodian review — every Custodian, Accounting and Finance account and
        the System Superuser, within its plant scope: decide each receipt,
        approve the liquidation, settle the cash.
     1b. Accounting check — Accounting reviews it, assigns a Batch Number and
        marks it checked (For Accounting Check). Until then it is not in the
        final approver's queue, which is grouped and approvable by batch.
     2. Final approval — Grace Gan or the System Superuser. Grace Gan's queue
        holds ONLY liquidations a custodian has approved and whose cash is
        settled; their approval makes them Fully Approved / Ready for
        Replenishment. Nobody final-approves what they approved as custodian.

   Employee reimbursements go through the same two levels with the same
   people (22-reimbursement.jsx): custodian approval → FOR FINAL APPROVAL →
   final approval → FULLY APPROVED / READY FOR REPLENISHMENT. The final
   approver's reimbursement queue likewise holds only custodian-approved ones.

   Why it is not a per-plant tab: approvers sign off across plants, so splitting
   the queue by plant would mean opening four tabs to find out whether anything
   is waiting. Plant scoping still applies — a custodian only ever sees their
   own plants' liquidations.

   It adds no new authority. Every action routes through the same handlers the
   Liquidation and Reimbursement modules use, and each handler re-checks who is
   calling it.
--------------------------------------------------------------------------- */

/* Stages the final approver's queue is limited to: custodian-approved, cash
   settled, and what she has already approved (for reference). */
const FINAL_APPROVER_STAGES = [LIQ_STAGE.FOR_FINAL, LIQ_STAGE.READY, LIQ_STAGE.REPLENISHED];

/* Employee reimbursements follow the same two levels (22-reimbursement.jsx).
   The final approver's queue is likewise limited to what custodians have
   approved. Built on demand from REIMB_STATUS/REIMB_STAGE. */
const reimbFinalApproverStages = () => [REIMB_STATUS.FOR_FINAL, REIMB_STATUS.READY, REIMB_STAGE.REPLENISHED];
const reimbCheckerStages = () => [
  REIMB_STAGE.FOR_CHECK, REIMB_STAGE.FOR_ACCOUNTING, REIMB_STATUS.FOR_FINAL, REIMB_STATUS.READY, REIMB_STAGE.REPLENISHED,
  REIMB_STATUS.RETURNED, REIMB_STATUS.REJECTED,
  /* Legacy single-level chain, still visible for records already in it. */
  REIMB_STATUS.FOR_LIQUIDATION, REIMB_STATUS.UNDER_REVIEW, REIMB_STATUS.LIQUIDATION_DONE,
  REIMB_STATUS.FOR_PAYMENT, REIMB_STATUS.PAID, REIMB_STATUS.COMPLETED,
];

/* Submitted petty cash liquidations, newest first. A voucher with no
   liquidation, or one still in Draft, has nothing to decide yet. */
function pcaApprovalQueue(disbursements, liquidations, replenishments) {
  const replenishedIds = replenishedLiquidationIds(replenishments);
  return (disbursements || [])
    .map((d) => {
      const liq = liquidationFor(d.id, liquidations);
      if (!liq) return null;
      const stage = liqApprovalStage(d, liq, replenishedIds);
      if (stage === LIQ_STAGE.DRAFT) return null;
      return {
        disb: d,
        liq,
        stage,
        review: liqReview(liq),
        approval: receiptApprovalSummary(liq),
        amounts: receiptAmountSummary(liq),
        settlement: settlementStateFor(d, liq),
        submissionStatus: liq.submissionStatus || "Draft",
        finalStatus: liqFinalStatus(d, liq),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.disb.date || "").localeCompare(String(a.disb.date || "")));
}

/* ---- Petty Cash Advance liquidation: check & approve panel ----
   Shows what the approver has to judge — the released amount, the expense
   lines, the cash settlement and every supporting document rendered inline —
   with only the actions this viewer's level allows. */
function PcaApprovalPanel({
  row, isChecker, isFinalApprover, currentUser, accounting,
  onDecideReceipt, onRejectLiquidation, onReopenLiquidation, onCheckLiquidation, onFinalApprove,
}) {
  const [remarks, setRemarks] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const { disb, liq, approval, amounts, review, settlement: st, stage } = row;
  const rec = reconcileReceipts(disb.amount, amounts.approvedTotal);
  const rejections = liqRejections(liq);
  const submitted = row.submissionStatus === "Submitted";
  const finalLocked = review.final && !review.legacy;

  const canDecide = isChecker && submitted && !finalLocked;
  const canCheck = isChecker && stage === LIQ_STAGE.FOR_CHECK && approval.allApproved && amounts.complete;
  /* Never the custodian who approved it — two levels, two people. */
  const checkedBySelf = review.checked
    && String(review.checkedBy).toLowerCase() === String(currentUser || "").toLowerCase();
  const canFinal = isFinalApprover && stage === LIQ_STAGE.FOR_FINAL && !checkedBySelf;
  const canReject = !finalLocked && ((isChecker && submitted) || canFinal);

  const decide = (att, decision) => {
    if (decision === "Rejected" && !remarks.trim()) {
      window.alert("Enter the reason in Decision Remarks before rejecting a receipt.");
      return;
    }
    onDecideReceipt(disb.id, att.id, decision, remarks.trim());
    setRemarks("");
  };
  const check = () => {
    if (!window.confirm(`Approve the liquidation for ${disb.voucherNo} as custodian?\n\nApproved receipts: ${peso(amounts.approvedTotal)} against ${peso(disb.amount)} released.`)) return;
    onCheckLiquidation(disb.id, remarks.trim());
    setRemarks("");
  };
  const finalApprove = () => {
    if (!passesAccountingGate(review)) { window.alert(ACCOUNTING_GATE_MESSAGE); return; }
    if (!window.confirm(`Give final approval to ${disb.voucherNo}?\n\nApproved receipts: ${peso(amounts.approvedTotal)} · custodian approved by ${review.checkedBy} · Accounting checked, batch ${review.batchNo}.\n\nIt becomes Fully Approved / Ready for Replenishment and can no longer be edited.`)) return;
    onFinalApprove(disb.id, remarks.trim());
    setRemarks("");
  };

  /* What the viewer is waiting on, in one sentence. */
  const guidance = (() => {
    if (stage === LIQ_STAGE.FOR_CHECK) {
      if (!isChecker) return "Awaiting the custodian's review.";
      if (!amounts.complete) return "Some documents have no receipt amount — reject the liquidation so the requestor can complete it.";
      if (!approval.allApproved) return `Decide each receipt below (${approval.pending} pending), then approve the liquidation.`;
      return "Every receipt is approved — approve the liquidation to send it on for final approval once the cash is settled.";
    }
    if (stage === LIQ_STAGE.NEEDS_CORRECTION) return isChecker
      ? "A receipt was rejected. Reject the liquidation to return it to the requestor for correction."
      : "A receipt was rejected; the liquidation is being returned for correction.";
    if (stage === LIQ_STAGE.FOR_ACCOUNTING) return accounting && accounting.isChecker
      ? "Custodian approved — review the details and every document below, assign a Batch Number and mark it checked."
      : "Custodian approved — awaiting Accounting's check and Batch Number before final approval.";
    if (stage === LIQ_STAGE.AWAITING_SETTLEMENT) return `Custodian approved and checked by Accounting (batch ${review.batchNo}). The ${rec.type === "excess" ? "refund" : "reimbursement"} of ${peso(st.expected)} must be settled in the Liquidation module before it goes to ${FINAL_APPROVER_NAME}.`;
    if (stage === LIQ_STAGE.FOR_FINAL) return !isFinalApprover
      ? `Awaiting final approval by ${FINAL_APPROVER_NAME}.`
      : checkedBySelf
        ? "You approved this as custodian, so the final approval must come from the other final approver."
        : `Custodian approved, checked by Accounting (batch ${review.batchNo}) and cash settled — ready for your final approval.`;
    if (stage === LIQ_STAGE.READY) return "Fully approved — available in the Replenishment module.";
    if (stage === LIQ_STAGE.REPLENISHED) return "Fully approved and included in a replenishment.";
    if (stage === LIQ_STAGE.LEGACY) return "Approved under the previous single-level process.";
    if (stage === LIQ_STAGE.REJECTED) return "Returned to the requestor for correction.";
    return "";
  })();

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
            {!review.legacy && (review.checked || review.final) && (
              <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5, lineHeight: 1.5 }}>
                {review.checked && <div>Custodian approved by <b>{review.checkedBy}</b> · {review.checkedAt.replace("T", " ")}{review.checkRemarks ? ` · "${review.checkRemarks}"` : ""}</div>}
                {review.acctChecked && <div>Accounting checked by <b>{review.acctCheckedBy}</b> · {fmtAcctStamp(review.acctCheckedAt)} · batch <b>{review.batchNo}</b></div>}
                {review.final && <div>Final approval by <b>{review.finalBy}</b> · {review.finalAt.replace("T", " ")}{review.finalRemarks ? ` · "${review.finalRemarks}"` : ""}</div>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canCheck && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={check}>
                <ShieldCheck size={12} /> Custodian Approve
              </button>
            )}
            {canFinal && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={finalApprove}>
                <ShieldCheck size={12} /> Final Approve
              </button>
            )}
            {isChecker && submitted && !finalLocked && (
              <button className="pcp-btn pcp-btn-sm" onClick={() => onReopenLiquidation(disb.id, "Reopened from the Approval Module for correction")}>
                <RefreshCw size={12} /> Reopen for Correction
              </button>
            )}
            {canReject && (
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
            <div className="pcp-kpi-label">Cash Settlement</div>
            <div><Badge status={st.settled ? "SETTLED" : "UNSETTLED"} /></div>
          </div>
          <div className="pcp-liq-metric">
            <div className="pcp-kpi-label">Documents Decided</div>
            <div className="pcp-num">{approval.approved + approval.rejected} / {approval.total}</div>
          </div>
        </div>
      </div>

      {guidance && <div className="pcp-hint" style={{ marginBottom: 12 }}>{guidance}</div>}

      {(review.checked || review.legacy) && (
        <AccountingReviewBox
          kind="liq" id={disb.id} refNo={disb.voucherNo} review={review}
          mode={liqAcctMode(liq)} accounting={accounting}
        />
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
        {st.entries.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-mut)" }}>
            <b>Cash settlement:</b> {st.entries.map((e) => `${peso(e.amount)} on ${e.date || "—"} by ${e.recordedBy || "—"}`).join(" · ")}
            {st.closed ? ` · shortage of ${peso(st.closure.shortageAmount)} closed by ${st.closure.closedBy}` : ""}
          </div>
        )}
      </div>

      <div className="pcp-card pcp-card-pad">
        <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>
          <Receipt size={15} color="#c8102e" /> Supporting Documents ({approval.total})
        </div>
        {(canDecide || canCheck || canFinal || canReject) && (
          <div className="pcp-field">
            <label>Decision Remarks <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(recorded against the next decision · required to reject a receipt)</span></label>
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
            const last = (a.approvalHistory || [])[(a.approvalHistory || []).length - 1];
            return (
              <div style={{ padding: "7px 9px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge status={status} />
                  <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                    {a.receiptNo ? `${a.receiptNo} · ` : ""}{docRequiresAmount(a) ? peso(receiptAmountOf(a)) : "no amount"}
                  </span>
                  {canDecide && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                      <button
                        className="pcp-btn pcp-btn-sm pcp-btn-primary" title="Approve this document"
                        disabled={status === "Approved"} onClick={() => decide(a, "Approved")}
                      ><Check size={12} /></button>
                      <button
                        className="pcp-btn pcp-btn-sm pcp-btn-danger" title="Reject this document (enter the reason in Decision Remarks)"
                        disabled={status === "Rejected"} onClick={() => decide(a, "Rejected")}
                      ><X size={12} /></button>
                    </span>
                  )}
                </div>
                {last && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                    {last.status} by {last.approver} · {last.ts}{last.remarks ? ` · "${last.remarks}"` : ""}
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
  disbursements, liquidations, replenishments, reimbursements,
  onDecideReceipt, onRejectLiquidation, onReopenLiquidation, onCheckLiquidation, onFinalApprove,
  onReimbursementAction, onExportReimbursementAcumatica,
  isChecker, isFinalApprover, canFinance,
  currentUser, plantOptions, accounting,
}) {
  const isAcct = !!(accounting && accounting.isChecker);
  /* Grace Gan: final approval only, so her queues hold only what custodians
     have approved. The System Superuser is BOTH a checker and a final
     approver. By the owner's instruction she sees everything Grace Gan sees,
     opened the same way (For Final Approval, same KPIs), with the custodian
     queue added one filter away. */
  const finalOnly = isFinalApprover && !isChecker;
  const [source, setSource] = useState("pettycash");
  const [plant, setPlant] = useState("ALL");
  const [search, setSearch] = useState("");
  /* Open on the viewer's own work: every final approver on what awaits final
     approval, custodians on what awaits their review. */
  const [pcaStage, setPcaStage] = useState(
    isFinalApprover ? LIQ_STAGE.FOR_FINAL : isAcct ? LIQ_STAGE.FOR_ACCOUNTING : isChecker ? LIQ_STAGE.FOR_CHECK : "All statuses"
  );
  const [reimbStage, setReimbStage] = useState(
    isFinalApprover ? REIMB_STATUS.FOR_FINAL : isAcct ? REIMB_STAGE.FOR_ACCOUNTING : isChecker ? REIMB_STAGE.FOR_CHECK : "All statuses"
  );
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  /* Batch Number filter — how Grace Gan reviews: one Accounting batch at a time. */
  const ALL_BATCHES = "All batches";
  const [batch, setBatch] = useState(ALL_BATCHES);
  const inBatch = (b) => batch === ALL_BATCHES || b === batch;
  /* Newest reimbursement no. first on open; any header can take over. */
  const reimbSort = useTableSort("reimbNo", "desc");

  const inPlant = (code) => plant === "ALL" || code === plant;
  const matches = (...fields) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return fields.some((f) => String(f || "").toLowerCase().includes(s));
  };

  /* ---- Petty Cash Advance liquidations ---- */
  /* The final approver's queue holds ONLY what custodians have approved and
     whose cash is settled — nothing earlier in the chain reaches her. */
  const pcaAll = useMemo(() => {
    const all = pcaApprovalQueue(disbursements, liquidations, replenishments);
    return finalOnly ? all.filter((r) => FINAL_APPROVER_STAGES.includes(r.stage)) : all;
  }, [disbursements, liquidations, replenishments, finalOnly]);
  const pcaRows = pcaAll.filter((r) => inPlant(r.disb.branchCode)
    && matches(r.disb.voucherNo, r.disb.employee, r.disb.branchCode, r.review.batchNo)
    && inBatch(r.review.batchNo)
    && (pcaStage === "All statuses" || r.stage === pcaStage));
  const selected = pcaRows.find((r) => r.disb.id === selectedId) || pcaRows[0] || null;
  const pcaStageOptions = ["All statuses"].concat(finalOnly
    ? FINAL_APPROVER_STAGES
    : [LIQ_STAGE.FOR_CHECK, LIQ_STAGE.NEEDS_CORRECTION, LIQ_STAGE.FOR_ACCOUNTING, LIQ_STAGE.AWAITING_SETTLEMENT, LIQ_STAGE.FOR_FINAL,
       LIQ_STAGE.READY, LIQ_STAGE.REPLENISHED, LIQ_STAGE.REJECTED, LIQ_STAGE.LEGACY]);
  const countStage = (s) => pcaAll.filter((r) => r.stage === s).length;
  const pcaForCheck = countStage(LIQ_STAGE.FOR_CHECK) + countStage(LIQ_STAGE.NEEDS_CORRECTION);
  const pcaForFinal = countStage(LIQ_STAGE.FOR_FINAL);
  const pcaForAcct = countStage(LIQ_STAGE.FOR_ACCOUNTING);
  const pcaReady = countStage(LIQ_STAGE.READY);

  /* ---- Employee reimbursements ----
     Each row carries its approval stage. As with liquidations, the final
     approver's queue holds ONLY what a custodian has already approved. */
  const reimbAll = useMemo(() => {
    const replenishedIds = replenishedReimbursementIds(replenishments);
    const finalStages = reimbFinalApproverStages();
    return (reimbursements || [])
      .filter((r) => r.status !== REIMB_STATUS.DRAFT)
      .map((r) => ({ ...r, stage: reimbApprovalStage(r, replenishedIds), batchNo: reimbReview(r).batchNo }))
      .filter((r) => !finalOnly || finalStages.includes(r.stage))
      .sort((a, b) => String(b.requestDate || "").localeCompare(String(a.requestDate || "")));
  }, [reimbursements, replenishments, finalOnly]);
  const reimbRows = reimbSort.sortRows(
    reimbAll.filter((r) => inPlant(r.branchCode)
      && matches(r.reimbNo, r.employee, r.branchCode, r.purpose, r.batchNo)
      && inBatch(r.batchNo)
      && (reimbStage === "All statuses" || r.stage === reimbStage)),
    { ...REIMB_SORT_FIELDS, status: (r) => r.stage, batchNo: (r) => r.batchNo }
  );
  const reimbForCheck = reimbAll.filter((r) => r.stage === REIMB_STAGE.FOR_CHECK).length;
  const reimbForFinal = reimbAll.filter((r) => r.stage === REIMB_STATUS.FOR_FINAL).length;
  const reimbForAcct = reimbAll.filter((r) => r.stage === REIMB_STAGE.FOR_ACCOUNTING).length;

  /* ---- Batches ----
     Every batch in the viewer's queues, and — for the final approver — what in
     each is awaiting final approval now. Only transactions that passed the
     Accounting gate ever reach FOR_FINAL, and it is re-checked here and again
     in each handler, so a batch can never carry an unchecked transaction into
     her approval. */
  const batchNos = Array.from(new Set(pcaAll.map((r) => r.review.batchNo)
    .concat(reimbAll.map((r) => r.batchNo)).filter(Boolean))).sort().reverse();
  const me = String(currentUser || "").trim().toLowerCase();
  const batchPending = (b) => {
    const pca = pcaAll.filter((r) => r.review.batchNo === b && inPlant(r.disb.branchCode)
      && r.stage === LIQ_STAGE.FOR_FINAL && passesAccountingGate(r.review)
      && String(r.review.checkedBy).toLowerCase() !== me);
    const reimb = reimbAll.filter((r) => r.batchNo === b && inPlant(r.branchCode)
      && r.stage === REIMB_STATUS.FOR_FINAL && passesAccountingGate(reimbReview(r))
      && reimbReview(r).checkedBy.toLowerCase() !== me
      && ![r.createdBy, r.employee].some((n) => (n || "").trim().toLowerCase() === me));
    const total = pca.reduce((t, r) => t + r.amounts.approvedTotal, 0) + reimb.reduce((t, r) => t + reimbTotal(r), 0);
    return { pca, reimb, count: pca.length + reimb.length, total };
  };
  const batchesAwaiting = isFinalApprover
    ? batchNos.map((b) => ({ batchNo: b, ...batchPending(b) })).filter((x) => x.count > 0) : [];
  const approveBatch = (b) => {
    const x = batchPending(b);
    if (!x.count) return;
    if (!window.confirm(`Give final approval to the whole of ${b}?\n\n`
      + x.pca.map((r) => `  ${r.disb.voucherNo} · Liquidation · ${peso(r.amounts.approvedTotal)}`)
        .concat(x.reimb.map((r) => `  ${r.reimbNo} · Reimbursement · ${peso(reimbTotal(r))}`)).join("\n")
      + `\n\n${x.count} transaction(s) · ${peso(x.total)}. Each becomes Fully Approved / Ready for Replenishment.`)) return;
    x.pca.forEach((r) => onFinalApprove(r.disb.id, `Batch ${b} final approval`));
    x.reimb.forEach((r) => onReimbursementAction(r.id, "final-approve", { comments: `Batch ${b} final approval` }));
  };

  const stageOptions = source === "pettycash"
    ? pcaStageOptions
    : ["All statuses"].concat(finalOnly ? reimbFinalApproverStages() : reimbCheckerStages());

  return (
    <div className="pcp-liq-full">
      <TopBar
        title="Approval Module"
        sub={finalOnly
          ? "Final approval of custodian-approved liquidations and employee reimbursements"
          : isFinalApprover
            ? "Final approval of custodian-approved liquidations and employee reimbursements — plus custodian review (choose For Custodian Review in the status filter)"
            : "Review and approve Petty Cash Advance liquidations and Employee Reimbursements for your plants"}
      />
      <div className="pcp-content">
        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
          {isFinalApprover && (
            <>
              <KpiCard label="Liquidations Awaiting Your Final Approval" value={pcaForFinal} icon={ShieldCheck} tint="#b9790a" />
              <KpiCard label="Reimbursements Awaiting Your Final Approval" value={reimbForFinal} icon={ArrowLeftRight} tint="#b9790a" />
            </>
          )}
          {isAcct && (
            <>
              <KpiCard label="Liquidations Awaiting Accounting Check" value={pcaForAcct} icon={ShieldCheck} tint="#b9790a" />
              <KpiCard label="Reimbursements Awaiting Accounting Check" value={reimbForAcct} icon={ArrowLeftRight} tint="#b9790a" />
            </>
          )}
          {isChecker && (
            <>
              <KpiCard label="Liquidations Awaiting Custodian Review" value={pcaForCheck} icon={FileSpreadsheet} tint="#b9790a" />
              <KpiCard label="Reimbursements Awaiting Custodian Review" value={reimbForCheck} icon={ArrowLeftRight} tint="#2054a3" />
              {!isFinalApprover && <KpiCard label="Awaiting Final Approval" value={pcaForFinal + reimbForFinal} icon={ShieldCheck} tint="#7c3aed" />}
            </>
          )}
          <KpiCard label="Liquidations Ready for Replenishment" value={pcaReady} icon={RefreshCw} tint="#15803d" />
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
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Batch</span>
          <select className="pcp-select" style={{ width: 170 }} value={batch}
            onChange={(e) => { setBatch(e.target.value); setSelectedId(null); }}>
            {[ALL_BATCHES].concat(batchNos).map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>

        {/* Batches awaiting final approval: review a batch, then approve it whole. */}
        {batchesAwaiting.length > 0 && (
          <div className="pcp-card pcp-card-pad" style={{ marginBottom: 14 }}>
            <div className="pcp-section-title" style={{ margin: "0 0 8px" }}><ShieldCheck size={15} /> Batches Awaiting Your Final Approval</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {batchesAwaiting.map((x) => (
                <div key={x.batchNo} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                  <strong style={{ minWidth: 110 }}>{x.batchNo}</strong>
                  <span style={{ color: "var(--text-mut)" }}>
                    {x.pca.length} liquidation(s) · {x.reimb.length} reimbursement(s) · <span className="pcp-num">{peso(x.total)}</span>
                  </span>
                  <button className="pcp-btn pcp-btn-sm" onClick={() => { setBatch(x.batchNo); setSelectedId(null); }}>
                    <Eye size={12} /> Review Batch
                  </button>
                  {batch === x.batchNo && (
                    <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => approveBatch(x.batchNo)}>
                      <ShieldCheck size={12} /> Final Approve {x.batchNo} ({x.count})
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <Badge status={r.stage} />
                    {r.review.batchNo && <span className="pcp-badge pcp-badge-gray">{r.review.batchNo}</span>}
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
                isChecker={isChecker}
                isFinalApprover={isFinalApprover}
                currentUser={currentUser}
                accounting={accounting}
                onDecideReceipt={onDecideReceipt}
                onRejectLiquidation={onRejectLiquidation}
                onReopenLiquidation={onReopenLiquidation}
                onCheckLiquidation={onCheckLiquidation}
                onFinalApprove={onFinalApprove}
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
                    <SortTh field="reimbNo" sort={reimbSort}>Reimb No.</SortTh>
                    <SortTh field="requestDate" sort={reimbSort}>Req Date</SortTh>
                    <SortTh field="employee" sort={reimbSort}>Employee</SortTh>
                    <SortTh field="department" sort={reimbSort}>Department</SortTh>
                    <SortTh field="branchCode" sort={reimbSort}>Plant</SortTh>
                    <SortTh field="purpose" sort={reimbSort}>Purpose</SortTh>
                    <SortTh field="docs" sort={reimbSort}>Docs</SortTh>
                    <SortTh field="amount" sort={reimbSort}>Amount</SortTh>
                    <SortTh field="compliance" sort={reimbSort}>Compliance</SortTh>
                    <SortTh field="status" sort={reimbSort}>Status</SortTh>
                    <SortTh field="batchNo" sort={reimbSort}>Batch No.</SortTh>
                    <SortTh field="aging" sort={reimbSort}>Aging</SortTh>
                    <th></th>
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
                      <td><Badge status={r.stage} /></td>
                      <td>{r.batchNo || <span style={{ color: "var(--text-mut)" }}>—</span>}</td>
                      <td>{reimbAgingBucket(r)}</td>
                      <td>
                        <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => setDetail(r)} title="Check documents and decide">
                          <Eye size={12} /> Review
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={13} className="pcp-empty">Nothing to approve here</td></tr>}
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
          isChecker={isChecker}
          isFinalApprover={isFinalApprover}
          canFinance={canFinance}
          accounting={accounting}
          onExportAcumatica={onExportReimbursementAcumatica}
          onAction={(id, action, opts) => { onReimbursementAction(id, action, opts); setDetail(null); }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
