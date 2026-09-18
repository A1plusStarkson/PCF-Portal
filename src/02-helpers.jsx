/* ============================= HELPERS ============================= */

const peso = (n) => {
  const v = Number(n) || 0;
  return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const shortPeso = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return "₱" + (v / 1000000).toFixed(2) + "M";
  if (Math.abs(v) >= 1000) return "₱" + (v / 1000).toFixed(1) + "K";
  return "₱" + v.toFixed(0);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
};

const uid = (prefix) => prefix + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();

/* Next number in a document series (e.g. "PCR-2026-" + 0007).

   Derived from the HIGHEST sequence already in use — never from the record
   count. Counting records hands out a duplicate the moment one is deleted
   (5 records → "0006", delete one → 4 records → "0005", which already exists)
   or the moment a number is set by hand. The final loop then steps past any
   number that is still taken, which also covers hand-typed numbers that don't
   parse as a plain sequence. Comparison is case/space insensitive.

   `existing` is the list of numbers already used in that series. Pass the FULL
   list, not a plant-scoped slice, or two plants will collide. */
function nextSeriesNo(prefix, existing, width) {
  const w = width || 4;
  const pre = String(prefix || "").toUpperCase();
  const used = new Set();
  (existing || []).forEach((v) => { const k = String(v || "").trim().toUpperCase(); if (k) used.add(k); });
  let max = 0;
  used.forEach((v) => {
    if (v.indexOf(pre) !== 0) return;
    const n = parseInt(v.slice(pre.length), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  let n = max + 1;
  let candidate = prefix + String(n).padStart(w, "0");
  while (used.has(candidate.toUpperCase())) {
    n++;
    candidate = prefix + String(n).padStart(w, "0");
  }
  return candidate;
}

/* The Petty Cash Request series prefix. Kept in one place so the generator, the
   form placeholder and any future series change stay in step. */
const REQUEST_NO_PREFIX = "PCR-2026-";

const branchByCode = (code) => BRANCHES.find((b) => b.code === code);
const companyOfBranch = (code) => branchByCode(code)?.company || "—";
const subaccountLabel = (code) => {
  const s = SUBACCOUNTS.find((x) => x.code === code);
  if (!s) return code || "—";
  return s.desc ? `${s.code} — ${s.desc}` : s.code;
};
/* Department description only — no code number (used for report line descriptions). */
const deptDesc = (code) => {
  const s = SUBACCOUNTS.find((x) => x.code === code);
  return (s && s.desc) ? s.desc : (code || "");
};

const branchesForCompany = (company) => BRANCHES.filter((b) => b.company === company);

/* ============================= SEED DATA ============================= */

const seedFunds = () => ([
  { id: "fund-MNL", branchCode: "A1+", label: "Manila", custodian: "Maureen Felix", beginningBalance: 600000 },
  { id: "fund-DIS", branchCode: "D1", label: "Disney", custodian: "Pura Barloso", beginningBalance: 704035.23 },
  { id: "fund-WAR", branchCode: "WARNER", label: "Warner", custodian: "Angelita Bayani", beginningBalance: 150000 },
  { id: "fund-RG", branchCode: "RG", label: "RG and Co.", custodian: "Pura Barloso", beginningBalance: 300000 },
]);

/* Transaction stores start EMPTY — the system begins with a clean database and
   only master data (plants, users, chart of accounts) is pre-seeded. */
const seedRequests = () => ([]);

const seedDisbursements = () => ([]);

const seedLiquidations = () => ([]);

const seedReplenishments = () => ([]);

const seedAuditLog = () => ([]);

const STORAGE_KEY = "petty-cash-portal-state";
/* Schema tag written into every saved blob. This is now ONLY metadata: a
   version mismatch NEVER discards transactions — historical financial records
   are always preserved and migrated forward (see migrateState). */
const DATA_VERSION = "2026-clean-1";

/* ---- Recovery ----
   The app no longer keeps its own rolling snapshots. It used to write a
   timestamped copy of the whole database on every page load, to both the cloud
   and localStorage, and auto-restore the richest one whenever the live state
   loaded empty. That machinery caused more harm than it prevented: a single
   browser holding a stale snapshot would silently re-seed the database for
   everybody, which is how intentionally deleted records kept reappearing.

   Recovery is now Supabase's job — daily backups with 7-day retention on the
   Pro plan, restored from the Supabase dashboard. Point-in-time recovery is a
   paid add-on if a finer recovery point is ever needed. */

/* The transaction stores whose loss would destroy financial history. Used to
   tell a real database from an empty one when deciding whether the legacy blob
   still needs migrating into pcp_records. */
const TXN_KEYS = ["requests", "disbursements", "liquidations", "replenishments", "documents", "reimbursements"];

function txnCount(state) {
  if (!state || typeof state !== "object") return 0;
  return TXN_KEYS.reduce((n, k) => n + (Array.isArray(state[k]) ? state[k].length : 0), 0);
}

/* ---- File payload stripping ----
   Uploaded files are stored as base64 data URLs INSIDE their transaction
   record: liquidations and reimbursements keep them in `attachments[].data`,
   PCF documents in `dataUrl`. A single scanned receipt is multiple megabytes,
   which is why a handful of rows accounts for almost all of the database.
   Returns a copy with the bytes blanked, leaving every other field (name, size,
   type, receipt no., amount, approval history) untouched. */
function stripFileBytes(rec) {
  if (!rec || typeof rec !== "object") return rec;
  let out = rec;
  if (Array.isArray(rec.attachments) && rec.attachments.some((a) => a && a.data)) {
    out = { ...out, attachments: rec.attachments.map((a) => (a && a.data ? { ...a, data: "" } : a)) };
  }
  if (out.dataUrl) out = { ...out, dataUrl: "" };
  return out;
}

/* ---- Legacy whole-state blob: READ ONLY, and only to migrate ----
   pcp_records is the store. This reads the old pcp_state blob for exactly one
   purpose: seeding pcp_records on a project that predates it (see the load
   effect in 19-app.jsx, which only calls this when pcp_records is empty).

   Nothing writes the blob any more. The `false` makes the read CLOUD-ONLY —
   the browser's leftover copy is never consulted, because reading a stale
   local blob as truth is precisely what used to resurrect deleted records. */
async function loadLegacyBlob() {
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) { /* not found or storage unavailable */ }
  return null;
}

/* ---- Forward-only migration ----
   Normalizes any previously-saved blob (regardless of its dataVersion) into the
   current shape WITHOUT dropping a single transaction. Missing arrays default to
   empty; existing arrays are carried over verbatim so IDs, reference numbers and
   relationships are preserved exactly. */
function migrateState(saved) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const out = {
    dataVersion: DATA_VERSION,
    funds: arr(saved && saved.funds),
    requests: arr(saved && saved.requests),
    disbursements: arr(saved && saved.disbursements),
    liquidations: arr(saved && saved.liquidations),
    replenishments: arr(saved && saved.replenishments),
    auditLog: arr(saved && saved.auditLog),
    documents: arr(saved && saved.documents),
    reimbursements: arr(saved && saved.reimbursements),
  };
  out._prevVersion = (saved && saved.dataVersion) || null;
  out._migrated = !!saved && saved.dataVersion !== DATA_VERSION;
  return out;
}

/* ---- Per-record cloud sync (concurrency-safe) ----
   The transaction stores that must not clobber each other when multiple users
   are online. Each record is synced to its own row in the pcp_records table
   (keyed by id), so two people editing different records never overwrite one
   another — the root cause of the shared-blob data loss. */
const SYNC_COLLECTIONS = [
  "funds", "requests", "disbursements", "liquidations",
  "replenishments", "auditLog", "documents", "reimbursements",
];

/* Loads every per-record row from the cloud (empty array when unavailable). */
async function loadRecords() {
  try {
    if (window.storage && window.storage.records) return (await window.storage.records.getAll()) || [];
  } catch (e) { /* offline / not configured */ }
  return [];
}

/* Overlays per-record rows on top of a blob-derived state. Records win by id and
   soft-deleted rows (deleted === true) drop the id, so the merged result is the
   richest, most up-to-date view even if a blob write was clobbered. */
function mergeRecordsIntoState(blobState, rows) {
  const cols = {};
  SYNC_COLLECTIONS.forEach((c) => {
    const map = new Map();
    (Array.isArray(blobState && blobState[c]) ? blobState[c] : []).forEach((r) => { if (r && r.id != null) map.set(r.id, r); });
    cols[c] = map;
  });
  (rows || []).forEach((row) => {
    if (!row || !row.collection || row.id == null) return;
    const map = cols[row.collection];
    if (!map) return;
    if (row.deleted) map.delete(row.id);
    else map.set(row.id, row.data);
  });
  const out = { dataVersion: DATA_VERSION };
  SYNC_COLLECTIONS.forEach((c) => { out[c] = Array.from(cols[c].values()); });
  out.auditLog = out.auditLog || [];
  return out;
}

/* Builds the whole application state from the per-record rows alone — the
   normal load path now that pcp_records is the single source of truth. Rows
   marked deleted are dropped, so a deletion made by anyone is a deletion for
   everyone, with no second store able to contradict it. */
function stateFromRecords(rows) {
  return mergeRecordsIntoState({}, rows);
}

/* Applies ONE live change streamed from the database to a state-setter map.
   `change` is { id, collection, data, deleted } as delivered by
   window.storage.records.subscribe.

   A hard DELETE arrives with only the primary key, so `collection` is null and
   the id is removed from every collection. Record ids are prefixed per type
   (req-, dv-, liq-, aud-, …) and unique across collections, so that cannot
   touch the wrong record.

   Each updater returns the SAME array reference when the incoming value is one
   we already hold. That matters twice over: React skips the re-render, and the
   save effect's diff sees no change, so an echo of our own write is not sent
   straight back to the database. */
function applyLiveChange(change, setters) {
  if (!change || change.id == null) return;
  const targets = change.collection
    ? (setters[change.collection] ? [change.collection] : [])
    : Object.keys(setters);
  targets.forEach((c) => {
    setters[c]((list) => {
      const arr = Array.isArray(list) ? list : [];
      const at = arr.findIndex((r) => r && r.id === change.id);
      if (change.deleted) return at < 0 ? arr : arr.filter((r) => !r || r.id !== change.id);
      if (!change.data) return arr;
      if (at >= 0 && JSON.stringify(arr[at]) === JSON.stringify(change.data)) return arr;
      if (at >= 0) { const copy = arr.slice(); copy[at] = change.data; return copy; }
      return [...arr, change.data];
    });
  });
}

/* Records a live change in the last-synced snapshot, so the save effect's diff
   treats it as already-synced rather than as a local edit. Without this, every
   record another user creates would be echoed straight back to the database by
   every open tab — harmless in content, but an endless write loop. */
function noteLiveChangeSynced(snap, change) {
  if (!snap || !change || change.id == null) return;
  const cols = change.collection ? [change.collection] : Object.keys(snap);
  cols.forEach((c) => {
    const map = snap[c];
    if (!map) return;
    if (change.deleted) map.delete(change.id);
    else if (change.data) map.set(change.id, JSON.stringify(change.data));
  });
}

/* Snapshots a state into { collection: Map(id -> JSON) } for change detection. */
function snapshotSync(state) {
  const snap = {};
  SYNC_COLLECTIONS.forEach((c) => {
    const map = new Map();
    (Array.isArray(state && state[c]) ? state[c] : []).forEach((r) => { if (r && r.id != null) map.set(r.id, JSON.stringify(r)); });
    snap[c] = map;
  });
  return snap;
}

/* Diffs the current state against the last-synced snapshot and returns the rows
   that changed: adds/edits as { deleted:false }, removals as tombstones
   ({ deleted:true }). The snapshot is advanced in place so the next diff only
   sees fresh changes. Edits always clear the deleted flag so a later edit wins
   over a concurrent delete (records are preserved for audit). */
function diffSync(snap, state) {
  const rows = [];
  const nowIso = new Date().toISOString();
  SYNC_COLLECTIONS.forEach((c) => {
    const prev = snap[c] || new Map();
    const next = new Map();
    (Array.isArray(state && state[c]) ? state[c] : []).forEach((r) => { if (r && r.id != null) next.set(r.id, r); });
    next.forEach((rec, id) => {
      const js = JSON.stringify(rec);
      if (prev.get(id) !== js) rows.push({ id, collection: c, data: rec, deleted: false, updated_at: nowIso });
    });
    prev.forEach((js, id) => {
      if (!next.has(id)) {
        let data = {};
        try { data = JSON.parse(js); } catch (e) { /* keep empty */ }
        /* Keep the deleted record's fields for audit, but drop the base64 file
           payloads. Tombstones are never pruned, so a deleted receipt would
           otherwise occupy the database forever; the metadata an audit actually
           needs (name, size, who uploaded it, when) is all retained. */
        data = stripFileBytes(data);
        rows.push({ id, collection: c, data, deleted: true, updated_at: nowIso });
      }
    });
    const advanced = new Map();
    next.forEach((rec, id) => advanced.set(id, JSON.stringify(rec)));
    snap[c] = advanced;
  });
  return rows;
}

/* Queues changed records for their per-record cloud upsert (no-op when the
   per-record store is unavailable). */
function syncRecords(rows) {
  if (!rows || !rows.length) return;
  try { if (window.storage && window.storage.records) window.storage.records.put(rows); }
  catch (e) { /* best effort — the keepalive flush on pagehide is the backstop */ }
}

/* ---- Cross-module integrity / reconciliation ----
   Walks the Request → Release → Liquidation → Replenishment chain and reports
   completeness, orphans and duplicates. Pure function — safe to unit test. */
function buildIntegrityReport(requests, disbursements, liquidations, replenishments) {
  const reqs = requests || [], disbs = disbursements || [], liqs = liquidations || [], reps = replenishments || [];
  const disbByReq = new Map();
  disbs.forEach((d) => { if (d.requestId) { if (!disbByReq.has(d.requestId)) disbByReq.set(d.requestId, []); disbByReq.get(d.requestId).push(d); } });
  const liqByDisb = new Map();
  liqs.forEach((l) => { if (l.disbursementId) { if (!liqByDisb.has(l.disbursementId)) liqByDisb.set(l.disbursementId, []); liqByDisb.get(l.disbursementId).push(l); } });
  const repByBranch = new Map();
  reps.forEach((r) => { const b = r.branchCode || "—"; repByBranch.set(b, (repByBranch.get(b) || 0) + 1); });

  const rows = reqs.map((r) => {
    const ds = disbByReq.get(r.id) || [];
    const hasRelease = ds.length > 0;
    const hasLiquidation = ds.some((d) => (liqByDisb.get(d.id) || []).length > 0);
    const hasReplenishment = ds.some((d) => repByBranch.has(d.branchCode)) || repByBranch.has(r.branchCode);
    let status;
    if (!hasRelease) status = "Missing Release";
    else if (!hasLiquidation) status = "Missing Liquidation";
    else status = "Complete";
    return {
      ref: r.requestNo || r.id, request: true, release: hasRelease,
      liquidation: hasLiquidation, replenishment: hasReplenishment, status,
    };
  });

  const reqIds = new Set(reqs.map((r) => r.id));
  const disbIds = new Set(disbs.map((d) => d.id));
  const orphanDisbursements = disbs.filter((d) => !d.requestId || !reqIds.has(d.requestId)).map((d) => d.voucherNo || d.id);
  const orphanLiquidations = liqs.filter((l) => !l.disbursementId || !disbIds.has(l.disbursementId)).map((l) => l.id);

  const dup = (list, key) => {
    const seen = new Map();
    list.forEach((x) => { const k = x[key]; if (k) seen.set(k, (seen.get(k) || 0) + 1); });
    return Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k);
  };
  const duplicateRequestNos = dup(reqs, "requestNo");
  const duplicateVoucherNos = dup(disbs, "voucherNo");
  const duplicateReplenishmentNos = dup(reps, "replenishmentNo");

  const multiLiquidations = Array.from(liqByDisb.entries()).filter(([, arr]) => arr.length > 1).map(([id]) => id);

  return {
    rows,
    counts: {
      requests: reqs.length, disbursements: disbs.length, liquidations: liqs.length, replenishments: reps.length,
      complete: rows.filter((r) => r.status === "Complete").length,
      missingRelease: rows.filter((r) => r.status === "Missing Release").length,
      missingLiquidation: rows.filter((r) => r.status === "Missing Liquidation").length,
    },
    orphanDisbursements, orphanLiquidations,
    duplicateRequestNos, duplicateVoucherNos, duplicateReplenishmentNos,
    duplicateLiquidations: multiLiquidations,
    healthy: orphanDisbursements.length === 0 && orphanLiquidations.length === 0
      && duplicateRequestNos.length === 0 && duplicateVoucherNos.length === 0
      && duplicateReplenishmentNos.length === 0 && multiLiquidations.length === 0,
  };
}

/* ============================= DERIVED METRICS ============================= */

function liquidationFor(disbursementId, liquidations) {
  return liquidations.find((l) => l.disbursementId === disbursementId) || null;
}

function liquidatedTotal(liq) {
  if (!liq) return 0;
  return liq.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

function liqStatusFor(disb, liquidations) {
  const liq = liquidationFor(disb.id, liquidations);
  const total = liquidatedTotal(liq);
  if (total === 0) return "Not Liquidated";
  if (total < disb.amount) return "Partially Liquidated";
  if (total === disb.amount) return "Fully Liquidated";
  return "Over-Liquidated";
}

/* ---- Receipt (Official Receipt / Sales Invoice) approval helpers ----
   Every uploaded receipt carries its own approvalStatus (Pending/Approved/
   Rejected). These derive the roll-up used to gate final liquidation submission
   and to drive dashboard widgets. */
function receiptApprovalSummary(liq) {
  const atts = (liq && liq.attachments) || [];
  let approved = 0, rejected = 0, pending = 0;
  atts.forEach((a) => {
    const s = a.approvalStatus || "Pending";
    if (s === "Approved") approved++;
    else if (s === "Rejected") rejected++;
    else pending++;
  });
  const total = atts.length;
  return {
    total, approved, rejected, pending,
    allApproved: total > 0 && approved === total,
    anyRejected: rejected > 0,
  };
}

/* Overall approval state of a liquidation's receipts. */
function liqApprovalStatus(liq) {
  const s = receiptApprovalSummary(liq);
  if (s.total === 0) return "No Receipts";
  if (s.anyRejected) return "For Revision";
  if (s.allApproved) return "Receipts Approved";
  return "Pending Approval";
}

/* ---- Standardized liquidation rejection reasons ----
   When the authorized Liquidation Approver (Grace Gan) rejects a liquidation
   she must pick ONE of these controlled reasons. The reason is the official
   classification of why the liquidation was rejected; the Reviewer Comment is
   an optional free-text explanation stored separately. */
const LIQUIDATION_REJECTION_REASONS = [
  { group: "Receipt / Documentation", reasons: [
    "Missing Receipt",
    "Invalid Receipt",
    "Unreadable Receipt",
    "Incomplete Receipt Details",
    "Duplicate Receipt",
    "Receipt Does Not Match Expense",
    "Missing Required Supporting Document",
    "Unsupported Expense Documentation",
  ] },
  { group: "Requestor", reasons: [
    "Incorrect PCF Requestor",
    "PCF Requestor Information Incomplete",
    "Incorrect Reimbursement Requestor",
    "Reimbursement Requestor Information Incomplete",
    "Requestor Clarification Required",
  ] },
  { group: "Expense", reasons: [
    "Non-Allowable Expense",
    "Incorrect Expense Classification",
    "Expense Not Related to Company Business",
    "Expense Outside PCF Policy",
    "Expense Requires Additional Approval",
  ] },
  { group: "Amount / Transaction", reasons: [
    "Incorrect Amount",
    "Overclaimed Amount",
    "Duplicate Reimbursement",
    "Incorrect Transaction Reference",
  ] },
  { group: "Approval / Process", reasons: [
    "Missing Required Approval",
    "Incorrect Approval",
    "Liquidation Submitted Incorrectly",
    "Liquidation Requires Correction",
  ] },
  { group: "Other", reasons: [
    "Insufficient Supporting Information",
    "Other Accounting/Finance Review Finding",
  ] },
];
const LIQUIDATION_REJECTION_REASON_SET = new Set(
  LIQUIDATION_REJECTION_REASONS.reduce((acc, g) => acc.concat(g.reasons), [])
);
/* Backend-side validation: the rejection reason must be one of the approved
   values above, so an unauthorized or malformed rejection is refused. */
const isValidLiquidationRejectionReason = (reason) =>
  LIQUIDATION_REJECTION_REASON_SET.has(String(reason || "").trim());

/* Every rejection kept as its own record — the ordered rejection history. */
const liqRejections = (liq) => ((liq && liq.rejections) || []);
const liqIsRejected = (liq) => ((liq && liq.submissionStatus) || "Draft") === "Rejected";

/* ---- Receipt amounts at the SUPPORTING DOCUMENT level ----
   Each uploaded document carries its own receiptAmount, so the liquidation
   total is always recalculated from the individual documents rather than being
   stored as a standalone figure. This keeps every receipt independently
   auditable and lets totals be re-derived at any time. */

/* Document classifications available for each supporting document. */
const RECEIPT_DOC_TYPES = [
  "Official Receipt",
  "Sales Invoice",
  "Cash Invoice",
  "Acknowledgement Receipt",
  "Delivery Receipt",
  "Provisional Receipt",
  "Billing Statement",
  "Other Supporting Document",
];
const DEFAULT_DOC_TYPE = "Official Receipt";

/* Document types that merely SUPPORT the liquidation and carry no peso amount
   of their own (approval sheets, permits, photos, correspondence…). Their
   Receipt Amount is optional — still counted if one is entered, but never
   required and never a reason to block submission. Add a type here to exempt
   it. */
const NON_AMOUNT_DOC_TYPES = ["Other Supporting Document"];
const docRequiresAmount = (a) => !NON_AMOUNT_DOC_TYPES.includes((a && a.docType) || DEFAULT_DOC_TYPE);

/* Peso amounts are held to centavos so comparisons never fail on float dust. */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* Only approved documents count toward the final liquidation total — pending,
   rejected and voided documents are excluded from the computation. */
function isCountableReceipt(a) {
  return !!a && (a.approvalStatus || "Pending") === "Approved";
}

function receiptAmountOf(a) {
  const n = Number(a && a.receiptAmount);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/* Roll-up of the per-document receipt amounts. `approvedTotal` is the figure
   used for reconciliation; `missing` counts documents still awaiting an amount.
   Rejected documents are exempt because they never enter the total, and so are
   the non-amount supporting types (see NON_AMOUNT_DOC_TYPES). */
function receiptAmountSummary(liq) {
  const atts = (liq && liq.attachments) || [];
  let approvedTotal = 0, allTotal = 0, missing = 0, approvedCount = 0, amountBearing = 0, exemptByType = 0;
  atts.forEach((a) => {
    const amt = receiptAmountOf(a);
    allTotal += amt;
    if (!docRequiresAmount(a)) exemptByType++;
    const needsAmount = (a.approvalStatus || "Pending") !== "Rejected" && docRequiresAmount(a);
    if (needsAmount) {
      amountBearing++;
      if (!(Number(a.receiptAmount) > 0)) missing++;
    }
    if (isCountableReceipt(a)) { approvedTotal += amt; approvedCount++; }
  });
  return {
    docCount: atts.length, approvedCount, amountBearing, exemptByType,
    approvedTotal: round2(approvedTotal), allTotal: round2(allTotal),
    missing, complete: atts.length > 0 && missing === 0,
  };
}

/* Variance between the cash released and the approved receipt total.
     difference > 0 → requestor holds excess cash to return
     difference < 0 → requestor spent more and must be reimbursed
     difference = 0 → nothing to settle */
function reconcileReceipts(released, receiptTotal) {
  const rel = round2(released), rec = round2(receiptTotal);
  const difference = round2(rel - rec);
  let type, expected;
  if (difference > 0) { type = "excess"; expected = difference; }
  else if (difference < 0) { type = "reimburse"; expected = round2(-difference); }
  else { type = "exact"; expected = 0; }
  return { released: rel, receiptTotal: rec, difference, type, expected };
}

/* Full cash-settlement state for a liquidation. The settlement flag means the
   cash has ACTUALLY moved, not that someone intends to move it — so a
   liquidation only settles when the recorded actual amount equals the expected
   amount. Over-liquidation additionally needs a reviewer's acknowledgement so
   it can never settle automatically. */
function settlementStateFor(disb, liq) {
  const summary = receiptAmountSummary(liq);
  const rec = reconcileReceipts(disb ? disb.amount : 0, summary.approvedTotal);
  const s = (liq && liq.settlement) || null;
  const completed = !!(s && s.completed);
  const actual = round2(s ? s.actualAmount : 0);
  const needsReview = rec.type === "reimburse";
  const reviewed = !!(s && s.reviewedBy);
  const matches = rec.type === "exact" ? true : (completed && actual === rec.expected);
  return {
    ...rec, summary, settlement: s, completed, actual, matches, needsReview, reviewed,
    settled: rec.type === "exact" ? true : (matches && (!needsReview || reviewed)),
  };
}

/* Final liquidation status under the cash-settlement rule: a liquidation is
   LIQUIDATED once every receipt amount is captured and approved and any
   resulting refund or reimbursement has actually been completed. */
function liqFinalStatus(disb, liq) {
  if (!liq || !((liq.attachments || []).length)) return "Not Liquidated";
  /* A standing rejection takes precedence until the requestor corrects and
     resubmits (which flips submissionStatus back to Submitted). */
  if ((liq.submissionStatus || "Draft") === "Rejected") return "REJECTED";
  const approval = receiptApprovalSummary(liq);
  const st = settlementStateFor(disb, liq);
  if (approval.anyRejected) return "For Revision";
  if (!st.summary.complete || !approval.allApproved) return "NOT YET LIQUIDATED";
  if (st.needsReview && !st.reviewed) return "Under Review";
  return st.settled ? "LIQUIDATED" : "NOT YET LIQUIDATED";
}

/* A liquidation is editable by its requestor while still in Draft, or after a
   rejection so the requestor can correct it and resubmit. */
function liqIsDraft(liq) {
  const s = (liq && liq.submissionStatus) || "Draft";
  return !liq || s === "Draft" || s === "Rejected";
}

/* ---- Duplicate supporting-document detection ----
   Checks the candidate against the documents on this liquidation and on every
   other liquidation, using whichever identifying information is available:
   receipt number + document type, file name, or an identical amount/size pair.
   Returns the matches so the UI can warn before the user proceeds. */
function findDuplicateReceipts(candidate, currentAttachments, liquidations, currentDisbursementId) {
  const hits = [];
  const name = String(candidate.name || "").trim().toLowerCase();
  const rno = String(candidate.receiptNo || "").trim().toLowerCase();
  const amt = receiptAmountOf(candidate);
  const check = (a, disbursementId) => {
    if (!a || a.id === candidate.id) return;
    const aName = String(a.name || "").trim().toLowerCase();
    const aRno = String(a.receiptNo || "").trim().toLowerCase();
    let reason = "";
    if (rno && aRno && rno === aRno && (a.docType || "") === (candidate.docType || "")) {
      reason = `same receipt no. (${a.receiptNo}) and document type`;
    } else if (name && aName === name) {
      reason = "same file name";
    } else if (amt > 0 && receiptAmountOf(a) === amt && a.size && candidate.size && a.size === candidate.size) {
      reason = "same amount and identical file size";
    }
    if (reason) hits.push({ doc: a, disbursementId, reason });
  };
  (currentAttachments || []).forEach((a) => check(a, currentDisbursementId));
  (liquidations || []).forEach((l) => {
    if (l.disbursementId === currentDisbursementId) return;
    (l.attachments || []).forEach((a) => check(a, l.disbursementId));
  });
  return hits;
}

function computeMetrics(funds, requests, disbursements, liquidations, replenishments) {
  const reps = replenishments || [];
  const totalFund = funds.reduce((s, f) => s + (Number(f.beginningBalance) || 0), 0);
  const totalDisbursed = disbursements.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalLiquidated = liquidations.reduce((s, l) => s + liquidatedTotal(l), 0);
  const totalReplenished = reps
    .filter((r) => r.status === "Completed")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  let outstanding = 0;
  const activeEmployees = new Set();
  disbursements.forEach((d) => {
    const status = liqStatusFor(d, liquidations);
    if (status !== "Fully Liquidated") {
      const already = liquidatedTotal(liquidationFor(d.id, liquidations));
      outstanding += Math.max(0, d.amount - already);
      activeEmployees.add(d.employee);
    }
  });

  const availableBalance = totalFund - totalLiquidated - outstanding + totalReplenished;
  const pendingRequests = requests.filter((r) => r.status === "Pending").length;
  const approvedRequests = requests.filter((r) => r.status === "Approved").length;
  const pendingLiquidationCount = disbursements.filter((d) => liqStatusFor(d, liquidations) !== "Fully Liquidated").length;
  const pendingReplenishments = reps.filter((r) => r.status !== "Completed").length;
  const completedBilled = disbursements.filter((d) => d.billed).length;

  const nowMonth = todayISO().slice(0, 7);
  const monthlyExpenses = liquidations.reduce((s, l) =>
    s + l.lines.reduce((ls, ln) => ls + ((ln.date || "").slice(0, 7) === nowMonth ? (Number(ln.amount) || 0) : 0), 0), 0);

  return {
    totalFund, totalDisbursed, totalLiquidated, totalReplenished, outstanding, availableBalance,
    pendingRequests, approvedRequests, pendingLiquidationCount, pendingReplenishments,
    monthlyExpenses, completedBilled,
    activeEmployeeCount: activeEmployees.size,
  };
}

/* Per-fund PCF monitoring — disbursed, liquidated, outstanding and available
   balance scoped to one fund's branch. Mirrors computeMetrics' logic. */
function monitoringForFund(fund, disbursements, liquidations, replenishments) {
  const reps = replenishments || [];
  const disb = disbursements.filter((d) => d.branchCode === fund.branchCode);
  let disbursed = 0, liquidated = 0, outstanding = 0;
  disb.forEach((d) => {
    disbursed += Number(d.amount) || 0;
    const already = liquidatedTotal(liquidationFor(d.id, liquidations));
    liquidated += already;
    if (liqStatusFor(d, liquidations) !== "Fully Liquidated") {
      outstanding += Math.max(0, (Number(d.amount) || 0) - already);
    }
  });
  const replenished = reps
    .filter((r) => r.branchCode === fund.branchCode && r.status === "Completed")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const beginning = Number(fund.beginningBalance) || 0;
  const available = beginning - liquidated - outstanding + replenished;
  return { beginning, disbursed, liquidated, outstanding, replenished, available };
}

function downloadWorkbook(wb, filename) {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

