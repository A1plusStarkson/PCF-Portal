/* ============================= LIQUIDATION ============================= */

/* ---- Two-level liquidation approval ----
   1. CHECKERS — every Custodian, plus Accounting and Finance (and any
      SuperAdmin that is not final-approval-only, i.e. the System Superuser
      but not Grace Gan) — review the submitted
      liquidation within their plant scope:
      approve/reject each receipt, approve the liquidation, record the cash
      settlement.
   2. FINAL APPROVERS — Grace Gan (a1plusadmin) and the System Superuser, who
      hold identical final-approval authority by the owner's instruction.
      Matched by EMAIL (a display name is not an identity). Grace Gan only
      ever sees liquidations a checker has approved and whose cash is settled.
      A final approval is what makes a liquidation LIQUIDATED and ready for
      replenishment.

   Grace Gan is final approval ONLY (LIQUIDATION_FINAL_ONLY_EMAILS). The
   System Superuser, by the owner's instruction, ALSO has custodian-review
   approval, like the custodians, Accounting and Finance. Two levels still
   means two people: nobody may give the final approval to a transaction they
   approved as custodian — enforced per record in every final-approve gate,
   UI and handler. See isLiquidationChecker / isFinalApprover in 19-app.jsx.
   The same people and rules apply to employee reimbursements. */
const FINAL_APPROVER_NAME = "Grace Gan or the System Superuser";
const LIQUIDATION_FINAL_APPROVER_EMAILS = ["a1plusadmin@a1plus.com", "superuser@a1plus.com"];
const LIQUIDATION_FINAL_ONLY_EMAILS = ["a1plusadmin@a1plus.com"];
const LIQUIDATION_CHECKER_ROLES = ["Custodian", "Accounting", "Finance", "SuperAdmin"];

/* The cash settlement classification now derives from the per-document receipt
   amounts — see reconcileReceipts / settlementStateFor in 02-helpers.jsx. */

/* ---- Liquidation status filter ----
   The Liquidation Module filters by status, and each source has its own
   workflow, so each gets its own option list. The keys are the labels shown to
   the user; the values are the statuses actually stored on a record, so the
   wording can be changed here without touching any state machine.

   "Unliquidated" is the user-facing name for the stored "Not Liquidated". */
const LIQ_STATUS_FILTER_ALL = "All statuses";
const PCA_STATUS_FILTERS = {
  "Unliquidated": "Not Liquidated",
  "Partially Liquidated": "Partially Liquidated",
  "Fully Liquidated": "Fully Liquidated",
};
const PCA_STATUS_FILTER_KEYS = [LIQ_STATUS_FILTER_ALL].concat(Object.keys(PCA_STATUS_FILTERS));
const REIMB_STATUS_FILTER_KEYS = [
  LIQ_STATUS_FILTER_ALL, "For Liquidation", "Liquidation Completed", "For Payment", "Completed",
];
/* Label -> the status actually stored on a reimbursement. Resolved on demand,
   not as a module-level object: REIMB_STATUS is declared in
   22-reimbursement.jsx, which the loader concatenates AFTER this file, so it is
   initialized by render time but not while this fragment is being evaluated. */
const reimbStatusFilter = (label) => ({
  "For Liquidation": REIMB_STATUS.FOR_LIQUIDATION,
  "Liquidation Completed": REIMB_STATUS.LIQUIDATION_DONE,
  "For Payment": REIMB_STATUS.FOR_PAYMENT,
  "Completed": REIMB_STATUS.COMPLETED,
}[label]);

/* ---- Liquidation list columns ----
   Sort accessors for the two list tables (see useTableSort). Functions, not
   values, so reimbTotal / REIMB_* from later fragments resolve at render time. */
const LIQ_PETTY_SORT_FIELDS = {
  voucherNo: (d) => d.voucherNo,
  date: (d) => d.date,
  employee: (d) => d.employee,
  branchCode: (d) => d.branchCode,
  department: (d) => subaccountLabel(d.department),
  expense: (d) => disbExpense(d),
  amount: (d) => Number(d.amount) || 0,
  liqStatus: (d) => d.liqStatus,
  finalStatus: (d) => d.finalStatus,
  /* Overdue balances sort above everything else, then by amount owed. */
  balance: (d) => (d.stl.owing ? (d.stl.overdue ? 1e12 : 0) + d.stl.st.remaining : -1),
};
const LIQ_REIMB_SORT_FIELDS = {
  reimbNo: (r) => r.reimbNo,
  requestDate: (r) => r.requestDate,
  employee: (r) => r.employee,
  branchCode: (r) => r.branchCode,
  department: (r) => subaccountLabel(r.department),
  purpose: (r) => r.purpose,
  amount: (r) => reimbTotal(r),
  status: (r) => r.status,
};
const LIQ_CLIP_CELL = { maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/* ---- Cash settlement: options, readiness, direction and due date ----
   Shared by the worksheet, the Liquidation list filter, Aging and the
   dashboard so every screen agrees on who owes what and by when. */
const SETTLEMENT_MODES = ["Cash", "GCash", "Bank transfer", "Payroll deduction", "Other"];
const SETTLEMENT_SHORT_REASONS = [
  "Balance to follow", "For payroll deduction", "Lost / missing receipt", "Requestor unavailable", "Other",
];
const RECEIVABLE_TREATMENTS = ["Receivable from requestor", "For payroll deduction", "Approved write-off", "Other"];
const SETTLEMENT_FILTERS = [
  "All settlements", "Waiting for receipts", "Cash to return", "Custodian to reimburse", "Overdue settlement", "Settled / nothing owed",
];

/* `ready`  — every document has an amount and is approved, so the figures are
              final. Before that the "amount due" is just the released amount
              minus whatever was typed so far, and showing it as a debt misleads.
   `owing`  — cash still has to change hands (an approved closure ends it).
   Due date — the same 5-calendar-day deadline (AGING_DUE_DAYS) as the
              liquidation itself, counted from cash release. */
function settlementInfo(disb, liq, today) {
  const st = settlementStateFor(disb, liq);
  const approval = receiptApprovalSummary(liq);
  const ready = st.summary.docCount > 0 && st.summary.complete && approval.allApproved;
  const owing = (ready || st.entries.length > 0) && st.type !== "exact" && st.remaining > 0 && !st.closed;
  const dueDate = addDaysISO((disb && disb.date) || todayISO(), AGING_DUE_DAYS);
  const daysLeft = daysBetween(today || todayISO(), dueDate);
  let category;
  if (!ready && !st.entries.length) category = "Waiting for receipts";
  else if (owing) category = st.type === "excess" ? "Cash to return" : "Custodian to reimburse";
  else category = "Settled / nothing owed";
  return { st, ready, owing, dueDate, daysLeft, overdue: owing && daysLeft < 0, category };
}

/* Who owes whom, in words — "Difference ₱5,000" alone does not say. */
const settlementOwes = (type) => (type === "excess" ? "Requestor owes custodian"
  : type === "reimburse" ? "Custodian owes requestor" : "Nothing owed");

/* "Due Sep 29, 2026 · 2 days left" / "Due today" / "Overdue by 3 days". */
function SettlementDueChip({ dueDate, daysLeft }) {
  const overdue = daysLeft < 0;
  const text = overdue
    ? `Overdue by ${-daysLeft} day${daysLeft === -1 ? "" : "s"} · was due ${fmtDate(dueDate)}`
    : daysLeft === 0 ? `Due today · ${fmtDate(dueDate)}`
      : `Due ${fmtDate(dueDate)} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  return <span className={"pcp-stl-due" + (overdue ? " overdue" : daysLeft <= 1 ? " soon" : "")}><Clock size={11} /> {text}</span>;
}

/* Printable acknowledgment slip for ONE recorded movement, signed by both
   sides when the cash changes hands. Opens the browser print dialog. */
function printSettlementSlip(disb, st, entry) {
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const idx = st.entries.findIndex((e) => e === entry || (e.id && e.id === entry.id));
  const paidToDate = round2(st.entries.slice(0, idx + 1).reduce((t, e) => t + (Number(e.amount) || 0), 0));
  const balance = round2(st.expected - paidToDate);
  const isReturn = st.type === "excess";
  const title = isReturn ? "Acknowledgment of Excess Cash Returned" : "Acknowledgment of Reimbursement Paid";
  const payer = isReturn ? disb.employee : (entry.recordedBy || "PCF Custodian");
  const payee = isReturn ? (entry.receivedBy || entry.recordedBy || "PCF Custodian") : (entry.receivedBy || disb.employee);
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} · ${esc(disb.voucherNo)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1c2130; margin: 32px; font-size: 13px; }
  h1 { font-size: 17px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: .4px; }
  .co { color: #6b7182; margin-bottom: 18px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
  th, td { text-align: left; padding: 7px 10px; border: 1px solid #d9dce3; }
  th { width: 34%; background: #f5f6f8; font-weight: 600; }
  .amt { font-size: 20px; font-weight: 700; }
  .note { font-size: 12px; color: #444; margin: 0 0 40px; }
  .sig { display: flex; gap: 40px; }
  .sig div { flex: 1; text-align: center; }
  .line { border-top: 1px solid #1c2130; margin-top: 46px; padding-top: 5px; font-weight: 600; }
  .role { font-size: 11px; color: #6b7182; }
</style></head><body>
  <h1>${esc(title)}</h1>
  <div class="co">${esc(companyOfBranch(disb.branchCode))} · ${esc(plantLabel(disb.branchCode) || disb.branchCode)}</div>
  <table>
    ${row("Voucher No.", disb.voucherNo)}
    ${row("Employee / Requestor", disb.employee)}
    ${row("PCF Released", peso(st.released))}
    ${row("Approved Receipts", peso(st.receiptTotal))}
    ${row(isReturn ? "Total Excess to Return" : "Total Reimbursement Due", peso(st.expected))}
    <tr><th>Amount ${isReturn ? "Returned" : "Paid"} (this slip)</th><td class="amt">${esc(peso(entry.amount))}</td></tr>
    ${row("Date", fmtDate(entry.date))}
    ${row("Mode", entry.mode || "Cash")}
    ${row("Reference / AR / OR No.", entry.reference || "—")}
    ${row("Balance after this payment", balance > 0 ? peso(balance) + " still outstanding" : balance < 0 ? peso(-balance) + " overpaid" : "Fully settled")}
    ${entry.reason ? row("Remarks", entry.reason) : ""}
    ${row("Recorded by", (entry.recordedBy || "—") + (entry.recordedAt ? " · " + String(entry.recordedAt).replace("T", " ") : ""))}
  </table>
  <p class="note">I acknowledge that the amount above was ${isReturn ? "returned to" : "received from"} the Petty Cash Fund on the date stated.</p>
  <div class="sig">
    <div><div class="line">${esc(payer)}</div><div class="role">${isReturn ? "Returned by (Requestor)" : "Paid by (PCF Custodian)"}</div></div>
    <div><div class="line">${esc(payee)}</div><div class="role">${isReturn ? "Received by (PCF Custodian)" : "Received by (Requestor)"}</div></div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) { window.alert("Please allow pop-ups for this site to print the acknowledgment slip."); return; }
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
}

/* Record-a-payment form (replaces the old browser prompt). Captures how the
   cash moved and, when it does not clear the balance, a standard reason. */
function RecordSettlementModal({ disbursement, st, currentUser, onClose, onConfirm }) {
  const isReturn = st.type === "excess";
  const [amount, setAmount] = useState(st.remaining.toFixed(2));
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [receivedBy, setReceivedBy] = useState(isReturn ? (currentUser || "") : disbursement.employee);
  const [reasonSel, setReasonSel] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [ackFile, setAckFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");

  const amt = round2(amount);
  const left = round2(st.remaining - amt);
  const needsReason = amt > 0 && left !== 0;

  const pickAck = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setUploadNote(`"${file.name}" is larger than 2 MB. Please compress it first.`); return; }
    if (!fileStore()) { setUploadNote(STALE_PAGE_NOTE); return; }
    const id = uid("ack");
    setUploadNote(`Uploading "${file.name}"…`);
    storeFile(id, file).then((path) => {
      if (!path) { setUploadNote(`"${file.name}" could not be uploaded. Check your connection and try again.`); return; }
      setUploadNote("");
      setAckFile({ id, name: file.name, type: file.type || "file", size: file.size, path, uploadedAt: todayISO() });
    });
  };

  const confirm = () => {
    if (!(amt > 0)) { window.alert("Enter the amount that actually moved. It must be greater than zero."); return; }
    if (!date) { window.alert("Enter the date the cash changed hands."); return; }
    if (!receivedBy.trim()) { window.alert("Enter who received the cash."); return; }
    if (needsReason && !reasonSel) { window.alert("Select a reason — the amount does not clear the balance."); return; }
    if (needsReason && reasonSel === "Other" && !reasonNote.trim()) { window.alert("Describe the reason."); return; }
    if (uploadNote.startsWith("Uploading")) { window.alert("Wait for the acknowledgment upload to finish."); return; }
    const reason = needsReason ? [reasonSel, reasonNote.trim()].filter(Boolean).join(" — ") : reasonNote.trim();
    onConfirm({ amount: amt, date, mode, reference: reference.trim(), receivedBy: receivedBy.trim(), ackFile, reason });
  };

  return (
    <div className="pcp-modal-backdrop" {...backdropCloseProps(onClose)}>
      <div className="pcp-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>{isReturn ? "Record Cash Returned" : "Record Reimbursement Paid"}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginBottom: 10 }}>
            {disbursement.voucherNo} · {disbursement.employee} · {peso(st.remaining)} still outstanding
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Amount {isReturn ? "returned" : "paid"} <span style={{ color: "var(--brand)" }}>*</span></label>
              <input type="number" min="0" step="0.01" className="pcp-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="pcp-field">
              <label>Date <span style={{ color: "var(--brand)" }}>*</span></label>
              <input type="date" className="pcp-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="pcp-field-row">
            <div className="pcp-field">
              <label>Mode</label>
              <select className="pcp-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                {SETTLEMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="pcp-field">
              <label>Reference / AR / OR No.</label>
              <input className="pcp-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. AR-00123 or GCash ref." />
            </div>
          </div>
          <div className="pcp-field">
            <label>Received by <span style={{ color: "var(--brand)" }}>*</span></label>
            <input className="pcp-input" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          {needsReason && (
            <div className="pcp-field">
              <label>
                Reason — this leaves {peso(Math.abs(left))} {left > 0 ? "still outstanding" : "overpaid"} <span style={{ color: "var(--brand)" }}>*</span>
              </label>
              <select className="pcp-select" value={reasonSel} onChange={(e) => setReasonSel(e.target.value)}>
                <option value="">Select a reason</option>
                {(left > 0 ? SETTLEMENT_SHORT_REASONS : ["Rounding / correction", "Other"]).map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}
          <div className="pcp-field">
            <label>{needsReason ? "Details" : "Remarks (optional)"}</label>
            <input className="pcp-input" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
          </div>
          <div className="pcp-field" style={{ marginBottom: 0 }}>
            <label>Signed acknowledgment (optional photo or scan)</label>
            {ackFile ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <Paperclip size={12} /> {ackFile.name}
                <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => setAckFile(null)}><X size={12} /></button>
              </div>
            ) : (
              <input type="file" accept="image/*,application/pdf" onChange={(e) => pickAck(e.target.files && e.target.files[0])} style={{ fontSize: 12 }} />
            )}
            {uploadNote && <div style={{ fontSize: 11, color: "var(--brand)", marginTop: 4 }}>{uploadNote}</div>}
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" onClick={confirm}><Check size={13} /> Record {peso(amt > 0 ? amt : 0)}</button>
        </div>
      </div>
    </div>
  );
}

/* Close-as-Receivable form (replaces the two browser prompts). */
function CloseReceivableModal({ disbursement, amount, onClose, onConfirm }) {
  const [treatment, setTreatment] = useState(RECEIVABLE_TREATMENTS[0]);
  const [other, setOther] = useState("");
  const [reason, setReason] = useState("");
  const confirm = () => {
    const t = treatment === "Other" ? other.trim() : treatment;
    if (!t) { window.alert("Describe how the balance is being treated."); return; }
    if (!reason.trim()) { window.alert("A reason / authority is required to close a shortage."); return; }
    onConfirm({ treatment: t, reason: reason.trim() });
  };
  return (
    <div className="pcp-modal-backdrop" {...backdropCloseProps(onClose)}>
      <div className="pcp-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Close {peso(amount)} as Receivable</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginBottom: 10 }}>
            {disbursement.voucherNo} · {disbursement.employee} — {peso(amount)} will remain unrecovered and the status
            will read LIQUIDATED (SHORT). This is written to the audit trail against your name.
          </div>
          <div className="pcp-field">
            <label>Treatment <span style={{ color: "var(--brand)" }}>*</span></label>
            <select className="pcp-select" value={treatment} onChange={(e) => setTreatment(e.target.value)}>
              {RECEIVABLE_TREATMENTS.map((t) => <option key={t}>{t}</option>)}
            </select>
            {treatment === "Other" && (
              <input className="pcp-input" style={{ marginTop: 6 }} placeholder="Describe the treatment" value={other} onChange={(e) => setOther(e.target.value)} />
            )}
          </div>
          <div className="pcp-field" style={{ marginBottom: 0 }}>
            <label>Reason / authority <span style={{ color: "var(--brand)" }}>*</span></label>
            <textarea className="pcp-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Approved by Finance Director for payroll deduction on the next cut-off" />
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Cancel</button>
          <button className="pcp-btn pcp-btn-primary" onClick={confirm}><AlertTriangle size={13} /> Close as Receivable</button>
        </div>
      </div>
    </div>
  );
}

/* Reject-liquidation dialog — a standardized Rejection Reason (required) plus an
   optional Reviewer Comment. Only the authorized approver reaches this dialog;
   the asterisk marks the reason field alone. */
function RejectLiquidationModal({ voucherNo, employee, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const confirm = () => {
    if (!reason) { window.alert("Please select a rejection reason."); return; }
    onConfirm({ reason, comment: comment.trim() });
  };
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Reject Liquidation</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ fontSize: 11.5, color: "var(--text-mut)", marginBottom: 4 }}>
            {voucherNo}{employee ? ` · ${employee}` : ""}
          </div>
          <div className="pcp-field">
            <label>Rejection Reason <span style={{ color: "var(--brand)" }}>*</span></label>
            <select className="pcp-select" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select reason for rejection</option>
              {LIQUIDATION_REJECTION_REASONS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="pcp-field">
            <label>Reviewer Comment <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(Optional)</span></label>
            <textarea
              className="pcp-input" rows={4}
              value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Enter additional comments..."
            />
          </div>
          <div className="pcp-modal-foot" style={{ padding: "8px 0 0" }}>
            <button type="button" className="pcp-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="pcp-btn pcp-btn-danger" onClick={confirm} disabled={!reason}>
              <X size={13} /> Confirm Rejection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyLine() {
  return { id: uid("ln"), date: todayISO(), expense: "", category: EXPENSE_CATEGORIES[0], department: SUBACCOUNTS[1].code, amount: "", taxCategory: "" };
}

/* Outline for a field the save is waiting on. Border only — no background, so
   it reads the same whatever the surrounding surface is. */
const MISSING_FIELD_STYLE = { borderColor: "var(--brand)" };

/* Bring older stored documents up to the current shape so rows uploaded before
   receipt amounts existed still render and can be completed. */
/* ---- Receipt bytes ----
   Both of these resolve the attachment through useFileUrl, which returns the
   inline bytes on a legacy record and a signed bucket URL on a migrated one.
   They are separate components because a hook cannot be called from inside
   the .map that renders the receipt rows; the signed-URL cache means the two
   of them still cost one network call per receipt, not two. */
function AttachmentLinks({ att }) {
  const src = useFileUrl(att);
  if (!src) {
    return <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>{hasFileBytes(att) ? "loading…" : "no file"}</span>;
  }
  return (
    <>
      <a className="pcp-btn pcp-btn-sm" href={src} target="_blank" rel="noopener noreferrer" title="Open full size / zoom"><Search size={12} /> Zoom</a>
      <a className="pcp-btn pcp-btn-sm" href={src} download={att.name} title="Download receipt"><Download size={12} /></a>
    </>
  );
}

function AttachmentPreview({ att, isImage, isPdf }) {
  const src = useFileUrl(att);
  const note = (text) => (
    <div style={{ padding: 24, textAlign: "center", fontSize: 11.5, color: "var(--text-mut)" }}>{text}</div>
  );
  if (!src) return note(hasFileBytes(att) ? "Loading receipt…" : "No file stored for this receipt.");
  if (isImage) return <img src={src} alt={att.name} style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain" }} />;
  if (isPdf) return <iframe title={att.name} src={src} style={{ width: "100%", height: 320, border: "none" }} />;
  return note("Preview not available for this file type — use Zoom or Download to open it.");
}

function normalizeAttachment(a) {
  return {
    ...a,
    docType: a.docType || DEFAULT_DOC_TYPE,
    receiptNo: a.receiptNo || "",
    receiptAmount: a.receiptAmount == null ? "" : a.receiptAmount,
    amountHistory: a.amountHistory || [],
  };
}

function LiquidationWorksheet({
  disbursement, liquidation, onSave, onExport, canApproveReceipts, onDecideReceipt,
  liquidations, disbursements, onSubmitLiquidation, onReopenLiquidation,
  onRecordSettlement, onCloseShortage, onReopenShortage, canApproveShortage,
  onReviewOverLiquidation, canDelete, onDeleteLiquidation,
  canRejectLiquidation, onRejectLiquidation,
  onCheckLiquidation, canFinalApprove, onFinalApprove, currentUser, onDirtyChange,
}) {
  const [lines, setLines] = useState(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
  const [attachments, setAttachments] = useState(
    liquidation && liquidation.attachments ? liquidation.attachments.map(normalizeAttachment) : []
  );
  const [saved, setSaved] = useState(true);
  const [uploadNote, setUploadNote] = useState("");
  const [dupNote, setDupNote] = useState("");
  /* Open state of the Record Payment and Close as Receivable forms. */
  const [showRecord, setShowRecord] = useState(false);
  const [showReceivable, setShowReceivable] = useState(false);
  /* Open state of the standardized Reject Liquidation dialog. */
  const [showReject, setShowReject] = useState(false);

  /* Tell the host pop-up about unsaved edits so closing it can warn first. */
  useEffect(() => { if (onDirtyChange) onDirtyChange(!saved); }, [saved]);

  useEffect(() => {
    setLines(liquidation ? liquidation.lines.map((l) => ({ ...l })) : [emptyLine()]);
    setAttachments(liquidation && liquidation.attachments ? liquidation.attachments.map(normalizeAttachment) : []);
    setSaved(true);
    setUploadNote("");
    setDupNote("");
    setShowRecord(false);
    setShowReceivable(false);
    setShowReject(false);
  }, [disbursement.id]);

  const updateLine = (id, patch) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSaved(false);
  };
  const addLine = () => { setLines((ls) => [...ls, emptyLine()]); setSaved(false); };
  const removeLine = (id) => { setLines((ls) => ls.filter((l) => l.id !== id)); setSaved(false); };

  /* Supporting documents (official receipts, sales invoices, etc.) are read as
     data URLs and stored with the liquidation. Capped per-file to keep the
     shared record from growing too large. */
  const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
  const onPickFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadNote("");
    files.forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        setUploadNote(`"${file.name}" is larger than 2 MB and was skipped. Please compress it first.`);
        return;
      }
      /* The bytes go to the Storage bucket and the record keeps only the
         path. Nothing is added to the worksheet until the upload SUCCEEDS —
         an attachment row pointing at bytes that were never stored is worse
         than no attachment at all, because it looks liquidated. */
      if (!fileStore()) { setUploadNote(STALE_PAGE_NOTE); return; }
      const attId = uid("att");
      setUploadNote(`Uploading "${file.name}"…`);
      storeFile(attId, file).then((path) => {
        if (!path) {
          setUploadNote(`"${file.name}" could not be uploaded. Check your connection and try again.`);
          return;
        }
        setUploadNote("");
        const doc = {
          id: attId, name: file.name, type: file.type || "file",
          size: file.size, path, uploadedAt: todayISO(),
          approvalStatus: "Pending", approvalHistory: [],
          docType: DEFAULT_DOC_TYPE, receiptNo: "", receiptAmount: "", amountHistory: [],
        };
        /* Warn on a likely duplicate but still let the user proceed — the same
           file name can legitimately recur across different vouchers. */
        setAttachments((as) => {
          const hits = findDuplicateReceipts(doc, as, liquidations, disbursement.id);
          if (hits.length) {
            const h = hits[0];
            const other = (disbursements || []).find((x) => x.id === h.disbursementId);
            const where = h.disbursementId === disbursement.id
              ? "this liquidation"
              : `voucher ${other ? other.voucherNo : h.disbursementId}`;
            setDupNote(`Possible duplicate: "${file.name}" matches "${h.doc.name}" on ${where} (${h.reason}). Review before submitting.`);
          }
          return [...as, doc];
        });
        setSaved(false);
      });
    });
  };
  const removeAttachment = (id) => { setAttachments((as) => as.filter((a) => a.id !== id)); setSaved(false); };

  /* Per-document field edits (document type, receipt no., receipt amount). */
  const updateAttachment = (id, patch) => {
    setAttachments((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSaved(false);
  };
  /* Receipt amount accepts decimals but never a negative value. Kept as the raw
     string while typing so the field can be cleared, then normalized on save. */
  const setReceiptAmount = (id, raw) => {
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return;
    }
    updateAttachment(id, { receiptAmount: raw });
  };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = disbursement.amount - total;
  const validLines = lines.filter((l) => l.expense.trim() && Number(l.amount) > 0);

  /* ---- Incomplete expense lines ----
     Only validLines are ever persisted. That used to happen silently: a line
     missing its Expense text or its Amount was dropped on save and the button
     still reported "Saved", so encoded work disappeared with no explanation.
     The trap is that those two are exactly the fields that start BLANK, while
     Date, Expense Category and Department arrive pre-filled — so a row with
     four populated controls can still be thrown away.

     A row counts as STARTED only through fields that begin empty and can be
     emptied again (Expense, Amount, Tax Category). Category and Department are
     deliberately excluded: they cannot be returned to an untouched state, so
     judging by them would permanently block a save on a row the preparer
     cannot clear and — when it is the only row — cannot delete either. */
  const lineStarted = (l) => !!(
    String(l.expense || "").trim()
    || String(l.amount || "").trim()
    || String(l.taxCategory || "").trim()
  );
  const lineMissing = (l) => {
    const missing = [];
    if (!String(l.expense || "").trim()) missing.push("Expense");
    if (!(Number(l.amount) > 0)) missing.push("Amount");
    return missing;
  };
  const incompleteLines = lines
    .map((l, i) => ({ id: l.id, row: i + 1, missing: lineMissing(l), started: lineStarted(l) }))
    .filter((x) => x.started && x.missing.length);
  const incompleteById = {};
  incompleteLines.forEach((x) => { incompleteById[x.id] = x.missing; });

  /* Receipt approval state is read from the PERSISTED liquidation so that
     Grace Gan's decisions (saved immediately) are reflected here regardless of
     unsaved worksheet edits. */
  const persistedById = (id) => ((liquidation && liquidation.attachments) || []).find((a) => a.id === id);
  const approvalSummary = receiptApprovalSummary(liquidation);
  const overallApproval = liqApprovalStatus(liquidation);
  const canSubmitFinal = approvalSummary.total > 0 && approvalSummary.allApproved;

  /* Live view of the documents: receipt amounts come from the worksheet (so the
     totals recalculate as the requestor types) while approval state comes from
     the persisted record. Every figure below is derived from these documents —
     no total is stored on its own. */
  const mergedAtts = attachments.map((a) => {
    const pa = persistedById(a.id);
    return {
      ...a,
      approvalStatus: (pa && pa.approvalStatus) || a.approvalStatus || "Pending",
      approvalHistory: (pa && pa.approvalHistory) || a.approvalHistory || [],
    };
  });
  const liveLiq = { ...(liquidation || {}), attachments: mergedAtts };
  const receiptSummary = receiptAmountSummary(liveLiq);
  const st = settlementStateFor(disbursement, liveLiq);
  const finalStatus = liqFinalStatus(disbursement, liveLiq);
  const isDraft = liqIsDraft(liquidation);
  /* A standing rejection lets the requestor correct and resubmit while its
     reason(s) stay on the record. */
  const isRejected = liqIsRejected(liquidation);
  const rejections = liqRejections(liquidation);
  const review = liqReview(liquidation);
  const stage = liqApprovalStage(disbursement, liquidation);
  const isSubmitted = !!liquidation && (liquidation.submissionStatus || "Draft") === "Submitted";
  /* Grace Gan's approval closes the liquidation for everybody: what she
     approved is what gets replenished, so nothing under it may move. */
  const finalLocked = review.final && !review.legacy;
  /* After submission the amounts are read-only; only a checker may still
     correct them (with a reason, in the audit trail), and never after final
     approval. */
  const amountsLocked = finalLocked || (!isDraft && !canApproveReceipts);
  /* Receipts are decided by the checker AFTER the requestor submits, while the
     amounts are locked — so an approved amount can never be edited afterwards
     by the person who claimed it. */
  const canDecideReceipts = !!canApproveReceipts && isSubmitted && !finalLocked;
  /* Cash settlement is a custodian act: the person who owes the money must not
     be able to record that it came back. */
  const canSettle = !!canApproveReceipts && !finalLocked;
  /* Settlement presentation: readiness, due date, colour and headline. Amber =
     cash to return, blue = custodian to reimburse, green = nothing owed / done,
     red only for a real problem (overdue or over-settled). */
  const settleDue = settlementInfo(disbursement, liveLiq);
  const settleReady = settleDue.ready;
  const settleTone = st.remaining < 0 || settleDue.overdue ? "red"
    : st.type === "exact" || st.remaining === 0 ? "green"
      : st.closed ? "gray"
        : st.type === "excess" ? "amber" : "blue";
  const settleHeadline = st.type === "exact" ? "Exact amount — no refund or reimbursement needed"
    : st.remaining < 0 ? `Over-settled — ${peso(st.actual)} recorded against ${peso(st.expected)} due`
      : st.remaining === 0
        ? (st.type === "excess"
          ? `Requestor returned ${peso(st.expected)} to the PCF Custodian`
          : `PCF Custodian reimbursed ${peso(st.expected)} to the requestor`)
        : st.closed ? `${peso(st.remaining)} unrecovered — closed as ${st.closure.treatment}`
          : st.type === "excess"
            ? `Requestor must return ${peso(st.remaining)} to the PCF Custodian`
            : `PCF Custodian must reimburse ${peso(st.remaining)} to the requestor`;
  /* The encoded expense lines should agree with the approved receipts. */
  const linesVsReceipts = round2(total - receiptSummary.approvedTotal);

  const submitBlockers = [];
  if (!receiptSummary.docCount) submitBlockers.push("upload at least one supporting document");
  if (receiptSummary.missing > 0) submitBlockers.push(`enter the receipt amount on ${receiptSummary.missing} document(s)`);
  if (approvalSummary.anyRejected) submitBlockers.push("replace or remove the rejected document(s)");
  if (!saved) submitBlockers.push("save your changes first");
  const canSubmit = isDraft && submitBlockers.length === 0;
  const missingAmountDocs = attachments
    .filter((a) => docRequiresAmount(a) && (a.approvalStatus || "Pending") !== "Rejected" && !(Number(a.receiptAmount) > 0))
    .map((a) => a.name);

  /* Custodian approval of the liquidation as a whole. */
  const checkBlockers = [];
  if (!isSubmitted) checkBlockers.push("the requestor has not submitted it");
  if (receiptSummary.missing > 0) checkBlockers.push("every document needs its receipt amount");
  if (approvalSummary.anyRejected) checkBlockers.push("a receipt is rejected — return the liquidation for correction");
  if (!approvalSummary.allApproved) checkBlockers.push("approve every receipt first");
  if (!saved) checkBlockers.push("save your changes first");
  const canCheckNow = !!canApproveReceipts && !!onCheckLiquidation && !review.checked && !finalLocked && checkBlockers.length === 0;
  /* Never the custodian who approved it — two levels, two people. */
  const checkedBySelf = review.checked
    && String(review.checkedBy).toLowerCase() === String(currentUser || "").toLowerCase();
  const canFinalNow = !!canFinalApprove && !!onFinalApprove && stage === LIQ_STAGE.FOR_FINAL && !checkedBySelf;

  const handleCheck = () => {
    if (!canCheckNow) return;
    const remarks = window.prompt(
      `Approve the liquidation for ${disbursement.voucherNo} as custodian?\n\n`
      + `Approved receipts: ${peso(receiptSummary.approvedTotal)} against ${peso(disbursement.amount)} released.\n\n`
      + `Once the cash difference is settled it goes to ${FINAL_APPROVER_NAME} for final approval.\n\nRemarks (optional):`, ""
    );
    if (remarks == null) return;
    onCheckLiquidation(disbursement.id, remarks.trim());
  };
  const handleFinalApprove = () => {
    if (!canFinalNow) return;
    const remarks = window.prompt(
      `Give final approval to the liquidation for ${disbursement.voucherNo}?\n\n`
      + `Approved receipts: ${peso(receiptSummary.approvedTotal)} · checked by ${review.checkedBy}.\n\n`
      + "It becomes Fully Approved / Ready for Replenishment and can no longer be edited.\n\nRemarks (optional):", ""
    );
    if (remarks == null) return;
    onFinalApprove(disbursement.id, remarks.trim());
  };

  const approveReceipt = (a) => onDecideReceipt && onDecideReceipt(disbursement.id, a.id, "Approved", "");
  const rejectReceipt = (a) => {
    if (!onDecideReceipt) return;
    const remarks = window.prompt(`Reason for rejecting "${a.name}" (required):`, "");
    if (remarks == null) return;
    if (!remarks.trim()) { window.alert("Rejection remarks are required."); return; }
    onDecideReceipt(disbursement.id, a.id, "Rejected", remarks.trim());
  };
  /* Approve every still-pending, already-saved receipt in one action. */
  const approveAllReceipts = () => {
    if (!onDecideReceipt) return;
    ((liquidation && liquidation.attachments) || []).forEach((a) => {
      if ((a.approvalStatus || "Pending") !== "Approved") {
        onDecideReceipt(disbursement.id, a.id, "Approved", "");
      }
    });
  };

  /* Which receipt amounts changed against the persisted record — drives the
     mandatory reason prompt for post-submission corrections. */
  const changedAmounts = attachments.filter((a) => {
    const pa = persistedById(a.id);
    return pa && round2(pa.receiptAmount) !== round2(a.receiptAmount);
  });

  const handleSave = () => {
    /* Refuse the save and say exactly which row is short of what. Dropping the
       line and reporting "Saved" is how an afternoon of encoding vanishes. */
    if (incompleteLines.length) {
      window.alert(
        "This liquidation cannot be saved yet — "
        + `${incompleteLines.length} expense line(s) are incomplete.\n\n`
        + incompleteLines.map((x) => `  Line ${x.row}: missing ${x.missing.join(" and ")}`).join("\n")
        + "\n\nEvery expense line needs an Expense description and an Amount greater"
        + " than zero. Fill those in, or delete the line, then save again."
        + "\n\nNothing has been saved, so your other lines are still here."
      );
      return;
    }
    if (attachments.some((a) => a.receiptAmount !== "" && Number(a.receiptAmount) < 0)) {
      window.alert("Receipt amounts cannot be negative.");
      return;
    }
    let reason = "";
    /* A correction made after submission must carry a reason for the audit
       trail. Draft edits are free-form and logged without one. */
    if (!isDraft && changedAmounts.length) {
      const names = changedAmounts.map((a) => a.name).join(", ");
      const answer = window.prompt(
        `This liquidation is already submitted. Reason for changing the receipt amount on ${names} (required):`, ""
      );
      if (answer == null) return;
      if (!answer.trim()) { window.alert("A reason is required to change a receipt amount after submission."); return; }
      reason = answer.trim();
    }
    const cleanAtts = attachments.map((a) => ({
      ...a,
      docType: a.docType || DEFAULT_DOC_TYPE,
      receiptNo: (a.receiptNo || "").trim(),
      receiptAmount: round2(a.receiptAmount),
    }));
    onSave(disbursement.id, validLines.map((l) => ({ ...l, amount: Number(l.amount) })), cleanAtts, { reason });
    setSaved(true);
  };

  const handleSubmit = () => {
    if (!canSubmit || !onSubmitLiquidation) return;
    /* Nothing is approved yet at submission, so compare the amounts CLAIMED. */
    const claimed = reconcileReceipts(disbursement.amount, receiptSummary.allTotal);
    const warn = claimed.type === "reimburse"
      ? `\n\nWARNING: the receipt total exceeds the cash released by ${peso(claimed.expected)}. This liquidation will be flagged for review and will NOT be approved automatically.`
      : "";
    if (!window.confirm(
      `Submit this liquidation for ${disbursement.voucherNo}?\n\n`
      + `Total Receipt Amount: ${peso(receiptSummary.allTotal)}\n`
      + `PCF Released Amount: ${peso(disbursement.amount)}${warn}\n\n`
      + `It goes to the custodian for review, then to ${FINAL_APPROVER_NAME} for final approval. `
      + "Receipt amounts become read-only after submission."
    )) return;
    onSubmitLiquidation(disbursement.id);
  };

  const handleReopen = () => {
    if (!onReopenLiquidation) return;
    const reason = window.prompt("Reason for reopening this liquidation for editing (required):", "");
    if (reason == null) return;
    if (!reason.trim()) { window.alert("A reason is required to reopen a submitted liquidation."); return; }
    onReopenLiquidation(disbursement.id, reason.trim());
  };

  /* Confirm a standardized rejection — the dialog already blocks a blank reason;
     the comment is passed through as-is (may be empty). */
  const handleConfirmReject = ({ reason, comment }) => {
    if (!onRejectLiquidation) return;
    onRejectLiquidation(disbursement.id, { reason, comment });
    setShowReject(false);
  };

  /* Recording a movement asserts the cash HAS moved. It ADDS to the running
     total rather than replacing it, so a settlement paid in instalments keeps
     every payment. A movement that leaves a balance outstanding must carry a
     reason — a shortage with no explanation is the thing that used to vanish. */
  const handleRecordSettlement = (form) => {
    if (!onRecordSettlement) return;
    onRecordSettlement(disbursement.id, {
      ...form, expectedAmount: st.expected, runningTotal: st.actual, type: st.type,
    });
    setShowRecord(false);
  };

  const handleUndoSettlement = () => {
    if (!onRecordSettlement) return;
    if (!window.confirm(
      `Clear the cash settlement on ${disbursement.voucherNo}?\n\n`
      + `This removes all ${st.entries.length} recorded movement(s)`
      + (st.closed ? " and the approved shortage closure" : "")
      + ", and the liquidation reverts to NOT YET LIQUIDATED.\n\nThis cannot be undone."
    )) return;
    onRecordSettlement(disbursement.id, { clear: true, expectedAmount: st.expected, type: st.type });
  };

  /* Accepts an unrecovered balance as a receivable so the liquidation can
     complete. Restricted to Custodian / Finance / Accounting / SuperAdmin — a
     Requestor closing their own shortage would be signing off their own debt. */
  const handleCloseShortage = ({ treatment, reason }) => {
    if (!onCloseShortage || !canApproveShortage) return;
    onCloseShortage(disbursement.id, { shortageAmount: st.remaining, treatment, reason });
    setShowReceivable(false);
  };

  const handleReopenShortage = () => {
    if (!onReopenShortage || !canApproveShortage) return;
    if (!window.confirm(
      `Reopen the closed shortage on ${disbursement.voucherNo}?\n\n`
      + `${peso(st.remaining)} becomes outstanding again and the liquidation reverts to PARTIALLY SETTLED.`
    )) return;
    onReopenShortage(disbursement.id);
  };

  const handleReview = () => {
    if (!onReviewOverLiquidation) return;
    const remarks = window.prompt(
      `Over-liquidation of ${peso(st.expected)} on ${disbursement.voucherNo}.\n`
      + "Record your review findings / approval remarks (required):", ""
    );
    if (remarks == null) return;
    if (!remarks.trim()) { window.alert("Review remarks are required."); return; }
    onReviewOverLiquidation(disbursement.id, remarks.trim());
  };

  return (
    <div>
      {/* Sticky summary + action bar so Finance always sees the key figures and
          primary actions without scrolling (Section 25). */}
      <div className="pcp-liq-sticky">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="pcp-eyebrow">Source: Petty Cash Advance · Voucher {disbursement.voucherNo}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{disbursement.employee}</div>
            <div style={{ fontSize: 12, color: "var(--text-mut)", marginTop: 2 }}>
              {disbursement.branchCode} · {companyOfBranch(disbursement.branchCode)} · {fmtDate(disbursement.date)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7, flexWrap: "wrap" }}>
              <Badge status={finalStatus} />
              <Badge status={stage} />
              {!isDraft && liquidation && liquidation.submittedBy && (
                <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                  submitted by {liquidation.submittedBy} · {(liquidation.submittedAt || "").replace("T", " ")}
                </span>
              )}
            </div>
            {/* The approval chain, stamped. */}
            {(review.checked || review.final) && !review.legacy && (
              <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5, lineHeight: 1.5 }}>
                {review.checked && <div>Custodian approved by <b>{review.checkedBy}</b> · {review.checkedAt.replace("T", " ")}{review.checkRemarks ? ` · "${review.checkRemarks}"` : ""}</div>}
                {review.final && <div>Final approval by <b>{review.finalBy}</b> · {review.finalAt.replace("T", " ")}{review.finalRemarks ? ` · "${review.finalRemarks}"` : ""}</div>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="pcp-btn pcp-btn-sm" onClick={() => onExport(disbursement, { lines: validLines })} disabled={!validLines.length}>
              <Download size={12} /> Export to Excel
            </button>
            {!finalLocked && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={handleSave}>
                {saved ? "Saved" : "Save Liquidation"}
              </button>
            )}
            {isDraft ? (
              <button
                className="pcp-btn pcp-btn-sm pcp-btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
                title={canSubmit ? "Submit the liquidation for custodian review" : `To submit: ${submitBlockers.join("; ")}`}
              >
                <Check size={12} /> {isRejected ? "Resubmit Liquidation" : "Submit Liquidation"}
              </button>
            ) : (
              <>
                {canApproveReceipts && onCheckLiquidation && !review.checked && !finalLocked && (
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-primary"
                    onClick={handleCheck}
                    disabled={!canCheckNow}
                    title={canCheckNow ? "Approve this liquidation as custodian" : `To approve: ${checkBlockers.join("; ")}`}
                  >
                    <ShieldCheck size={12} /> Custodian Approve
                  </button>
                )}
                {canFinalNow && (
                  <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={handleFinalApprove} title="Final approval — ready for replenishment">
                    <ShieldCheck size={12} /> Final Approve
                  </button>
                )}
                {canApproveReceipts && !finalLocked && (
                  <button className="pcp-btn pcp-btn-sm" onClick={handleReopen} title="Reopen for editing (recorded in the audit trail)">
                    <Edit3 size={12} /> Reopen
                  </button>
                )}
                {canRejectLiquidation && liquidation && !finalLocked && (canApproveReceipts || canFinalNow) && (
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-danger"
                    onClick={() => setShowReject(true)}
                    title="Reject this liquidation with a standardized reason"
                  >
                    <X size={12} /> Reject Liquidation
                  </button>
                )}
              </>
            )}
            {canDelete && onDeleteLiquidation && liquidation && (
              <button
                className="pcp-btn pcp-btn-sm pcp-btn-danger"
                onClick={() => onDeleteLiquidation(disbursement.id)}
                title="Delete this liquidation and return the voucher to the worklist (super admin)"
              >
                <Trash2 size={12} /> Delete Liquidation
              </button>
            )}
          </div>
        </div>
        <div className="pcp-liq-sticky-grid" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">PCF Released</div><div className="pcp-num">{peso(disbursement.amount)}</div></div>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Total Receipts</div><div className="pcp-num">{peso(receiptSummary.approvedTotal)}</div></div>
          <div className="pcp-liq-metric">
            <div className="pcp-kpi-label">{st.type === "excess" ? "Excess / Refund" : st.type === "reimburse" ? "Reimbursement Due" : "Variance"}</div>
            <div className="pcp-num" style={{ color: st.type === "reimburse" ? "var(--brand)" : st.type === "excess" ? "var(--amber)" : "var(--green)" }}>{peso(st.expected)}</div>
          </div>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Status</div><div><Badge status={finalStatus} /></div></div>
        </div>
        {/* Why Submit is disabled, on screen rather than only in the button's
            hover tooltip — and WHICH documents still need an amount, since a
            document without one adds ₱0 and the totals can look complete. */}
        {isDraft && !canSubmit && submitBlockers.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--brand)" }}>
            <AlertTriangle size={12} style={{ verticalAlign: "-2px" }} /> To submit: {submitBlockers.join("; ")}.
            {missingAmountDocs.length > 0 && (
              <div style={{ color: "var(--text-mut)", marginTop: 3 }}>
                Missing an amount: <b>{missingAmountDocs.join(", ")}</b>. Enter its receipt amount below, or, if it is
                only a supporting document with no peso amount (a photo, permit, approval sheet), set its Document Type
                to "Other Supporting Document".
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rejection history — every rejection kept as its own record and never
          overwritten. The most recent appears first. */}
      {rejections.length > 0 && (
        <div className="pcp-card pcp-card-pad" style={{ marginBottom: 12, borderColor: isRejected ? "var(--brand)" : "var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={15} color="#c8102e" />
            <div className="pcp-section-title" style={{ margin: 0 }}>Rejection History</div>
            <span style={{ fontSize: 11, color: "var(--text-mut)" }}>({rejections.length})</span>
          </div>
          {isRejected && (
            <div style={{ fontSize: 12, color: "var(--brand-dark)", marginBottom: 10 }}>
              This liquidation was rejected. Correct the items below and resubmit — the original rejection reason(s) stay on record.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rejections.slice().reverse().map((r, i) => (
              <div key={r.id || i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Rejection #{rejections.length - i}</div>
                  <Badge status="REJECTED" />
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}><strong>Rejection Reason:</strong> {r.reason}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}><strong>Reviewer Comment:</strong> {r.comment ? r.comment : "—"}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 4 }}>
                  Rejected by {r.rejectedBy} · {(r.rejectedAt || "").replace("T", " ")}
                  {r.prevStatus ? ` · ${r.prevStatus} → ${r.newStatus}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automated computation + receipt-approval gate (collapsible secondary detail). */}
      <Collapsible title="Automated Computation & Receipt Approval" subtitle="encoded totals, receipt approvals">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5 }}>
          <div><div className="pcp-kpi-label">Total Receipt Amount (approved docs)</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(receiptSummary.approvedTotal)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({receiptSummary.approvedCount} doc{receiptSummary.approvedCount === 1 ? "" : "s"})</span></div></div>
          <div><div className="pcp-kpi-label">All Documents Encoded</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(receiptSummary.allTotal)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({receiptSummary.docCount} doc{receiptSummary.docCount === 1 ? "" : "s"})</span></div></div>
          <div><div className="pcp-kpi-label">Receipts Approved</div><div className="pcp-num" style={{ fontWeight: 700 }}>{approvalSummary.approved} / {approvalSummary.total}</div></div>
          <div>
            <div className="pcp-kpi-label">Amounts Captured</div>
            <div className="pcp-num" style={{ fontWeight: 700, color: receiptSummary.missing ? "var(--amber)" : "var(--green)" }}>
              {receiptSummary.amountBearing - receiptSummary.missing} / {receiptSummary.amountBearing}
            </div>
            {receiptSummary.exemptByType > 0 && (
              <div style={{ fontSize: 10, color: "var(--text-mut)", marginTop: 1 }}>
                {receiptSummary.exemptByType} supporting doc(s) need no amount
              </div>
            )}
          </div>
          <div><div className="pcp-kpi-label">Encoded Expense Lines</div><div className="pcp-num" style={{ fontWeight: 700 }}>{peso(total)} <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>({validLines.length} line{validLines.length === 1 ? "" : "s"})</span></div></div>
        </div>

        {receiptSummary.missing > 0 && (
          <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, fontSize: 12, background: "var(--amber-bg)", color: "var(--amber)" }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>{receiptSummary.missing} document(s) have no receipt amount.</strong> Every supporting document needs its actual amount before this liquidation can be submitted.
          </div>
        )}

        {/* The expense lines feed the COA / Acumatica export while the document
            amounts drive the cash settlement — they should agree. */}
        {receiptSummary.docCount > 0 && linesVsReceipts !== 0 && (
          <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, fontSize: 12, background: "var(--amber-bg)", color: "var(--amber)" }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>Encoded expense lines ({peso(total)}) do not match the approved receipts ({peso(receiptSummary.approvedTotal)}).</strong> Difference of {peso(Math.abs(linesVsReceipts))} — the expense breakdown is what gets exported to Acumatica, so reconcile the two before submitting.
          </div>
        )}
        <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, fontSize: 12,
          background: overallApproval === "For Revision" ? "var(--red-bg)" : (canSubmitFinal ? "var(--green-bg)" : "var(--amber-bg)"),
          color: overallApproval === "For Revision" ? "var(--brand-dark)" : (canSubmitFinal ? "var(--green)" : "var(--amber)") }}>
          {approvalSummary.total === 0 && <>Upload each Official Receipt / Sales Invoice above, enter its amount and submit. The custodian then reviews every receipt, and {FINAL_APPROVER_NAME} gives the final approval.</>}
          {approvalSummary.total > 0 && overallApproval === "For Revision" && <><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>For Revision</strong> — {approvalSummary.rejected} receipt(s) were rejected. Replace or correct only the rejected receipt(s), then resubmit.</>}
          {approvalSummary.total > 0 && overallApproval === "Pending Approval" && (isDraft
            ? <><strong>Not yet submitted</strong> — submit the liquidation so the custodian can review its {approvalSummary.total} receipt(s).</>
            : <><strong>For Custodian Review</strong> — {approvalSummary.pending} receipt(s) awaiting the custodian's approval.</>)}
          {canSubmitFinal && (review.checked
            ? <><Check size={13} style={{ verticalAlign: "-2px" }} /> <strong>Custodian approved</strong>{review.final ? ` — final approval given by ${review.finalBy || FINAL_APPROVER_NAME}.` : ` — goes to ${FINAL_APPROVER_NAME} for final approval once the cash is settled.`}</>
            : <><Check size={13} style={{ verticalAlign: "-2px" }} /> <strong>All receipts approved</strong> — awaiting the custodian's approval of the liquidation.</>)}
        </div>
      </Collapsible>

      {/* Cash Settlement — collapsible, open by default since it drives completion.
          The one header badge is the settlement status (the duplicate inside was dropped). */}
      <Collapsible title="Reconciliation & Cash Settlement" defaultOpen right={<Badge status={st.settled ? "SETTLED" : "UNSETTLED"} />}>
        {!settleReady && !st.entries.length ? (
          /* Nothing is owed until the receipts are final, so instead of an
             "amount due" this shows exactly what is still missing. */
          <div className="pcp-stl-banner tone-gray">
            <div className="pcp-stl-top">
              <div className="pcp-stl-head">Waiting for receipts</div>
              {!st.settled && <SettlementDueChip dueDate={settleDue.dueDate} daysLeft={settleDue.daysLeft} />}
            </div>
            <div className="pcp-stl-sub">
              The cash settlement is worked out once every receipt has an amount and has been approved by the custodian.
              {" "}{peso(st.released)} was released.
            </div>
            <ul className="pcp-stl-check">
              {[
                [receiptSummary.docCount > 0, "At least one supporting document uploaded"],
                [receiptSummary.docCount > 0 && receiptSummary.missing === 0, "Every document has a receipt amount"],
                [approvalSummary.allApproved, "Every receipt approved by the custodian"],
                [saved, "Worksheet saved"],
              ].map(([ok, text]) => (
                <li key={text} className={ok ? "ok" : ""}>{ok ? <Check size={12} /> : <span className="box" />} {text}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={"pcp-stl-banner tone-" + settleTone}>
            <div className="pcp-stl-top">
              <div className="pcp-stl-head">{settleHeadline}</div>
              {settleDue.owing && <SettlementDueChip dueDate={settleDue.dueDate} daysLeft={settleDue.daysLeft} />}
            </div>
            <div className="pcp-stl-sub pcp-num">
              {peso(st.released)} released − {peso(st.receiptTotal)} approved receipts ={" "}
              <strong>{st.difference < 0 ? "−" : ""}{peso(Math.abs(st.difference))}</strong>
              {" · "}<strong>{settlementOwes(st.type)}</strong>
            </div>
          </div>
        )}

        {/* Expected / paid / outstanding and the recorded movements. Hidden
            while waiting for receipts — until then there is nothing to record. */}
        {st.type !== "exact" && (settleReady || st.entries.length > 0) && (
          <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>
              <div>
                <div className="pcp-kpi-label">{st.type === "excess" ? "Expected Return" : "Expected Reimbursement"}</div>
                <div className="pcp-num" style={{ fontWeight: 700, fontSize: 14 }}>{peso(st.expected)}</div>
              </div>
              <div>
                <div className="pcp-kpi-label">{st.type === "excess" ? "Returned so far" : "Paid so far"}</div>
                <div className="pcp-num" style={{ fontWeight: 700, fontSize: 14 }}>{peso(st.actual)}</div>
              </div>
              <div>
                <div className="pcp-kpi-label">
                  {st.remaining > 0 ? "Still outstanding" : st.remaining < 0 ? "Overpaid by" : "Remaining"}
                </div>
                <div className="pcp-num" style={{ fontWeight: 700, fontSize: 14, color: st.remaining === 0 ? "var(--green)" : "var(--brand)" }}>
                  {peso(Math.abs(st.remaining))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                {/* Only while cash is still DUE. Recording another movement on an
                    already over-settled liquidation would just deepen the error;
                    the fix there is to clear and re-record. */}
                {st.remaining > 0 && canSettle && (
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-primary"
                    onClick={() => setShowRecord(true)}
                    disabled={!saved || !settleReady}
                    title="Record cash that has actually changed hands"
                  >
                    <Check size={12} /> {st.type === "excess" ? "Record Cash Returned" : "Record Reimbursement Paid"}
                  </button>
                )}
                {/* Offered whenever cash is still due, not only on a part
                    payment: a requestor who returns NOTHING leaves the full
                    amount outstanding and that needs the same resolution. */}
                {st.remaining > 0 && !st.closed && canApproveShortage && !finalLocked && (
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-danger"
                    onClick={() => setShowReceivable(true)}
                    title="Accept the outstanding balance as a receivable from the requestor so this liquidation can complete"
                  >
                    <AlertTriangle size={12} /> Close {peso(st.remaining)} as Receivable
                  </button>
                )}
                {!!st.entries.length && canSettle && (
                  <button className="pcp-btn pcp-btn-sm" onClick={handleUndoSettlement}>
                    <X size={12} /> Clear Settlement
                  </button>
                )}
              </div>
            </div>

            {/* Why the Record button is disabled, spelled out instead of hidden in a tooltip. */}
            {st.remaining > 0 && canSettle && (!saved || !settleReady) && (
              <ul className="pcp-stl-check" style={{ marginTop: 10 }}>
                {[
                  [saved, "Worksheet saved"],
                  [receiptSummary.docCount > 0 && receiptSummary.missing === 0, "Every document has a receipt amount"],
                  [approvalSummary.allApproved, "Every receipt approved by the custodian"],
                ].map(([ok, text]) => (
                  <li key={text} className={ok ? "ok" : ""}>{ok ? <Check size={12} /> : <span className="box" />} {text}</li>
                ))}
              </ul>
            )}
            {st.remaining > 0 && !canSettle && !finalLocked && (
              <div style={{ fontSize: 11, color: "var(--text-mut)", marginTop: 8 }}>
                The PCF Custodian records the settlement once the cash has physically changed hands.
              </div>
            )}

            {/* Every movement, so two payments a week apart both stay visible
                with who took them in, how, and why the first fell short. */}
            {!!st.entries.length && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <div className="pcp-kpi-label" style={{ marginBottom: 4 }}>Recorded movements</div>
                {st.entries.map((e, i) => (
                  <div key={e.id || i} className="pcp-stl-entry">
                    <span className="pcp-num" style={{ fontWeight: 700, minWidth: 90 }}>{peso(e.amount)}</span>
                    <span>{e.date ? fmtDate(e.date) : "—"}</span>
                    <span className="pcp-badge pcp-badge-gray">{e.mode || "Cash"}</span>
                    {e.reference && <span>Ref {e.reference}</span>}
                    <span style={{ color: "var(--text-mut)" }}>
                      {e.receivedBy ? `received by ${e.receivedBy} · ` : ""}recorded by {e.recordedBy || "—"}
                      {e.legacy ? " (recorded before movements were itemised)" : ""}
                    </span>
                    {e.reason && <span style={{ color: "var(--text-mut)" }}>· {e.reason}</span>}
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      {e.ackFile && <AttachmentLinks att={e.ackFile} />}
                      <button className="pcp-btn pcp-btn-sm" onClick={() => printSettlementSlip(disbursement, st, e)} title="Print acknowledgment slip for signing">
                        <Printer size={12} /> Slip
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!st.entries.length && (
              <div style={{ fontSize: 11, color: "var(--text-mut)", marginTop: 7 }}>
                Record this only once the cash has physically changed hands. The liquidation stays <strong>NOT YET LIQUIDATED</strong> until then.
                Part payments are fine — each one is recorded separately and the balance is carried.
              </div>
            )}
          </div>
        )}

        {/* An unrecovered balance. This is the case the module had no answer
            for: the liquidation was blocked indefinitely and the missing cash
            was recorded nowhere, so it could not be chased or reported. */}
        {st.variance === "short" && !st.closed && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--brand-dark)", fontSize: 12 }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} />{" "}
            <strong>CASH SHORTAGE: {peso(st.remaining)} of the {peso(st.expected)} due has not been {st.type === "excess" ? "returned" : "paid"}.</strong>
            <div style={{ marginTop: 3 }}>
              Record the balance above when it comes in. If it will not be recovered, it has to be
              accepted as a receivable from the requestor before this liquidation can complete —
              {canApproveShortage
                ? " use Close as Receivable above."
                : " a Custodian, Finance, Accounting or the System Administrator must do that."}
            </div>
          </div>
        )}

        {/* A closed shortage stays on screen permanently — the status reads
            LIQUIDATED (SHORT), never plain LIQUIDATED. */}
        {st.closed && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong>Shortage of {peso(st.closure.shortageAmount)} closed — {st.closure.treatment}</strong>
                <div style={{ color: "var(--text-mut)", marginTop: 3 }}>
                  {st.closure.closedBy} · {(st.closure.closedAt || "").replace("T", " ")}
                  {st.closure.reason ? ` · "${st.closure.reason}"` : ""}
                </div>
              </div>
              {canApproveShortage && !finalLocked && (
                <button className="pcp-btn pcp-btn-sm" onClick={handleReopenShortage}>
                  <X size={12} /> Reopen Shortage
                </button>
              )}
            </div>
          </div>
        )}

        {/* More cash moved than was due. Blocked rather than closed: an
            overpayment is a different problem from a shortage and correcting
            the movement is the right answer, not accepting it. */}
        {st.variance === "over" && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--brand-dark)", fontSize: 12 }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} />{" "}
            <strong>OVER-SETTLED by {peso(Math.abs(st.remaining))}.</strong>{" "}
            {peso(st.actual)} was recorded against {peso(st.expected)} due. Correct the recorded
            movements — use Clear Settlement and re-record — before this liquidation can complete.
          </div>
        )}

        {/* Over-liquidation must be investigated by an approver — it can never
            settle automatically. */}
        {st.needsReview && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--brand-dark)", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> <strong>WARNING: total receipt amount exceeds the PCF released amount by {peso(st.expected)}.</strong>
                <div style={{ marginTop: 3 }}>
                  {st.reviewed
                    ? <>Reviewed by {st.settlement.reviewedBy} · {(st.settlement.reviewedAt || "").replace("T", " ")}{st.settlement.reviewRemarks ? ` · "${st.settlement.reviewRemarks}"` : ""}</>
                    : <>This liquidation will not be approved automatically. A reviewer must investigate the discrepancy before it can be liquidated.</>}
                </div>
              </div>
              {canApproveReceipts && !st.reviewed && !finalLocked && (
                <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={handleReview}>
                  <ShieldCheck size={12} /> Record Review
                </button>
              )}
            </div>
          </div>
        )}

        {/* Final verdict. */}
        <div style={{ marginTop: 12, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", paddingTop: 11, borderTop: "1px solid var(--line)" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Liquidation Status</span>
          <Badge status={finalStatus} />
          <span style={{ fontSize: 11.5, color: "var(--text-mut)" }}>
            {finalStatus === "LIQUIDATED" && (st.type === "exact"
              ? <>Receipts match the cash released exactly — no cash settlement was required.</>
              : st.type === "excess"
                ? <>{peso(st.actual)} in excess cash was returned to the PCF Custodian.</>
                : <>{peso(st.actual)} was reimbursed to the PCF Requestor.</>)}
            {finalStatus === "Under Review" && <>Awaiting a reviewer's findings on the over-liquidation.</>}
            {finalStatus === "For Revision" && <>{approvalSummary.rejected} receipt(s) were rejected — correct them and re-save.</>}
            {finalStatus === "Not Liquidated" && <>No supporting documents uploaded yet.</>}
            {finalStatus === "FOR CUSTODIAN REVIEW" && <>Submitted — awaiting the custodian's review of the receipts and approval of the liquidation.</>}
            {finalStatus === "FOR FINAL APPROVAL" && <>Custodian approved and cash settled — awaiting final approval by {FINAL_APPROVER_NAME}.</>}
            {finalStatus === "NOT YET LIQUIDATED" && (
              !receiptSummary.complete ? <>Capture the receipt amount on every supporting document.</>
                : !approvalSummary.allApproved ? <>Submit the liquidation for the custodian's review.</>
                  : <>{st.type === "excess" ? `${peso(st.expected)} in excess cash must be returned to the PCF Custodian.` : `${peso(st.expected)} must be reimbursed to the PCF Requestor.`}</>
            )}
            {finalStatus === "PARTIALLY SETTLED" && (
              <>{peso(st.actual)} of {peso(st.expected)} {st.type === "excess" ? "returned" : "paid"} — <strong>{peso(st.remaining)} still outstanding.</strong> Record the balance when it comes in, or have it closed as a receivable.</>
            )}
            {finalStatus === "OVER-SETTLED" && (
              <>{peso(st.actual)} recorded against {peso(st.expected)} due — {peso(Math.abs(st.remaining))} too much. Correct the recorded movements.</>
            )}
            {finalStatus === "LIQUIDATED (SHORT)" && (
              <>Completed with {peso(st.remaining)} unrecovered — {st.closure.treatment}, closed by {st.closure.closedBy}.</>
            )}
          </span>
        </div>
      </Collapsible>

      {/* Main working area — the expense/receipt table is the primary surface. */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 12 }}>
      <div className="pcp-section-title" style={{ margin: "0 0 10px" }}>Expense / Liquidation Details</div>
      {/* Says why the save is blocked BEFORE the button is pressed, and keeps
          saying it while the row is short. Only complete lines are stored, so
          without this the row would simply vanish on save. */}
      {!!incompleteLines.length && (
        <div
          style={{
            border: "1px solid var(--brand)", borderRadius: 8, padding: "10px 12px",
            marginBottom: 10, fontSize: 12.5, lineHeight: 1.55,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--brand)" }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} />{" "}
            This liquidation cannot be saved yet
          </div>
          <div style={{ marginTop: 4 }}>
            {incompleteLines.map((x) => (
              <div key={x.id}>Line {x.row} is missing <b>{x.missing.join(" and ")}</b>.</div>
            ))}
          </div>
          <div style={{ marginTop: 4, color: "var(--text-mut)" }}>
            Every expense line needs an Expense description and an Amount greater than zero.
            Fill those in, or delete the line.
          </div>
        </div>
      )}
      <div className="pcp-liq-line-head">
        <div>Date</div>
        <div>Expense <span style={{ color: "var(--brand)" }}>*</span></div>
        <div>Expense Category (COA)</div><div>Department</div><div>Tax Category</div>
        <div>Amount <span style={{ color: "var(--brand)" }}>*</span></div>
        <div></div>
      </div>
      {lines.map((l) => {
        const missing = incompleteById[l.id] || [];
        return (
        <div className="pcp-liq-line" key={l.id}>
          <input type="date" className="pcp-input" value={l.date} onChange={(e) => updateLine(l.id, { date: e.target.value })} />
          <input
            className="pcp-input" placeholder="e.g. Meals, Fuel, Toll Fee"
            value={l.expense} onChange={(e) => updateLine(l.id, { expense: e.target.value })}
            style={missing.includes("Expense") ? MISSING_FIELD_STYLE : undefined}
            title={missing.includes("Expense") ? "Required — this line will not save without it" : undefined}
          />
          <SearchSelect
            value={l.category} onChange={(v) => updateLine(l.id, { category: v })}
            options={EXPENSE_CATEGORY_CHOICES}
            placeholder="— Select Expense Category —"
            searchPlaceholder="Search expense category / COA…"
            popStyle={{ minWidth: 340 }}
          />
          <SearchSelect
            value={l.department} onChange={(v) => updateLine(l.id, { department: v })}
            options={DEPARTMENT_CHOICES}
            placeholder="— Select Department —"
            searchPlaceholder="Search department or sub-account…"
            popStyle={{ minWidth: 300 }}
          />
          <SearchSelect
            value={l.taxCategory || ""} onChange={(v) => updateLine(l.id, { taxCategory: v })}
            options={TAX_CATEGORY_CHOICES}
            placeholder="— None —" emptyOptionLabel="— None —"
            searchPlaceholder="Search tax category…"
            popStyle={{ minWidth: 300 }}
          />
          <input
            type="number" min="0" step="0.01" className="pcp-input" placeholder="0.00"
            value={l.amount} onChange={(e) => updateLine(l.id, { amount: e.target.value })}
            style={missing.includes("Amount") ? MISSING_FIELD_STYLE : undefined}
            title={missing.includes("Amount") ? "Required — this line will not save without it" : undefined}
          />
          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => removeLine(l.id)} disabled={lines.length === 1}>
            <Trash2 size={13} color="var(--brand)" />
          </button>
        </div>
        );
      })}
      {/* The encoded lines add up right here, under the Amount column, so the
          preparer can check the total against the cash released without
          opening the Automated Computation panel or adding up by hand. */}
      <div className="pcp-liq-line-total">
        <div className="lbl">Total Expense Amount ({validLines.length} line{validLines.length === 1 ? "" : "s"})</div>
        <div className="pcp-num val">{peso(total)}</div>
        <div></div>
      </div>
      <button className="pcp-btn pcp-btn-sm" onClick={addLine} style={{ marginTop: 10 }}><Plus size={12} /> Add Receipt Line</button>

      {/* Supporting documents */}
      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="pcp-section-title" style={{ margin: 0 }}>
            <Receipt size={15} color="#c8102e" /> Supporting Documents
            <span style={{ fontSize: 11.5, color: "var(--text-mut)", fontWeight: 500, marginLeft: 6 }}>
              ({attachments.length}) — official receipts, sales invoices, etc. · Total Receipt Amount <strong className="pcp-num">{peso(receiptSummary.approvedTotal)}</strong>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canDecideReceipts && approvalSummary.total > 0 && approvalSummary.pending > 0 && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={approveAllReceipts} title="Approve all pending receipts as custodian">
                <Check size={12} /> Approve All ({approvalSummary.pending})
              </button>
            )}
            <label
              className="pcp-btn pcp-btn-sm"
              style={{ cursor: amountsLocked ? "not-allowed" : "pointer", margin: 0, opacity: amountsLocked ? 0.5 : 1 }}
              title={amountsLocked ? "This liquidation has been submitted — ask a receipt approver to reopen it." : "Attach a supporting document"}
            >
              <Download size={12} style={{ transform: "rotate(180deg)" }} /> Upload
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                disabled={amountsLocked}
                onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
          </div>
        </div>

        {uploadNote && (
          <div style={{ background: "var(--amber-bg)", color: "var(--amber)", fontSize: 11.5, padding: "8px 11px", borderRadius: 8, marginBottom: 10 }}>
            {uploadNote}
          </div>
        )}

        {dupNote && (
          <div style={{ background: "var(--red-bg)", color: "var(--brand-dark)", fontSize: 11.5, padding: "8px 11px", borderRadius: 8, marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <span><AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> {dupNote}</span>
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => setDupNote("")} title="Dismiss"><X size={12} /></button>
          </div>
        )}

        {attachments.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {attachments.map((a) => {
              const pa = persistedById(a.id);
              const status = (pa && pa.approvalStatus) || a.approvalStatus || "Pending";
              const history = (pa && pa.approvalHistory) || a.approvalHistory || [];
              const amtHistory = (pa && pa.amountHistory) || a.amountHistory || [];
              const isSaved = !!pa;
              /* General supporting documents carry no peso figure, so their
                 amount and reference number stay optional. */
              const needsAmount = docRequiresAmount(a);
              const amountMissing = needsAmount && status !== "Rejected" && !(Number(a.receiptAmount) > 0);
              const isImage = (a.type || "").startsWith("image");
              const isPdf = (a.type || "").includes("pdf");
              return (
              <div key={a.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={15} color="#2054a3" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                      {(a.size / 1024).toFixed(0)} KB · {(a.type || "file")} · uploaded {fmtDate(a.uploadedAt)}
                    </div>
                  </div>
                  <Badge status={status} />
                  <AttachmentLinks att={a} />
                  {canDecideReceipts && isSaved && (
                    <>
                      <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => approveReceipt(a)} disabled={status === "Approved"} title="Approve receipt"><Check size={12} /></button>
                      <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => rejectReceipt(a)} disabled={status === "Rejected"} title="Reject receipt"><X size={12} /></button>
                    </>
                  )}
                  <button
                    className="pcp-btn pcp-btn-sm pcp-btn-ghost"
                    onClick={() => removeAttachment(a.id)}
                    disabled={amountsLocked}
                    title={amountsLocked ? "This liquidation has been submitted" : "Remove"}
                  ><Trash2 size={13} color="var(--brand)" /></button>
                </div>

                {/* Receipt Amount is captured against THIS document, so the
                    liquidation total is always the sum of its own documents and
                    each receipt stays independently auditable. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
                  <div style={{ minWidth: 200 }}>
                    <div className="pcp-kpi-label">Document Type</div>
                    <select
                      className="pcp-select" value={a.docType || DEFAULT_DOC_TYPE} disabled={amountsLocked}
                      onChange={(e) => updateAttachment(a.id, { docType: e.target.value })}
                    >
                      {RECEIPT_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ minWidth: 145 }}>
                    <div className="pcp-kpi-label">
                      Receipt / Invoice No. <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(optional)</span>
                    </div>
                    <input
                      className="pcp-input" placeholder={needsAmount ? "e.g. OR-1234" : "—"} value={a.receiptNo || ""} readOnly={amountsLocked}
                      onChange={(e) => updateAttachment(a.id, { receiptNo: e.target.value })}
                    />
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <div className="pcp-kpi-label">
                      Receipt Amount (&#8369;) {needsAmount
                        ? <span style={{ color: "var(--brand)" }}>*</span>
                        : <span style={{ color: "var(--text-mut)", fontWeight: 500 }}>(optional)</span>}
                    </div>
                    <input
                      type="number" min="0" step="0.01" className="pcp-input"
                      placeholder={needsAmount ? "0.00" : "—"}
                      value={a.receiptAmount == null ? "" : a.receiptAmount}
                      readOnly={amountsLocked}
                      onChange={(e) => setReceiptAmount(a.id, e.target.value)}
                      style={amountMissing ? { borderColor: "var(--brand)" } : undefined}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 130, textAlign: "right" }}>
                    <div className="pcp-kpi-label">Counted in Total</div>
                    <div className="pcp-num" style={{ fontWeight: 700, color: status === "Approved" ? "var(--green)" : "var(--text-mut)" }}>
                      {status === "Approved" ? peso(receiptAmountOf(a)) : "—"}
                    </div>
                  </div>
                </div>
                {amountMissing && (
                  <div style={{ fontSize: 10.5, color: "var(--brand)", marginTop: 5 }}>
                    Receipt amount is required before this liquidation can be submitted.
                  </div>
                )}
                {!needsAmount && !(Number(a.receiptAmount) > 0) && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5 }}>
                    No amount needed for a general supporting document. Enter one only if this document shows a peso amount that forms part of the liquidation.
                  </div>
                )}
                {status !== "Approved" && status !== "Rejected" && Number(a.receiptAmount) > 0 && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5 }}>
                    Excluded from the total until the custodian approves this document.
                  </div>
                )}
                {amountsLocked && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 5 }}>
                    {finalLocked
                      ? "Read-only — this liquidation has final approval."
                      : "Read-only — this liquidation has been submitted. The custodian can reopen it or correct the amount."}
                  </div>
                )}

                {/* Inline preview — the receipt is visible directly on the page,
                    no "View" click needed (mirrors the reimbursement module). */}
                <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#f4f6f9" }}>
                  <AttachmentPreview att={a} isImage={isImage} isPdf={isPdf} />
                </div>

                {canDecideReceipts && !isSaved && (
                  <div style={{ fontSize: 10.5, color: "var(--amber)", marginTop: 5 }}>Save the liquidation to enable approval of this receipt.</div>
                )}
                {history.length > 0 && (
                  <div style={{ marginTop: 7, borderTop: "1px dashed var(--line)", paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mut)", marginBottom: 3 }}>Approval History</div>
                    {history.map((h, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                        <strong style={{ color: h.status === "Rejected" ? "var(--brand)" : "var(--green)" }}>{h.status}</strong> by {h.approver} · {h.ts.replace("T", " ")}{h.remarks ? ` · "${h.remarks}"` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {/* Receipt-amount audit trail, tied to this document. */}
                {amtHistory.length > 0 && (
                  <div style={{ marginTop: 7, borderTop: "1px dashed var(--line)", paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mut)", marginBottom: 3 }}>Receipt Amount History</div>
                    {amtHistory.map((h, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                        {h.prevAmount == null ? <>Set to <strong>{peso(h.newAmount)}</strong></> : <>{peso(h.prevAmount)} → <strong>{peso(h.newAmount)}</strong></>}
                        {" "}by {h.user} · {(h.ts || "").replace("T", " ")}{h.reason ? ` · "${h.reason}"` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}

            {/* Total is recalculated from the document rows above. */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, borderTop: "2px solid var(--line)", paddingTop: 10, flexWrap: "wrap" }}>
              <div style={{ textAlign: "right" }}>
                <div className="pcp-kpi-label">All Documents</div>
                <div className="pcp-num" style={{ fontWeight: 700 }}>{peso(receiptSummary.allTotal)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="pcp-kpi-label">Total Receipt Amount (approved only)</div>
                <div className="pcp-num" style={{ fontWeight: 700, fontSize: 15 }}>{peso(receiptSummary.approvedTotal)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-mut)", padding: "10px 0" }}>
            No documents attached yet. Click <strong>Upload</strong> to attach scanned receipts or invoices (images or PDF, up to 2 MB each).
          </div>
        )}
      </div>

      {remaining < 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", background: "var(--red-bg)", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "var(--brand-dark)" }}>
          <AlertTriangle size={15} /> The encoded expense lines ({peso(total)}) exceed the cash advance by {peso(Math.abs(remaining))}. Check them against the Cash Settlement above, which is computed from the approved receipt amounts.
        </div>
      )}
      </div>

      {showReject && (
        <RejectLiquidationModal
          voucherNo={disbursement.voucherNo}
          employee={disbursement.employee}
          onClose={() => setShowReject(false)}
          onConfirm={handleConfirmReject}
        />
      )}
      {showRecord && (
        <RecordSettlementModal
          disbursement={disbursement} st={st} currentUser={currentUser}
          onClose={() => setShowRecord(false)}
          onConfirm={handleRecordSettlement}
        />
      )}
      {showReceivable && (
        <CloseReceivableModal
          disbursement={disbursement} amount={st.remaining}
          onClose={() => setShowReceivable(false)}
          onConfirm={handleCloseShortage}
        />
      )}
    </div>
  );
}

/* ---- Reimbursement liquidation panel (Section 26) ----
   Approved reimbursements are handed off to the Liquidation Module carrying
   their reference, employee, department, plant, expense lines, documents and
   approval history — nothing is re-entered. Finance processes the liquidation
   through FOR LIQUIDATION → UNDER REVIEW → LIQUIDATION COMPLETED, then payment. */
function ReimbursementLiquidationPanel({ reimb, canFinance, onAction }) {
  const [comments, setComments] = useState("");
  const approved = reimbTotal(reimb);
  /* For a reimbursement the validated expense equals the approved line items,
     so the variance is normally zero. */
  const validated = reimbTotal(reimb);
  const variance = round2(approved - validated);
  const st = reimb.status;
  const act = (action) => { onAction(reimb.id, action, { comments }); setComments(""); };

  return (
    <div>
      <div className="pcp-liq-sticky">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="pcp-eyebrow">Source: Employee Reimbursement · {reimb.reimbNo}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{reimb.employee}</div>
            <div style={{ fontSize: 12, color: "var(--text-mut)", marginTop: 2 }}>
              {subaccountLabel(reimb.department)} · {plantLabel(reimb.branchCode)} · {companyOfBranch(reimb.branchCode)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7, flexWrap: "wrap" }}>
              <Badge status={st} />
              <span style={{ fontSize: 10.5, color: "var(--text-mut)" }}>
                Reimbursement Ref: {reimb.reimbNo}{reimb.approvedBy ? ` · approved by ${reimb.approvedBy}` : ""}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canFinance && st === REIMB_STATUS.FOR_LIQUIDATION && (
              <button className="pcp-btn pcp-btn-sm" onClick={() => act("liquidation-review")}><Search size={12} /> Start Review</button>
            )}
            {canFinance && (st === REIMB_STATUS.FOR_LIQUIDATION || st === REIMB_STATUS.UNDER_REVIEW) && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => act("liquidation-complete")}><Check size={12} /> Mark Liquidation Completed</button>
            )}
            {canFinance && st === REIMB_STATUS.LIQUIDATION_DONE && (
              <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => act("for-payment")}><Banknote size={12} /> Move to Payment</button>
            )}
          </div>
        </div>
        <div className="pcp-liq-sticky-grid" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Approved Reimbursement</div><div className="pcp-num">{peso(approved)}</div></div>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Validated Expense</div><div className="pcp-num">{peso(validated)}</div></div>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Variance</div><div className="pcp-num" style={{ color: variance === 0 ? "var(--green)" : "var(--brand)" }}>{peso(variance)}</div></div>
          <div className="pcp-liq-metric"><div className="pcp-kpi-label">Status</div><div><Badge status={st} /></div></div>
        </div>
      </div>

      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 12 }}>
        <div className="pcp-section-title" style={{ margin: "0 0 6px" }}>Expense / Liquidation Details</div>
        <div style={{ fontSize: 12, color: "var(--text-mut)", marginBottom: 10 }}>{reimb.purpose}</div>
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead><tr><th>Date Incurred</th><th>Category</th><th>Description</th><th>Vendor</th><th>Account</th><th>Dept</th><th>Amount</th></tr></thead>
            <tbody>
              {(reimb.lines || []).map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.date)}</td><td>{l.category}</td><td>{l.description}</td>
                  <td>{l.vendor || "—"}</td><td>{l.account || "—"}</td><td>{deptDesc(l.department)}</td>
                  <td className="pcp-num">{peso(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={6} style={{ textAlign: "right", fontWeight: 600 }}>Approved Amount</td><td className="pcp-num" style={{ fontWeight: 700 }}>{peso(approved)}</td></tr></tfoot>
          </table>
        </div>
        {variance !== 0 && (
          <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, fontSize: 12, background: "var(--red-bg)", color: "var(--brand-dark)" }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px" }} /> Variance of {peso(Math.abs(variance))} between the approved reimbursement and the validated expense must be reviewed and resolved before completion.
          </div>
        )}
      </div>

      <Collapsible
        title="Supporting Documents"
        subtitle={`${(reimb.attachments || []).length} file(s) carried forward`}
        defaultOpen
      >
        <AttachmentGallery attachments={reimb.attachments} emptyLabel="None" />
      </Collapsible>

      <Collapsible title="Approval History & Audit Trail" subtitle={`${(reimb.history || []).length} event(s)`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(reimb.history || []).map((h, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--text-mut)" }}>
              {h.ts} · <b>{h.action}</b> · {h.user}{h.prevStatus ? ` · ${h.prevStatus} → ${h.newStatus}` : ""}{h.comments ? ` · "${h.comments}"` : ""}
            </div>
          ))}
          {!(reimb.history || []).length && <div style={{ fontSize: 12, color: "var(--text-mut)" }}>No history yet.</div>}
        </div>
      </Collapsible>

      {canFinance && (st === REIMB_STATUS.FOR_LIQUIDATION || st === REIMB_STATUS.UNDER_REVIEW) && (
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-field" style={{ margin: 0 }}>
            <label>Review Remarks (recorded in the audit trail)</label>
            <textarea className="pcp-input" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional notes for this liquidation review" />
          </div>
        </div>
      )}
    </div>
  );
}

function LiquidationTab({
  disbursements, liquidations, onSaveLiquidation, onExport, onExportAll, plantOptions, plantTitle,
  canApproveReceipts, onDecideReceipt, onSubmitLiquidation, onReopenLiquidation,
  onRecordSettlement, onCloseShortage, onReopenShortage, canApproveShortage,
  onReviewOverLiquidation, canDelete, onDeleteLiquidation,
  canRejectLiquidation, onRejectLiquidation,
  onCheckLiquidation, canFinalApprove, onFinalApprove, currentUser,
  reimbursements, onReimbursementAction, canFinance,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedReimbId, setSelectedReimbId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [plant, setPlant] = useState("ALL");
  const [source, setSource] = useState("pettycash");
  /* One status filter per source. The two workflows have no statuses in common,
     so they are kept separately rather than sharing a value that would be
     meaningless the moment you switch tabs. */
  const [pettyStatus, setPettyStatus] = useState(LIQ_STATUS_FILTER_ALL);
  const [reimbStatus, setReimbStatus] = useState(LIQ_STATUS_FILTER_ALL);
  /* Free-text search, shared by both sources, plus one column sort per source.
     Picking a row opens its worksheet in a resizable pop-up (selectedId). */
  const [search, setSearch] = useState("");
  /* Who-owes-whom filter (petty cash only) — e.g. everyone who still owes cash. */
  const [settleFilter, setSettleFilter] = useState(SETTLEMENT_FILTERS[0]);
  const pettySort = useTableSort("date", "desc");
  const reimbSort = useTableSort("requestDate", "desc");
  /* Unsaved worksheet edits live only in the pop-up, so closing it asks first. */
  const worksheetDirty = useRef(false);
  const closeWorksheet = () => {
    if (worksheetDirty.current && !window.confirm("This liquidation has unsaved changes. Close without saving?")) return;
    worksheetDirty.current = false;
    setSelectedId(null);
  };

  const scoped = plant === "ALL" ? disbursements : disbursements.filter((d) => d.branchCode === plant);
  const enriched = scoped.map((d) => ({
    ...d,
    liqStatus: liqStatusFor(d, liquidations),
    finalStatus: liqFinalStatus(d, liquidationFor(d.id, liquidations)),
    stl: settlementInfo(d, liquidationFor(d.id, liquidations)),
  }));
  /* A voucher stays on the worklist until it is genuinely LIQUIDATED — that is,
     until any refund or reimbursement has actually been settled. Picking an
     explicit status overrides that worklist gate: someone filtering for "Fully
     Liquidated" is asking to see completed work, so "Show completed" no longer
     has to be ticked as well. */
  const q = search.trim().toLowerCase();
  const hit = (...vals) => !q || vals.some((v) => String(v || "").toLowerCase().includes(q));
  /* A settlement filter, like a status filter, overrides the worklist gate. */
  const settleFilterOn = settleFilter !== SETTLEMENT_FILTERS[0];
  const pettyFiltered = (pettyStatus === LIQ_STATUS_FILTER_ALL
    ? (showAll || settleFilterOn ? enriched : enriched.filter((d) => !liqIsComplete(d.finalStatus)))
    : enriched.filter((d) => d.liqStatus === PCA_STATUS_FILTERS[pettyStatus]))
    .filter((d) => hit(d.voucherNo, d.requestNo, d.employee, d.branchCode, plantLabel(d.branchCode),
      subaccountLabel(d.department), disbExpense(d), d.liqStatus, d.finalStatus))
    .filter((d) => settleFilter === SETTLEMENT_FILTERS[0]
      || (settleFilter === "Overdue settlement" ? d.stl.overdue : d.stl.category === settleFilter));
  const list = pettySort.sortRows(pettyFiltered, LIQ_PETTY_SORT_FIELDS);
  /* Looked up in `enriched`, not `list`, so the open pop-up stays put when an
     action moves the voucher out of the current filter (e.g. it completes). */
  const selected = enriched.find((d) => d.id === selectedId) || null;
  const exportableCount = disbursements.filter((d) => {
    const liq = liquidationFor(d.id, liquidations);
    return liq && liq.lines && liq.lines.length;
  }).length;

  /* Reimbursement liquidations (Section 26) — approved reimbursements handed off
     to the Liquidation Module, carrying their reference back to the request. */
  const reimbScoped = (reimbursements || []).filter((r) => plant === "ALL" || r.branchCode === plant);
  const reimbLiq = reimbScoped.filter((r) => REIMB_LIQUIDATION_STATUSES.includes(r.status));
  const reimbFiltered = (reimbStatus === LIQ_STATUS_FILTER_ALL
    ? (showAll ? reimbLiq : reimbLiq.filter((r) => r.status === REIMB_STATUS.FOR_LIQUIDATION || r.status === REIMB_STATUS.UNDER_REVIEW))
    : reimbLiq.filter((r) => r.status === reimbStatusFilter(reimbStatus)))
    .filter((r) => hit(r.reimbNo, r.employee, r.branchCode, plantLabel(r.branchCode),
      subaccountLabel(r.department), r.purpose, r.status));
  const reimbActive = reimbSort.sortRows(reimbFiltered, LIQ_REIMB_SORT_FIELDS);
  const selectedReimb = reimbScoped.find((r) => r.id === selectedReimbId) || null;

  /* An explicit status filter already decides what the list shows, so the
     completed-vs-open toggle is only meaningful on "All statuses". */
  const activeStatus = source === "pettycash" ? pettyStatus : reimbStatus;
  const statusFilterOn = activeStatus !== LIQ_STATUS_FILTER_ALL || (source === "pettycash" && settleFilterOn);
  const pettyCount = list.length;
  const reimbCount = reimbActive.length;

  return (
    <div className="pcp-liq-full">
      <TopBar
        title={(plantTitle ? plantTitle + " \u00b7 " : "") + "Liquidation"}
        sub="Liquidate petty cash advances and approved employee reimbursements in one professional workspace"
        right={
          <button className="pcp-btn pcp-btn-primary" onClick={onExportAll} disabled={!exportableCount}>
            <Download size={14} /> Export All to Acumatica
          </button>
        }
      />
      <div className="pcp-content">
        <PlantScopeTabs plants={plantOptions} value={plant} onChange={(v) => { setPlant(v); setSelectedId(null); setSelectedReimbId(null); }} />

        {/* Source selector — keep petty cash and reimbursement rules separate. */}
        <div className="pcp-tabs" style={{ marginBottom: 14 }}>
          <button className={"pcp-tab" + (source === "pettycash" ? " active" : "")} onClick={() => setSource("pettycash")}>
            Petty Cash Advance ({pettyCount})
          </button>
          <button className={"pcp-tab" + (source === "reimbursement" ? " active" : "")} onClick={() => setSource("reimbursement")}>
            Employee Reimbursement ({reimbCount})
          </button>
          <label style={{ marginLeft: "auto", fontSize: 11.5, display: "flex", alignItems: "center", gap: 5, color: "var(--text-mut)" }}>
            <input
              type="checkbox" checked={showAll} disabled={statusFilterOn}
              onChange={(e) => setShowAll(e.target.checked)}
              title={statusFilterOn ? "Not needed while a status filter is applied" : "Include liquidations that are already complete"}
            /> Show completed
          </label>
        </div>

        {/* Search + status filter — the status options follow the selected source's workflow. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 340 }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
            <input
              className="pcp-input" style={{ paddingLeft: 28 }}
              placeholder={source === "pettycash"
                ? "Search voucher no., employee, plant, department…"
                : "Search reimbursement no., employee, plant, purpose…"}
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterIcon size={14} color="var(--text-mut)" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Status</span>
          <SearchSelect
            value={source === "pettycash" ? pettyStatus : reimbStatus}
            onChange={(v) => {
              if (source === "pettycash") setPettyStatus(v || LIQ_STATUS_FILTER_ALL);
              else setReimbStatus(v || LIQ_STATUS_FILTER_ALL);
              setSelectedId(null); setSelectedReimbId(null);
            }}
            options={(source === "pettycash" ? PCA_STATUS_FILTER_KEYS : REIMB_STATUS_FILTER_KEYS)
              .map((k) => ({ value: k, label: k }))}
            searchPlaceholder="Search status…"
            style={{ width: 240 }}
          />
          {source === "pettycash" && (
            <>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mut)" }}>Settlement</span>
              <select className="pcp-select" style={{ width: 210 }} value={settleFilter} onChange={(e) => setSettleFilter(e.target.value)}>
                {SETTLEMENT_FILTERS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </>
          )}
          {statusFilterOn && (
            <button
              className="pcp-btn pcp-btn-ghost pcp-btn-sm"
              onClick={() => {
                if (source === "pettycash") { setPettyStatus(LIQ_STATUS_FILTER_ALL); setSettleFilter(SETTLEMENT_FILTERS[0]); }
                else setReimbStatus(LIQ_STATUS_FILTER_ALL);
              }}
            ><X size={12} /> Clear</button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-mut)" }}>
            {source === "pettycash"
              ? `${pettyCount} of ${enriched.length} advance(s)`
              : `${reimbCount} of ${reimbLiq.length} reimbursement(s)`}
          </span>
        </div>

        <div className="pcp-card">
          <div className="pcp-table-wrap">
            {source === "pettycash" ? (
              <table className="pcp-table">
                <thead>
                  <tr>
                    <SortTh field="voucherNo" sort={pettySort}>Voucher No.</SortTh>
                    <SortTh field="date" sort={pettySort}>Date</SortTh>
                    <SortTh field="employee" sort={pettySort}>Employee</SortTh>
                    <SortTh field="branchCode" sort={pettySort}>Plant</SortTh>
                    <SortTh field="department" sort={pettySort}>Department</SortTh>
                    <SortTh field="expense" sort={pettySort}>Expense</SortTh>
                    <SortTh field="amount" sort={pettySort} align="right">PCF Released</SortTh>
                    <SortTh field="liqStatus" sort={pettySort}>Liquidation</SortTh>
                    <SortTh field="finalStatus" sort={pettySort}>Settlement</SortTh>
                    <SortTh field="balance" sort={pettySort}>Balance Due</SortTh>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.length ? list.map((d) => (
                    <tr key={d.id} className="pcp-liq-row" onClick={() => setSelectedId(d.id)} title="Open liquidation">
                      <td><strong>{d.voucherNo}</strong></td>
                      <td>{fmtDate(d.date)}</td>
                      <td>{d.employee}</td>
                      <td>{d.branchCode}</td>
                      <td title={subaccountLabel(d.department)} style={LIQ_CLIP_CELL}>{subaccountLabel(d.department)}</td>
                      <td title={disbExpense(d)} style={LIQ_CLIP_CELL}>{disbExpense(d) || "—"}</td>
                      <td className="pcp-num" style={{ textAlign: "right", fontWeight: 700 }}>{peso(d.amount)}</td>
                      <td><Badge status={d.liqStatus} /></td>
                      <td><Badge status={d.finalStatus} /></td>
                      <td>
                        {d.stl.owing ? (
                          <div style={{ lineHeight: 1.3 }}>
                            <div className="pcp-num" style={{ fontWeight: 700, color: d.stl.overdue ? "var(--brand)" : d.stl.st.type === "excess" ? "var(--amber)" : "var(--blue)" }}>
                              {d.stl.st.type === "excess" ? "Return " : "Reimburse "}{peso(d.stl.st.remaining)}
                            </div>
                            <div style={{ fontSize: 10.5, color: d.stl.overdue ? "var(--brand)" : "var(--text-mut)", fontWeight: d.stl.overdue ? 700 : 400 }}>
                              {d.stl.overdue ? `Overdue ${-d.stl.daysLeft}d` : d.stl.daysLeft === 0 ? "Due today" : `Due ${fmtDate(d.stl.dueDate)}`}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-mut)" }}>{d.stl.category === "Waiting for receipts" ? "Awaiting receipts" : "—"}</span>
                        )}
                      </td>
                      <td><button className="pcp-btn pcp-btn-sm" title="Open liquidation"><Eye size={12} /></button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={11} className="pcp-empty">
                      {q
                        ? "No cash advance matches “" + search.trim() + "”"
                        : statusFilterOn
                          ? "No cash advance matches the selected filters"
                          : showAll ? "No vouchers yet" : "Every voucher is fully liquidated and settled"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="pcp-table">
                <thead>
                  <tr>
                    <SortTh field="reimbNo" sort={reimbSort}>Reimb No.</SortTh>
                    <SortTh field="requestDate" sort={reimbSort}>Req Date</SortTh>
                    <SortTh field="employee" sort={reimbSort}>Employee</SortTh>
                    <SortTh field="branchCode" sort={reimbSort}>Plant</SortTh>
                    <SortTh field="department" sort={reimbSort}>Department</SortTh>
                    <SortTh field="purpose" sort={reimbSort}>Purpose</SortTh>
                    <SortTh field="amount" sort={reimbSort} align="right">Amount</SortTh>
                    <SortTh field="status" sort={reimbSort}>Status</SortTh>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reimbActive.length ? reimbActive.map((r) => (
                    <tr key={r.id} className="pcp-liq-row" onClick={() => setSelectedReimbId(r.id)} title="Open reimbursement liquidation">
                      <td><strong>{r.reimbNo}</strong></td>
                      <td>{fmtDate(r.requestDate)}</td>
                      <td>{r.employee}</td>
                      <td>{r.branchCode}</td>
                      <td title={subaccountLabel(r.department)} style={LIQ_CLIP_CELL}>{subaccountLabel(r.department)}</td>
                      <td title={r.purpose || ""} style={LIQ_CLIP_CELL}>{r.purpose || "—"}</td>
                      <td className="pcp-num" style={{ textAlign: "right", fontWeight: 700 }}>{peso(reimbTotal(r))}</td>
                      <td><Badge status={r.status} /></td>
                      <td><button className="pcp-btn pcp-btn-sm" title="Open reimbursement liquidation"><Eye size={12} /></button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={9} className="pcp-empty">
                      {q
                        ? "No reimbursement matches “" + search.trim() + "”"
                        : statusFilterOn
                          ? "No reimbursement has the status " + reimbStatus
                          : showAll ? "No reimbursement liquidations yet" : "No reimbursements awaiting liquidation"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Worksheet pop-up — large by default, resizable from the corner grip. */}
      {source === "pettycash" && selected && (
        <div className="pcp-modal-backdrop" {...backdropCloseProps(closeWorksheet)}>
          <div className="pcp-modal pcp-modal-resizable pcp-liq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pcp-modal-head">
              <h3>Liquidation · {selected.voucherNo} · {selected.employee}</h3>
              <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={closeWorksheet} title="Close"><X size={15} /></button>
            </div>
            <div className="pcp-modal-body">
              <LiquidationWorksheet
                disbursement={selected}
                liquidation={liquidationFor(selected.id, liquidations)}
                onSave={onSaveLiquidation}
                onExport={onExport}
                canApproveReceipts={canApproveReceipts}
                onDecideReceipt={onDecideReceipt}
                liquidations={liquidations}
                disbursements={disbursements}
                onSubmitLiquidation={onSubmitLiquidation}
                onReopenLiquidation={onReopenLiquidation}
                onRecordSettlement={onRecordSettlement}
                onCloseShortage={onCloseShortage}
                onReopenShortage={onReopenShortage}
                canApproveShortage={canApproveShortage}
                onReviewOverLiquidation={onReviewOverLiquidation}
                canDelete={canDelete}
                onDeleteLiquidation={onDeleteLiquidation}
                canRejectLiquidation={canRejectLiquidation}
                onRejectLiquidation={onRejectLiquidation}
                onCheckLiquidation={onCheckLiquidation}
                canFinalApprove={canFinalApprove}
                onFinalApprove={onFinalApprove}
                currentUser={currentUser}
                onDirtyChange={(d) => { worksheetDirty.current = d; }}
              />
            </div>
            <ModalResizeGrip />
          </div>
        </div>
      )}
      {source === "reimbursement" && selectedReimb && (
        <div className="pcp-modal-backdrop" {...backdropCloseProps(() => setSelectedReimbId(null))}>
          <div className="pcp-modal pcp-modal-resizable pcp-liq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pcp-modal-head">
              <h3>Reimbursement Liquidation · {selectedReimb.reimbNo} · {selectedReimb.employee}</h3>
              <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={() => setSelectedReimbId(null)} title="Close"><X size={15} /></button>
            </div>
            <div className="pcp-modal-body">
              <ReimbursementLiquidationPanel reimb={selectedReimb} canFinance={canFinance} onAction={onReimbursementAction} />
            </div>
            <ModalResizeGrip />
          </div>
        </div>
      )}
    </div>
  );
}
