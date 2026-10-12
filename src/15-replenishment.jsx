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
      checkedBy: custodianCheckerLabel(rv), checkedAt: rv.checkedAt, finalBy: rv.finalBy, finalAt: rv.finalAt, amount: x.amount,
      date: x.disb.date || "",
    };
  });
  const reimbs = reimbursementsReadyForReplenishment(reimbursements, replenishments, exceptReplenishmentId).map((x) => {
    const rv = reimbReview(x.reimb);
    return {
      kind: "reimb", id: x.reimb.id, ref: x.reimb.reimbNo, employee: x.reimb.employee, branchCode: x.reimb.branchCode,
      checkedBy: custodianCheckerLabel(rv), checkedAt: rv.checkedAt, finalBy: rv.finalBy, finalAt: rv.finalAt, amount: x.amount,
      date: x.reimb.requestDate || "",
    };
  });
  return liqs.concat(reimbs);
}

/* The Ready for Replenishment list as a Report Center document, so it prints
   (A4 / Save as PDF) and exports to Excel with the same letterhead, reference
   no. and signature block as every other report. Grouped by plant with the
   fund custodian and a subtotal each — one replenishment per fund. */
function readyReplenishmentDoc(readyByPlant, funds, plantTitle, generatedBy, scopeNote) {
  const col = (key, label, opt = {}) => ({ key, label, align: opt.align || (opt.money ? "right" : "left"), money: !!opt.money, width: opt.width });
  const columns = [
    col("kind", "Type"), col("ref", "Voucher / Reimb No."), col("date", "Txn Date"),
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
      rows.push({ kind: readyKindLabel(x), ref: x.ref, date: x.date ? fmtDate(x.date) : "—",
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

/* ---- Replenishment details (owner's instruction, Oct 2026) ----
   Everything one replenishment claimed — its liquidations (liquidationIds) and
   reimbursements (reimbursementIds) — read from the records as saved now, with
   each transaction's expense lines and approval stamps. Only claims of the
   replenishment's own plant count; a claim that is gone or out of scope is
   reported, never guessed at. Read-only: nothing here writes a record. */
function replenishmentDetail(r, disbursements, liquidations, reimbursements) {
  const plant = plantOfBranch(r.branchCode);
  const txns = [];
  let missing = 0;
  (r.liquidationIds || []).forEach((id) => {
    const liq = (liquidations || []).find((l) => l.id === id);
    const disb = liq && (disbursements || []).find((d) => d.id === liq.disbursementId);
    if (!liq || !disb || plantOfBranch(disb.branchCode) !== plant) { missing++; return; }
    txns.push({
      key: "liq:" + id, kind: "Liquidation", ref: disb.voucherNo, employee: disb.employee,
      branchCode: disb.branchCode, date: String(disb.date || "").slice(0, 10), rv: liqReview(liq),
      amount: receiptAmountSummary(liq).approvedTotal,
      lines: (liq.lines || []).map((l) => ({
        date: l.date, description: (l.expense && l.expense.trim()) || l.category || "", category: l.category || "",
        account: accountForCategory(l.category), dept: l.department || "", amount: Number(l.amount) || 0,
      })),
    });
  });
  (r.reimbursementIds || []).forEach((id) => {
    const rb = (reimbursements || []).find((x) => x.id === id);
    if (!rb || plantOfBranch(rb.branchCode) !== plant) { missing++; return; }
    txns.push({
      key: "reimb:" + id, kind: "Reimbursement", ref: rb.reimbNo, employee: rb.employee,
      branchCode: rb.branchCode, date: String(rb.requestDate || "").slice(0, 10), rv: reimbReview(rb),
      amount: round2(reimbTotal(rb)),
      lines: (rb.lines || []).map((l) => ({
        date: l.date, description: [l.description, l.vendor].filter(Boolean).join(" · ") || l.category || "", category: l.category || "",
        account: l.account || accountForCategory(l.category), dept: l.department || "", amount: reimbLineAmount(l),
      })),
    });
  });
  txns.sort((a, b) => a.date.localeCompare(b.date) || String(a.ref).localeCompare(String(b.ref)));
  const batches = [...new Set(txns.map((x) => x.rv.batchNo).filter(Boolean).map(normalizeBatchNo))].sort();
  return {
    txns, missing, batches,
    period: fmtBatchPeriod(txns.map((x) => x.date)),
    total: round2(txns.reduce((s, x) => s + x.amount, 0)),
  };
}

const replStamp = (by, at) => (by ? `${by}${at ? " · " + fmtDate(String(at).slice(0, 10)) : ""}` : "—");

/* One replenishment as a Report Center document: letterhead, meta block,
   each transaction with its expense lines and approvals, a subtotal per
   transaction and the grand total. Prints to A4 / Save as PDF. */
function replenishmentDetailDoc(r, detail, funds, generatedBy) {
  const col = (key, label, opt = {}) => ({ key, label, align: opt.align || (opt.money ? "right" : "left"), money: !!opt.money, width: opt.width });
  const columns = [
    col("date", "Date"), col("description", "Description", { width: "26%" }), col("category", "Account Classification", { width: "20%" }),
    col("account", "GL Account"), col("dept", "Sub-account"), col("amount", "Amount", { money: true }),
  ];
  const rows = [];
  detail.txns.forEach((x) => {
    rows.push({ _group: true, date: `${x.kind} ${x.ref} — ${x.employee} · ${plantLabel(x.branchCode) || x.branchCode}`
      + ` · Custodian approved: ${replStamp(custodianCheckerLabel(x.rv), x.rv.checkedAt)}`
      + ` · Accounting checked: ${replStamp(acctCheckerLabel(x.rv), x.rv.acctCheckedAt)}${x.rv.batchNo ? " (" + normalizeBatchNo(x.rv.batchNo) + ")" : ""}`
      + ` · Final approval: ${replStamp(x.rv.finalBy, x.rv.finalAt)}` });
    x.lines.forEach((l) => rows.push({
      date: l.date ? fmtDate(l.date) : "—", description: l.description, category: l.category || "—",
      account: l.account || "—", dept: l.dept ? `${l.dept} — ${deptDesc(l.dept)}` : "—", amount: l.amount,
    }));
    const linesTotal = round2(x.lines.reduce((s, l) => s + l.amount, 0));
    rows.push({ _subtotal: true, date: `Subtotal — ${x.ref} (approved amount)`
      + (linesTotal !== x.amount ? ` · expense lines total ${peso(linesTotal)}` : ""), amount: x.amount });
  });
  const totalsRow = { _total: true, date: `GRAND TOTAL — ${detail.txns.length} transaction(s)`, amount: detail.total };
  const fund = (funds || []).find((f) => f.branchCode === plantOfBranch(r.branchCode));
  const company = companyOfBranch(r.branchCode);
  const profile = companyProfile(company);
  const recorded = round2(Number(r.amount) || 0);
  return {
    title: "Replenishment Report", orientation: "landscape", columns, rows, totalsRow, count: detail.txns.length,
    meta: {
      "Replenishment No.": r.replenishmentNo,
      "Plant": `${plantLabel(r.branchCode)} (${r.branchCode})`,
      "Company": company || "—",
      "Custodian": (fund && fund.custodian) || "—",
      "Replenishment Date": r.date ? fmtDate(r.date) : "—",
      "Covered Period": detail.period,
      ...(detail.batches.length ? { "Batch": detail.batches.join(", ") } : {}),
      "Status": r.status || "—",
      "Prepared By": r.preparedBy || "—",
      "Replenishment Amount": peso(recorded),
      ...(recorded !== detail.total ? { "Note": `Recorded amount differs from the transactions' total (${peso(detail.total)})` } : {}),
      ...(detail.missing ? { "Not Shown": `${detail.missing} claimed item(s) no longer found in this plant's records` } : {}),
      "Generated By": generatedBy || "System",
      "Date Generated": nowStamp(),
    },
    reference: makeReportRef("REPL"), watermark: false,
    company, logo: logoForCompany(company),
    reviewer: (profile && profile.reviewer) || DEFAULT_REVIEWER,
    approver: (profile && profile.approver) || DEFAULT_APPROVER,
    approverRole: (profile && profile.approverRole) || DEFAULT_APPROVER_ROLE,
  };
}

function ReplenishmentDetailModal({ replenishment: r, funds, disbursements, liquidations, reimbursements, generatedBy, onClose }) {
  /* Recomputed from the live records on every render, so it always shows the
     latest saved figures. */
  const detail = replenishmentDetail(r, disbursements, liquidations, reimbursements);
  const fund = (funds || []).find((f) => f.branchCode === plantOfBranch(r.branchCode));
  const recorded = round2(Number(r.amount) || 0);
  const empty = !detail.txns.length;
  const generate = () => {
    if (empty) { window.alert("This replenishment has no linked transactions, so there is nothing to report."); return; }
    printReportDocument(replenishmentDetailDoc(r, detail, funds, generatedBy));
  };
  const field = (label, value) => (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mut)", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 1100 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Replenishment ${r.replenishmentNo}`}>
        <div className="pcp-modal-head">
          <h3>Replenishment {r.replenishmentNo}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={generate} disabled={empty}
              title={empty ? "No linked transactions — nothing to report" : "Open the print-ready report; choose Save as PDF in the print dialog"}>
              <Printer size={12} /> Generate PDF Report
            </button>
            <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
          </div>
        </div>
        <div className="pcp-modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 14 }}>
            {field("Plant / Company", `${plantLabel(r.branchCode)} · ${companyOfBranch(r.branchCode) || "—"}`)}
            {field("Custodian", (fund && fund.custodian) || "—")}
            {field("Replenishment Date", r.date ? fmtDate(r.date) : "—")}
            {field("Covered Period", detail.period)}
            {field("Batch", detail.batches.length ? detail.batches.join(", ") : "—")}
            {field("Status", r.status ? <Badge status={r.status} /> : "—")}
            {field("Prepared By", r.preparedBy || "—")}
            {field("Replenishment Amount", <span className="pcp-num">{peso(recorded)}</span>)}
          </div>
          {recorded !== detail.total && !empty && (
            <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>
              The recorded replenishment amount ({peso(recorded)}) differs from the total of its transactions ({peso(detail.total)}).
            </div>
          )}
          {detail.missing > 0 && (
            <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>
              {detail.missing} claimed item(s) could not be found in this plant's records and are not shown.
            </div>
          )}
          {empty ? (
            <div className="pcp-empty" style={{ padding: 20 }}>
              No transactions are linked to this replenishment, so no report can be generated.
            </div>
          ) : (
            <div className="pcp-table-wrap">
              <table className="pcp-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Description</th><th>Account Classification</th><th>GL Account</th><th>Sub-account</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.txns.map((x) => {
                    const linesTotal = round2(x.lines.reduce((s, l) => s + l.amount, 0));
                    return (
                      <React.Fragment key={x.key}>
                        <tr style={{ background: "var(--dm-subtle, #eef4f0)" }}>
                          <td colSpan={6} style={{ whiteSpace: "normal" }}>
                            <span className={"pcp-badge " + (x.kind === "Reimbursement" ? "pcp-badge-blue" : "pcp-badge-gray")} style={{ marginRight: 6 }}>{x.kind}</span>
                            <strong>{x.ref}</strong> · {x.employee} · {plantLabel(x.branchCode) || x.branchCode} · {x.date ? fmtDate(x.date) : "—"}
                            <div style={{ fontSize: 11, color: "var(--text-mut)", marginTop: 2 }}>
                              Custodian approved: {replStamp(custodianCheckerLabel(x.rv), x.rv.checkedAt)}
                              {" · "}Accounting checked: {replStamp(acctCheckerLabel(x.rv), x.rv.acctCheckedAt)}{x.rv.batchNo ? ` (${normalizeBatchNo(x.rv.batchNo)})` : ""}
                              {" · "}Final approval: {replStamp(x.rv.finalBy, x.rv.finalAt)}
                            </div>
                          </td>
                        </tr>
                        {x.lines.map((l, i) => (
                          <tr key={x.key + ":" + i}>
                            <td>{l.date ? fmtDate(l.date) : "—"}</td>
                            <td style={{ whiteSpace: "normal" }}>{l.description || "—"}</td>
                            <td>{l.category || "—"}</td>
                            <td>{l.account || "—"}</td>
                            <td>{l.dept ? `${l.dept} — ${deptDesc(l.dept)}` : "—"}</td>
                            <td className="pcp-num" style={{ textAlign: "right" }}>{peso(l.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={5} style={{ textAlign: "right", fontWeight: 700 }}>
                            Subtotal — {x.ref} (approved amount)
                            {linesTotal !== x.amount && <span style={{ fontWeight: 500, color: "var(--text-mut)" }}> · expense lines total {peso(linesTotal)}</span>}
                          </td>
                          <td className="pcp-num" style={{ textAlign: "right", fontWeight: 700 }}>{peso(x.amount)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right", fontWeight: 800 }}>GRAND TOTAL — {detail.txns.length} transaction(s)</td>
                    <td className="pcp-num" style={{ textAlign: "right", fontWeight: 800 }}>{peso(detail.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ReplenishmentFormModal({ onClose, onSave, funds, disbursements, liquidations, reimbursements, replenishments, replenishment, plantOptions, preselect }) {
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
              <input className="pcp-input" value={isEdit ? replenishment.replenishmentNo : `Auto-generated on submit (${replenishmentNoPrefix(form.branchCode)}…)`} disabled />
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
                  <span style={{ color: "var(--danger)" }}> — the amount differs from the selected items</span>
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

function ReplenishmentTab({ replenishments, funds, disbursements, liquidations, reimbursements, onCreate, onEdit, onComplete, onDelete, canDelete, plantOptions, canEdit, plantTitle, generatedBy, canManage, onRevert, onRevertReady, canViewDetails }) {
  const [showForm, setShowForm] = useState(false);
  /* Replenishment whose details modal is open (REPLEN_DETAIL_EMAILS). */
  const [viewing, setViewing] = useState(null);
  /* Liquidations + amount handed to a new form from the Ready panel. */
  const [preselect, setPreselect] = useState(null);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("ALL");
  /* Newest replenishment no. first on open; any header can take over. */
  const sort = useTableSort("replenishmentNo", "desc");

  /* Grace Gan-approved liquidations and reimbursements not yet claimed by a
     replenishment. */
  const ready = useMemo(
    () => replenishmentReadyItems(disbursements, liquidations, reimbursements, replenishments)
      .filter((x) => plant === "ALL" || x.branchCode === plant)
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [disbursements, liquidations, reimbursements, replenishments, plant]
  );

  /* ---- Search and selection ----
     Ticked items drive Replenish, Print and Excel; with nothing ticked, those
     act on everything shown. */
  const [readySearch, setReadySearch] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const rq = readySearch.trim().toLowerCase();
  const shown = ready.filter((x) => !rq
    || [x.ref, x.employee, plantLabel(x.branchCode), x.checkedBy, x.finalBy].some((v) => String(v || "").toLowerCase().includes(rq)));
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
    rq ? `Search "${readySearch.trim()}"` : "",
  ].filter(Boolean).join(" · ");
  const exportDoc = () => readyReplenishmentDoc(groupByPlant(exportScope), funds, plantTitle, generatedBy, exportNote);

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
  const isOpenRepl = (r) => r.status !== "Completed" && r.status !== "Reverted";
  const totalPending = replenishments.filter(isOpenRepl).reduce((s, r) => s + (Number(r.amount) || 0), 0);

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
              {/* Search + bulk selection. */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "10px 0" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
                  <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
                  <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search voucher / reimb no., employee, approver…"
                    value={readySearch} onChange={(e) => setReadySearch(e.target.value)} />
                </div>
                <button className="pcp-btn pcp-btn-sm" disabled={!shown.length}
                  onClick={() => togglePick(shown.map(readyKey), !allShownPicked)}>
                  <Check size={12} /> {allShownPicked ? "Unselect all shown" : `Select all shown (${shown.length})`}
                </button>
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
                        <th style={{ width: 30 }}></th><th>Type</th><th>Voucher / Reimb No.</th><th>Txn Date</th>
                        <th>Employee</th><th>Branch</th><th>Custodian Approved</th><th>Final Approval</th>
                        <th style={{ textAlign: "right" }}>Approved Amount</th>
                        {canManage && onRevertReady && <th></th>}
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
                            <td>{x.employee}</td>
                            <td>{plantLabel(x.branchCode)}</td>
                            <td>{x.checkedBy} · {fmtDate(String(x.checkedAt || "").slice(0, 10))}</td>
                            <td>{x.finalBy} · {fmtDate(String(x.finalAt || "").slice(0, 10))}</td>
                            <td className="pcp-num" style={{ textAlign: "right", fontWeight: 700 }}>{peso(x.amount)}</td>
                            {canManage && onRevertReady && (
                              <td onClick={(e) => e.stopPropagation()}>
                                <button className="pcp-btn pcp-btn-sm" onClick={() => onRevertReady(x.kind, x.id)}
                                  title="Revert — void the final approval and send it back for approval / correction">
                                  <History size={12} /> Revert
                                </button>
                              </td>
                            )}
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
          <KpiCard label="Pending Replenishments" value={replenishments.filter(isOpenRepl).length} icon={Clock} tint="#b9790a" foot={peso(totalPending) + " in progress"} />
          <KpiCard label="Replenishment Records" value={replenishments.length} icon={Landmark} tint="#2054a3" />
        </div>
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search no. or preparer" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="pcp-select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", ...REPLENISH_STATUSES, "Reverted"].map((s) => <option key={s}>{s}</option>)}
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
                  <tr key={r.id} onClick={canViewDetails ? () => setViewing(r) : undefined}
                    style={canViewDetails ? { cursor: "pointer" } : undefined}
                    title={canViewDetails ? "Click to view the transactions in this replenishment" : undefined}>
                    <td>
                      {canViewDetails
                        ? <button style={{ background: "none", border: 0, padding: 0, font: "inherit", fontWeight: 700, color: "inherit", textDecoration: "underline", cursor: "pointer" }}
                            onClick={(e) => { e.stopPropagation(); setViewing(r); }}>{r.replenishmentNo}</button>
                        : r.replenishmentNo}
                      <PrevNo rec={r} />
                    </td>
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
                      {r.status === "Reverted" && (
                        <div style={{ fontSize: 10.5, color: "var(--danger)" }}>
                          Reverted by {r.revertedBy || "—"} · {String(r.revertedAt || "").replace("T", " ")}{r.revertReason ? ` · "${r.revertReason}"` : ""}
                        </div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canViewDetails && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setViewing(r)} title="View details and generate the PDF report"><Eye size={12} /> View</button>
                        )}
                        {canManage && isOpenRepl(r) && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={() => onComplete(r.id)} title="Mark completed"><Check size={12} /></button>
                        )}
                        {canManage && r.status !== "Reverted" && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => setEditing(r)} title="Edit"><Edit3 size={12} /></button>
                        )}
                        {canManage && onRevert && r.status !== "Reverted" && (
                          <button className="pcp-btn pcp-btn-sm" onClick={() => onRevert(r.id)} title="Revert — undo this replenishment; its items return to Ready for Replenishment"><History size={12} /> Revert</button>
                        )}
                        {canDelete && onDelete && (
                          <button className="pcp-btn pcp-btn-sm pcp-btn-danger" onClick={() => onDelete(r.id)} title="Delete replenishment (System Superuser)"><Trash2 size={12} /></button>
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
          funds={funds} disbursements={disbursements} liquidations={liquidations} reimbursements={reimbursements} replenishments={replenishments}
          plantOptions={preselect ? (plantOptions || []).filter((p) => plantOfBranch(p.code) === preselect.branchCode) : formPlantOptions}
          preselect={preselect}
          onClose={() => { setShowForm(false); setPreselect(null); }}
          onSave={(form) => { onCreate(form); setShowForm(false); setPreselect(null); }}
        />
      )}
      {viewing && canViewDetails && (
        <ReplenishmentDetailModal
          replenishment={replenishments.find((x) => x.id === viewing.id) || viewing}
          funds={funds} disbursements={disbursements} liquidations={liquidations} reimbursements={reimbursements}
          generatedBy={generatedBy} onClose={() => setViewing(null)}
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

