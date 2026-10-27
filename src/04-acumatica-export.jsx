/* Column layout matches Acumatica's "Purchase Orders Template" import sheet exactly
   (same headers, same order, same static defaults) so this file can be dropped
   straight into Acumatica without reshaping. */
const ACUMATICA_PO_SHEET_NAME = "Purchase Orders Template";

const ACUMATICA_HEADERS = [
  "Branch", "Inventory ID", "Sub.", "Account", "Description", "Line Description",
  "UOM", "Order Qty.", "Unit Cost", "Ext. Cost", "Amount", "Qty. On Receipts",
  "Discount Percent", "Line Type", "Warehouse", "Discount Amount", "Manual Discount",
  "Discount Code", "Prepaid Qty.", "Prepaid Amount", "Alternate ID", "Min. Receipt (%)",
  "Max. Receipt (%)", "Receipt Action", "Complete On (%)", "Tax Category",
  "Accrual Account", "Accrual Sub.", "Requested", "Promised", "Completed", "Cancelled",
  "Closed", "Billed Qty.", "Billed Amount", "Unbilled Qty.", "Unbilled Amount",
  "Blanket PO Type", "Blanket PO Nbr.", "Billing Based On",
];

function buildAcumaticaLine(disb, line, refDateISO) {
  const iso = refDateISO || todayISO();
  const refDate = new Date(iso + "T00:00:00");
  const amount = Number(line.amount) || 0;
  return {
    "Branch": disb.branchCode,
    "Inventory ID": "",
    "Sub.": line.department,
    "Account": accountForCategory(line.category),
    "Description": line.category,
    /* Expense description + department description only — no code number. */
    "Line Description": `${(line.expense && line.expense.trim()) ? line.expense.trim() : line.category} — ${deptDesc(line.department)}`,
    "UOM": "PC",
    "Order Qty.": 1,
    "Unit Cost": amount,
    "Ext. Cost": amount,
    "Amount": amount,
    "Qty. On Receipts": 0,
    "Discount Percent": 0,
    "Line Type": "Service",
    "Warehouse": "",
    "Discount Amount": 0,
    "Manual Discount": "True",
    "Discount Code": "",
    "Prepaid Qty.": 0,
    "Prepaid Amount": 0,
    "Alternate ID": "",
    "Min. Receipt (%)": 0,
    "Max. Receipt (%)": 100,
    "Receipt Action": "Accept but Warn",
    "Complete On (%)": 100,
    "Tax Category": line.taxCategory || "",
    "Accrual Account": "",
    "Accrual Sub.": "",
    "Requested": refDate,
    "Promised": refDate,
    "Completed": "False",
    "Cancelled": "False",
    "Closed": "False",
    "Billed Qty.": 0,
    "Billed Amount": 0,
    "Unbilled Qty.": 1,
    "Unbilled Amount": amount,
    "Blanket PO Type": "",
    "Blanket PO Nbr.": "",
    "Billing Based On": "Order",
  };
}

function buildLiquidationExportRows(disb, liq) {
  const refDateISO = (liq && liq.createdDate) || todayISO();
  return (liq ? liq.lines : []).map((line) => buildAcumaticaLine(disb, line, refDateISO));
}

/* A reimbursement's expense lines in the same Purchase Orders Template layout
   as a liquidation, so "Export All to Acumatica" carries both in one sheet.
   Same mapping as buildAcumaticaLine; the GL account is the line's own
   (falling back to its category's, as the single reimbursement export does)
   and the date is the reimbursement's approval date, else its request date. */
function buildReimbursementAcumaticaRows(reimb) {
  const refISO = String(reimb.approvedAt || reimb.requestDate || "").slice(0, 10) || todayISO();
  return (reimb.lines || []).map((l) => {
    const row = buildAcumaticaLine(
      { branchCode: reimb.branchCode },
      { amount: l.amount, department: l.department, category: l.category, expense: l.description, taxCategory: l.taxCategory },
      refISO
    );
    row["Account"] = l.account || accountForCategory(l.category);
    return row;
  });
}

/* A replenishment's liquidations and reimbursements in one Purchase Orders
   sheet — "Export to Acumatica" in the Replenishment tab. Each item must carry
   Grace Gan's final approval; any that does not (or cannot be found) is listed
   in notApproved, and the caller exports nothing. */
const REIMB_NOT_FINAL = ["DRAFT", "SUBMITTED", "FOR REVIEW", "FOR APPROVAL", "FOR FINAL APPROVAL",
  "RETURNED FOR REVISION", "FOR SUBMISSION", "REJECTED"];
/* Final-approved by Grace Gan — the bar for anything written in Acumatica's
   format: the Replenishment export, a liquidation's Export to Excel and a
   reimbursement's Export to Acumatica. */
const liqFinalApproved = (disb, liq) => !!liq && !!disb && !isVoucherCancelled(disb) && liqReview(liq).final;
const reimbFinalApproved = (r) => !!r && (reimbReview(r).final || (!!r.status && !REIMB_NOT_FINAL.includes(r.status)));
function buildReplenishmentAcumaticaRows(repl, disbursements, liquidations, reimbursements) {
  const rows = [];
  const notApproved = [];
  (repl.liquidationIds || []).forEach((id) => {
    const liq = (liquidations || []).find((l) => l.id === id);
    const disb = liq && (disbursements || []).find((d) => d.id === liq.disbursementId);
    if (!liqFinalApproved(disb, liq)) {
      notApproved.push(disb ? disb.voucherNo : "a liquidation no longer on file");
      return;
    }
    rows.push(...buildLiquidationExportRows(disb, liq));
  });
  (repl.reimbursementIds || []).forEach((id) => {
    const r = (reimbursements || []).find((x) => x.id === id);
    if (!reimbFinalApproved(r)) {
      notApproved.push(r ? r.reimbNo : "a reimbursement no longer on file");
      return;
    }
    rows.push(...buildReimbursementAcumaticaRows(r));
  });
  return { rows, notApproved };
}
