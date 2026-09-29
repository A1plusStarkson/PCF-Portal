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
   is waiting. Plant scoping still applies to each viewer's own plants.

   Who sees it: only Grace Gan, the System Superuser and Accounting
   (APPROVAL_MODULE_EMAILS in 11-liquidation.jsx). Custodians review in the
   Liquidation and Reimbursement modules.

   Layout: one sortable, filterable list of what is pending on the viewer.
   Clicking a row opens the whole transaction (documents, Accounting review,
   custodian approval) with its approve / reject actions.

   It adds no new authority. Every action routes through the same handlers the
   Liquidation and Reimbursement modules use, and each handler re-checks who is
   calling it.
--------------------------------------------------------------------------- */

/* The queue is a LIST of what is pending on THIS viewer, across both kinds of
   transaction. What is "pending" follows the viewer's level:
     custodian-level checker → For Custodian Review / Needs Correction
     Accounting              → For Accounting Check
     final approver          → For Final Approval, except what they approved
                               as custodian (or, for a reimbursement, their own)
   Liquidation stages are title case and reimbursement stages upper case, but
   the shared ones read the same once upper-cased, so the status filter matches
   on that. Anything no longer pending stays in the Liquidation and
   Reimbursement modules. */
const APPROVAL_ALL_PENDING = "All pending";
const approvalStageKey = (stage) => String(stage || "").toUpperCase();

function approvalPendingStages({ isChecker, isAcct, isFinalApprover }) {
  const out = [];
  if (isChecker) out.push(LIQ_STAGE.FOR_CHECK, LIQ_STAGE.NEEDS_CORRECTION);
  if (isAcct) out.push(LIQ_STAGE.FOR_ACCOUNTING);
  if (isFinalApprover) out.push(LIQ_STAGE.FOR_FINAL);
  return out;
}

/* What the viewer does next with a pending row, for the Action column. */
const APPROVAL_ACTION_LABEL = {
  [approvalStageKey(LIQ_STAGE.FOR_CHECK)]: "Custodian review",
  [approvalStageKey(LIQ_STAGE.NEEDS_CORRECTION)]: "Return for correction",
  [approvalStageKey(LIQ_STAGE.FOR_ACCOUNTING)]: "Accounting check & batch no.",
  [approvalStageKey(LIQ_STAGE.FOR_FINAL)]: "Final approval",
};

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
  canRevert, onRevertLiquidation,
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
            {canRevert && onRevertLiquidation && submitted && !finalLocked && (
              <button
                className="pcp-btn pcp-btn-sm"
                onClick={() => { const why = askRevertReason(disb.voucherNo); if (why) onRevertLiquidation(disb.id, why); }}
                title="Send back to the requestor as FOR SUBMISSION — they correct / add attachments and resubmit"
              >
                <ArrowLeftRight size={12} /> Revert to Requestor
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
            <div className="pcp-num" style={{ color: rec.type === "exact" ? "var(--green)" : "var(--danger)" }}>{peso(rec.expected)}</div>
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
          <div className="pcp-section-title" style={{ margin: "0 0 8px", color: "var(--danger)" }}>
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
          <Receipt size={15} color="#4e7d63" /> Supporting Documents ({approval.total})
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
          large="xl"
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
  currentUser, plantOptions, accounting, onOpenReplenishment,
  canEditReimb, onUpdateReimbursement, reimbPlantOptions,
  canRevert, onRevertLiquidation, canSelectExport,
}) {
  /* Reimbursement open in the edit form (REIMB_EDIT_OVERRIDE_EMAILS only). */
  const [editingReimb, setEditingReimb] = useState(null);
  const isAcct = !!(accounting && accounting.isChecker);
  const me = String(currentUser || "").trim().toLowerCase();
  const [plant, setPlant] = useState("ALL");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(APPROVAL_ALL_PENDING);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /* Batch Number filter — how Grace Gan reviews: one Accounting batch at a time. */
  const ALL_BATCHES = "All batches";
  const [batch, setBatch] = useState(ALL_BATCHES);
  /* The KPI card last clicked: narrows the queue to exactly what that card
     counts (one kind, one or more stages). Click it again to clear. */
  const [cardFilter, setCardFilter] = useState(null);
  const queueRef = useRef(null);
  /* The open transaction: a liquidation opens in place of the list, a
     reimbursement in its usual detail window. */
  const [openLiqId, setOpenLiqId] = useState(null);
  const [detail, setDetail] = useState(null);
  const sort = useTableSort("date", "desc");

  /* ---- Every submitted transaction, with its approval stage ---- */
  const pcaAll = useMemo(
    () => pcaApprovalQueue(disbursements, liquidations, replenishments),
    [disbursements, liquidations, replenishments]
  );
  const reimbAll = useMemo(() => {
    const replenishedIds = replenishedReimbursementIds(replenishments);
    return (reimbursements || [])
      .filter((r) => r.status !== REIMB_STATUS.DRAFT)
      .map((r) => ({ ...r, stage: reimbApprovalStage(r, replenishedIds), rv: reimbReview(r) }));
  }, [reimbursements, replenishments]);

  /* ---- Pending on this viewer ---- */
  const pendingStages = approvalPendingStages({ isChecker, isAcct, isFinalApprover });
  const pendingKeys = pendingStages.map(approvalStageKey);
  const isPendingFor = (stage, review, own) => {
    const k = approvalStageKey(stage);
    if (!pendingKeys.includes(k)) return false;
    /* Two levels, two people: whoever gave the custodian approval (or owns the
       reimbursement) is not asked for the final one. */
    if (k === approvalStageKey(LIQ_STAGE.FOR_FINAL)) {
      if (String(review.checkedBy || "").toLowerCase() === me || own) return false;
      if (!passesAccountingGate(review)) return false;
    }
    return true;
  };

  /* One row shape for both kinds, so the list sorts and filters as one. */
  const allRows = useMemo(() => {
    const liqRows = pcaAll.map((r) => ({
      key: "liq:" + r.disb.id,
      kind: "Liquidation",
      id: r.disb.id,
      seriesNo: r.disb.voucherNo || "",
      plantCode: r.disb.branchCode,
      requestor: r.disb.employee || "",
      amount: liquidatedTotal(r.liq),
      date: String(r.liq.submittedAt || r.disb.date || "").slice(0, 10),
      stage: r.stage,
      batchNo: r.review.batchNo || "",
      pending: isPendingFor(r.stage, r.review, false),
      src: r,
    }));
    const reimbRows = reimbAll.map((r) => ({
      key: "reimb:" + r.id,
      kind: "Reimbursement",
      id: r.id,
      seriesNo: r.reimbNo || "",
      plantCode: r.branchCode,
      requestor: r.employee || "",
      amount: reimbTotal(r),
      date: String(r.submittedAt || r.requestDate || "").slice(0, 10),
      stage: r.stage,
      batchNo: r.rv.batchNo || "",
      pending: isPendingFor(r.stage, r.rv, [r.createdBy, r.employee].some((n) => (n || "").trim().toLowerCase() === me)),
      src: r,
    }));
    return liqRows.concat(reimbRows);
  }, [pcaAll, reimbAll, isChecker, isAcct, isFinalApprover, me]); // eslint-disable-line

  /* A series number belongs to one transaction. The database refuses a second
     holder (supabase-series-guard.sql); should one ever show up anyway, it is
     flagged on the row rather than passing unnoticed. */
  const dupSeries = useMemo(() => {
    const seen = new Map();
    allRows.forEach((r) => {
      const n = r.seriesNo.trim().toUpperCase();
      if (n) seen.set(n, (seen.get(n) || 0) + 1);
    });
    return new Set([...seen].filter(([, c]) => c > 1).map(([n]) => n));
  }, [allRows]);

  const pendingAll = allRows.filter((r) => r.pending);
  /* The plant tabs are PLANTS (Manila, Warner, Disney, RG and Co.) while each
     row carries its own BRANCH code. Compare by the plant the branch rolls up
     to, so Manila includes Hasbro, Perulandia, Mattel, Eurasia and Sitio
     (PLANT_FAMILIES) — an exact code match only ever found Manila's own
     A1+ rows. Display only; no record is changed. */
  const inPlant = (r) => plant === "ALL" || plantOfBranch(r.plantCode) === plantOfBranch(plant);
  const rowPlantLabel = (r) => plantLabel(plantOfBranch(r.plantCode));
  const s = search.trim().toLowerCase();
  const baseRows = pendingAll.filter((r) => inPlant(r)
    && (!s || [r.seriesNo, r.requestor, plantLabel(r.plantCode), rowPlantLabel(r), r.batchNo].some((f) => String(f || "").toLowerCase().includes(s)))
    && (stageFilter === APPROVAL_ALL_PENDING || approvalStageKey(r.stage) === approvalStageKey(stageFilter))
    && (!cardFilter || cardFilter.stages.some((st) => approvalStageKey(r.stage) === approvalStageKey(st)))
    && (batch === ALL_BATCHES || r.batchNo === batch)
    && (!dateFrom || r.date >= dateFrom)
    && (!dateTo || r.date <= dateTo));
  const countKind = (k) => baseRows.filter((r) => r.kind === k).length;
  const rows = sort.sortRows(
    baseRows.filter((r) => kind === "all" || r.kind === kind),
    {
      seriesNo: (r) => r.seriesNo,
      plant: (r) => rowPlantLabel(r) + " " + plantLabel(r.plantCode),
      requestor: (r) => r.requestor,
      kind: (r) => r.kind,
      amount: (r) => r.amount,
      date: (r) => r.date,
      status: (r) => approvalStageKey(r.stage),
      action: (r) => APPROVAL_ACTION_LABEL[approvalStageKey(r.stage)] || "",
    }
  );
  const filtersOn = plant !== "ALL" || kind !== "all" || !!s || stageFilter !== APPROVAL_ALL_PENDING
    || batch !== ALL_BATCHES || !!dateFrom || !!dateTo || !!cardFilter;
  const clearFilters = () => {
    setPlant("ALL"); setKind("all"); setSearch(""); setStageFilter(APPROVAL_ALL_PENDING);
    setBatch(ALL_BATCHES); setDateFrom(""); setDateTo(""); setCardFilter(null);
  };
  /* ---- Select + Export Excel (APPROVAL_EXPORT_EMAILS in 19-app.jsx) ----
     Tick rows to export just those; with nothing ticked the export takes every
     row currently shown. Selection only counts rows still visible, so a filter
     change can never export a hidden row. Read-only: nothing is changed. */
  const [selected, setSelected] = useState([]);
  const visibleKeys = rows.map((r) => r.key);
  const selectedRows = rows.filter((r) => selected.includes(r.key));
  const allTicked = rows.length > 0 && selectedRows.length === rows.length;
  const toggleRow = (key) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const toggleAll = () => setSelected(allTicked ? [] : visibleKeys);
  const exportApprovals = () => {
    const list = selectedRows.length ? selectedRows : rows;
    if (!list.length) { window.alert("There is nothing to export."); return; }
    const out = list.map((r) => ({
      "Series No.": r.seriesNo || "",
      "Batch No.": r.batchNo || "",
      "Date": r.date || "",
      "Plant": rowPlantLabel(r),
      "Branch": plantLabel(r.plantCode),
      "Requestor": r.requestor || "",
      "Transaction Type": r.kind,
      "Amount": Number(r.amount) || 0,
      "Current Status": String(r.stage || ""),
      "Action": APPROVAL_ACTION_LABEL[approvalStageKey(r.stage)] || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), "Approval Module");
    const scope = plant === "ALL" ? "All_Plants" : plantLabel(plantOfBranch(plant)).replace(/[^A-Za-z0-9]+/g, "_");
    downloadWorkbook(wb, `Approval_Module_${scope}_${todayISO()}.xlsx`);
  };

  /* KPI card click: show that card's transactions in the queue below. */
  const pickCard = (id, k, stages) => {
    if (cardFilter && cardFilter.id === id) { setCardFilter(null); setKind("all"); return; }
    setCardFilter({ id, stages });
    setKind(k);
    setStageFilter(APPROVAL_ALL_PENDING);
    setTimeout(() => { if (queueRef.current) queueRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, 0);
  };
  const cardProps = (id, k, stages) => ({
    onClick: () => pickCard(id, k, stages),
    active: !!cardFilter && cardFilter.id === id,
  });

  /* ---- KPIs ---- */
  const countPending = (k, stage) => pendingAll.filter((r) => r.kind === k && approvalStageKey(r.stage) === approvalStageKey(stage)).length;
  const pcaReady = pcaAll.filter((r) => r.stage === LIQ_STAGE.READY).length;

  /* ---- Batches ----
     Every batch among the pending rows, and — for the final approver — what in
     each is awaiting final approval now. Only transactions that passed the
     Accounting gate count as pending final approval, and it is re-checked again
     in each handler, so a batch can never carry an unchecked transaction into
     her approval. */
  const batchNos = Array.from(new Set(pendingAll.map((r) => r.batchNo).filter(Boolean))).sort().reverse();
  const batchPending = (b) => {
    const inB = pendingAll.filter((r) => r.batchNo === b && inPlant(r)
      && approvalStageKey(r.stage) === approvalStageKey(LIQ_STAGE.FOR_FINAL));
    const pca = inB.filter((r) => r.kind === "Liquidation");
    const reimb = inB.filter((r) => r.kind === "Reimbursement");
    const total = pca.reduce((t, r) => t + r.src.amounts.approvedTotal, 0) + reimb.reduce((t, r) => t + r.amount, 0);
    return { pca, reimb, count: inB.length, total };
  };
  const batchesAwaiting = isFinalApprover
    ? batchNos.map((b) => ({ batchNo: b, ...batchPending(b) })).filter((x) => x.count > 0) : [];
  const approveBatch = (b) => {
    const x = batchPending(b);
    if (!x.count) return;
    if (!window.confirm(`Give final approval to the whole of ${b}?\n\n`
      + x.pca.map((r) => `  ${r.seriesNo} · Liquidation · ${peso(r.src.amounts.approvedTotal)}`)
        .concat(x.reimb.map((r) => `  ${r.seriesNo} · Reimbursement · ${peso(r.amount)}`)).join("\n")
      + `\n\n${x.count} transaction(s) · ${peso(x.total)}. Each becomes Fully Approved / Ready for Replenishment.`)) return;
    x.pca.forEach((r) => onFinalApprove(r.id, `Batch ${b} final approval`));
    x.reimb.forEach((r) => onReimbursementAction(r.id, "final-approve", { comments: `Batch ${b} final approval` }));
  };

  const openRow = (r) => {
    if (r.kind === "Liquidation") setOpenLiqId(r.id);
    else setDetail(r.src);
  };

  /* ---- An open liquidation: its complete details in place of the list ----
     Looked up in every stage, not just pending, so it stays on screen showing
     its new stage straight after the viewer decides it. */
  const openLiq = openLiqId ? pcaAll.find((r) => r.disb.id === openLiqId) : null;
  if (openLiq) {
    return (
      <div className="pcp-liq-full pcp-approval-page">
        <TopBar title="Approval Module" sub={`Liquidation ${openLiq.disb.voucherNo} · ${openLiq.disb.employee}`} />
        <div className="pcp-content">
          <button className="pcp-btn pcp-btn-sm" style={{ marginBottom: 12 }} onClick={() => setOpenLiqId(null)}>
            <ChevronLeft size={12} /> Back to Approval Queue
          </button>
          <PcaApprovalPanel
            key={openLiq.disb.id}
            row={openLiq}
            isChecker={isChecker}
            isFinalApprover={isFinalApprover}
            currentUser={currentUser}
            accounting={accounting}
            onDecideReceipt={onDecideReceipt}
            onRejectLiquidation={onRejectLiquidation}
            onReopenLiquidation={onReopenLiquidation}
            onCheckLiquidation={onCheckLiquidation}
            onFinalApprove={onFinalApprove}
            canRevert={canRevert}
            onRevertLiquidation={onRevertLiquidation}
          />
        </div>
      </div>
    );
  }

  const statusOptions = [APPROVAL_ALL_PENDING].concat(pendingStages);

  return (
    <div className="pcp-liq-full pcp-approval-page">
      <TopBar
        title="Approval Module"
        sub="Everything awaiting your decision, across all plants. Click a transaction to open it."
      />
      <div className="pcp-content">
        <div className="pcp-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
          {isFinalApprover && (
            <>
              <KpiCard label="Liquidations Awaiting Your Final Approval" {...cardProps("liq-final", "Liquidation", [LIQ_STAGE.FOR_FINAL])} value={countPending("Liquidation", LIQ_STAGE.FOR_FINAL)} icon={ShieldCheck} tint="#b9790a" />
              <KpiCard label="Reimbursements Awaiting Your Final Approval" {...cardProps("reimb-final", "Reimbursement", [LIQ_STAGE.FOR_FINAL])} value={countPending("Reimbursement", LIQ_STAGE.FOR_FINAL)} icon={ArrowLeftRight} tint="#b9790a" />
            </>
          )}
          {isAcct && (
            <>
              <KpiCard label="Liquidations Awaiting Accounting Check" {...cardProps("liq-acct", "Liquidation", [LIQ_STAGE.FOR_ACCOUNTING])} value={countPending("Liquidation", LIQ_STAGE.FOR_ACCOUNTING)} icon={ShieldCheck} tint="#b9790a" />
              <KpiCard label="Reimbursements Awaiting Accounting Check" {...cardProps("reimb-acct", "Reimbursement", [LIQ_STAGE.FOR_ACCOUNTING])} value={countPending("Reimbursement", LIQ_STAGE.FOR_ACCOUNTING)} icon={ArrowLeftRight} tint="#b9790a" />
            </>
          )}
          {isChecker && (
            <>
              <KpiCard label="Liquidations Awaiting Custodian Review" {...cardProps("liq-check", "Liquidation", [LIQ_STAGE.FOR_CHECK, LIQ_STAGE.NEEDS_CORRECTION])} value={countPending("Liquidation", LIQ_STAGE.FOR_CHECK) + countPending("Liquidation", LIQ_STAGE.NEEDS_CORRECTION)} icon={FileSpreadsheet} tint="#b9790a" />
              <KpiCard label="Reimbursements Awaiting Custodian Review" {...cardProps("reimb-check", "Reimbursement", [LIQ_STAGE.FOR_CHECK])} value={countPending("Reimbursement", LIQ_STAGE.FOR_CHECK)} icon={ArrowLeftRight} tint="#2054a3" />
            </>
          )}
          <KpiCard label="Liquidations Ready for Replenishment" value={pcaReady} onClick={onOpenReplenishment} icon={RefreshCw} tint="#15803d" />
        </div>

        <div ref={queueRef} />
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={setPlant} />

        <div className="pcp-tabs" style={{ marginBottom: 14 }}>
          <button className={"pcp-tab" + (kind === "all" ? " active" : "")} onClick={() => setKind("all")}>
            All Pending ({baseRows.length})
          </button>
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
            <input
              className="pcp-input" style={{ paddingLeft: 28 }}
              placeholder="Search series no., requestor, plant or batch"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterIcon size={14} color="var(--text-mut)" />
          <select className="pcp-select" style={{ width: 200 }} value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setCardFilter(null); }}>
            {statusOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Batch</span>
          <select className="pcp-select" style={{ width: 150 }} value={batch} onChange={(e) => setBatch(e.target.value)}>
            {[ALL_BATCHES].concat(batchNos).map((b) => <option key={b}>{b}</option>)}
          </select>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Date</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
          <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>to</span>
          <input type="date" className="pcp-input" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          {filtersOn && <button className="pcp-btn pcp-btn-sm" onClick={clearFilters}><X size={12} /> Clear</button>}
          {canSelectExport && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {selectedRows.length > 0 && (
                <button className="pcp-btn pcp-btn-sm" onClick={() => setSelected([])} title="Clear the selection">
                  <X size={12} /> Clear selection
                </button>
              )}
              <button
                className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={exportApprovals} disabled={!rows.length}
                title={selectedRows.length ? "Export the ticked rows to Excel" : "Export every row shown to Excel (tick rows to export only those)"}
              >
                <FileSpreadsheet size={12} /> Export Excel ({selectedRows.length ? `${selectedRows.length} selected` : `all ${rows.length} shown`})
              </button>
            </div>
          )}
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
                  <button className="pcp-btn pcp-btn-sm" onClick={() => setBatch(x.batchNo)}>
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

        <div className="pcp-card">
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  {canSelectExport && (
                    <th style={{ width: 34 }}>
                      <input type="checkbox" checked={allTicked} onChange={toggleAll} disabled={!rows.length} title="Select all shown" aria-label="Select all shown" />
                    </th>
                  )}
                  <SortTh field="seriesNo" sort={sort}>Series No.</SortTh>
                  <SortTh field="plant" sort={sort}>Plant</SortTh>
                  <SortTh field="requestor" sort={sort}>Requestor</SortTh>
                  <SortTh field="kind" sort={sort}>Transaction Type</SortTh>
                  <SortTh field="amount" sort={sort} align="right">Amount</SortTh>
                  <SortTh field="date" sort={sort}>Date</SortTh>
                  <SortTh field="status" sort={sort}>Current Status</SortTh>
                  <SortTh field="action" sort={sort}>Action</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr
                    key={r.key} className="pcp-liq-row" tabIndex={0}
                    onClick={() => openRow(r)}
                    onKeyDown={(e) => { if (e.key === "Enter") openRow(r); }}
                    title={`Open ${r.seriesNo || "this transaction"}`}
                  >
                    {canSelectExport && (
                      /* The tick box selects the row; it must not also open it. */
                      <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(r.key)} onChange={() => toggleRow(r.key)} aria-label={`Select ${r.seriesNo || "row"}`} />
                      </td>
                    )}
                    <td>
                      <strong>{r.seriesNo || "—"}</strong>
                      {dupSeries.has(r.seriesNo.trim().toUpperCase()) && (
                        <span className="pcp-badge pcp-badge-red" style={{ marginLeft: 6 }} title="Another transaction carries this series number">
                          <AlertTriangle size={10} /> Duplicate No.
                        </span>
                      )}
                      {r.batchNo && <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>{r.batchNo}</div>}
                    </td>
                    <td>
                      {rowPlantLabel(r)}
                      {plantOfBranch(r.plantCode) !== r.plantCode && (
                        <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>{plantLabel(r.plantCode)}</div>
                      )}
                    </td>
                    <td>{r.requestor || "—"}</td>
                    <td>{r.kind}</td>
                    <td className="pcp-num" style={{ textAlign: "right" }}>{peso(r.amount)}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td><Badge status={r.stage} /></td>
                    <td style={{ fontWeight: 600 }}>{APPROVAL_ACTION_LABEL[approvalStageKey(r.stage)] || "—"}</td>
                    <td>
                      <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={(e) => { e.stopPropagation(); openRow(r); }}>
                        <Eye size={12} /> Open
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={canSelectExport ? 10 : 9} className="pcp-empty">
                    {pendingAll.length ? "Nothing pending matches these filters" : "Nothing is awaiting your approval"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detail && (
        <ReimbursementDetail
          reimb={(reimbursements || []).find((x) => x.id === detail.id) || detail}
          currentUser={currentUser}
          isChecker={isChecker}
          isFinalApprover={isFinalApprover}
          canFinance={canFinance}
          accounting={accounting}
          canRevert={canRevert}
          onExportAcumatica={onExportReimbursementAcumatica}
          onAction={(id, action, opts) => { onReimbursementAction(id, action, opts); setDetail(null); }}
          onEdit={canEditReimb && onUpdateReimbursement ? (r) => { setDetail(null); setEditingReimb(r); } : undefined}
          onClose={() => setDetail(null)}
        />
      )}
      {editingReimb && (
        <ReimbursementEditModal
          reimb={(reimbursements || []).find((x) => x.id === editingReimb.id) || editingReimb}
          plantOptions={reimbPlantOptions}
          allReimbursements={reimbursements || []}
          currentUser={currentUser}
          onUpdate={onUpdateReimbursement}
          onClose={() => setEditingReimb(null)}
        />
      )}
    </div>
  );
}
