/* ============================= APP ============================= */

export default function App({ userEmail, userName, onSignOut, userRole, isAdmin, userPlants, userExcludePlants }) {
  const [loaded, setLoaded] = useState(false);
  /* Everyone starts on the Home landing page (24-home.jsx). */
  const [tab, setTab] = useState("home");
  const [funds, setFunds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [role, setRole] = useState(userRole || "Accounting");
  /* Non-admins are locked to their assigned role; admins may view-as any role. */
  useEffect(() => { setRole(userRole || "Accounting"); }, [userRole]);
  /* No role preview for an account held to fixed modules (RESTRICTED_MODULE_ACCESS). */
  const canSwitchRole = !!isAdmin && !RESTRICTED_MODULE_ACCESS[(userEmail || "").trim().toLowerCase()];
  const guardedSetRole = useCallback((r) => { if (canSwitchRole) setRole(r); }, [canSwitchRole]);
  const [historyFilter, setHistoryFilter] = useState(null);
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [showEditBalances, setShowEditBalances] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showMfaDevices, setShowMfaDevices] = useState(false);
  /* Only the two-step sign-in accounts have authenticator devices to manage. */
  const hasMfa = !!(window.PCP_AUTH && window.PCP_AUTH.enabled && window.PCP_AUTH.mfa) && (window.PCP_MFA_EMAILS || [])
    .map((s) => String(s).toLowerCase()).includes(String(userEmail || "").toLowerCase());
  /* True when the concurrency-safe per-record store (pcp_records) is missing in
     the cloud database. Surfaces a banner so an admin runs the setup SQL. */
  const [recordsUnavailable, setRecordsUnavailable] = useState(false);
  const blockedSaves = useBlockedSaves();
  /* True when the load from pcp_records did not complete. Distinct from
     recordsUnavailable, which only means the table is missing. A read can fail
     for reasons the old code could not tell apart from success — a timeout on
     an oversized response, a dropped connection, an expired token — and every
     one of them returned an empty array, so the portal opened blank and said
     nothing. Whatever is on screen in this state is INCOMPLETE, so the banner
     says so and the load effect refuses to treat it as a fresh database. */
  const [loadFailed, setLoadFailed] = useState(false);
  /* True when the deferred receipt stream did not finish. Narrower than
     loadFailed and worth keeping separate: every transaction is on screen and
     correct, only the scanned images behind them are missing, so this warns
     without telling people their ledger is untrustworthy. */
  const [receiptsFailed, setReceiptsFailed] = useState(false);

  /* Branch-level access scope for this user (list of allowed branch codes).
     For management (userPlants === "ALL") it is every branch in the master plus,
     LIVE, any branch appearing in the funds data — so a plant newly created in
     Funds & Master Data is automatically included across the dashboard, aging
     report, notifications and management reports with no code change. */
  /* Plants taken away from this account (excludePlants in index.html), as
     plant codes. Applied last, to the WHOLE family of each, so no branch of
     an excluded plant survives — whatever the grant says. This single scope
     is what every module, list, form, dropdown, notification and handler
     reads (inScope / branchOptions / plantOptions), so an excluded plant's
     records can be neither seen nor acted on anywhere in the app. */
  const excludedPlantKey = (userExcludePlants || []).join("|");
  const allowedPlants = useMemo(() => {
    const excluded = new Set((userExcludePlants || []).map(plantOfBranch));
    const keep = (codes) => codes.filter((c) => !excluded.has(plantOfBranch(c)));
    if (userPlants === "ALL" || !userPlants) {
      /* EVERY branch, not just the four fund-holding plant codes. Those four
         alone left management blind to anything filed against a sub-branch
         (HASBRO, D5, …) — records its own requestors had created. */
      const codes = new Set(ALL_BRANCH_CODES);
      funds.forEach((f) => { if (f.branchCode) codes.add(f.branchCode); });
      return keep(Array.from(codes));
    }
    /* Explicitly granted plants (custodians, requestors) — widened to the whole
       plant family, so a grant can never cover part of a plant and leave the
       rest of it visible only to somebody else. */
    return keep(Array.from(new Set(expandPlantFamilies(userPlants))));
  }, [userPlants, excludedPlantKey, funds]); // eslint-disable-line
  /* ---- Branch-level options ----
     Every branch the user may file a record against, in canonical order: the
     plants first, then any additional master-data plant so new plants surface
     automatically, then every remaining granted branch. That last pass matters:
     a branch with no fund row of its own (Disney 2..9 under the single Disney
     fund) still needs to be selectable, or records could never be filed against
     it. These feed the module forms and the in-page branch tabs. */
  const branchOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    PLANTS.forEach((p) => { if (allowedPlants.includes(p.code) && !seen.has(p.code)) { seen.add(p.code); out.push({ code: p.code, label: p.label }); } });
    funds.forEach((f) => { if (allowedPlants.includes(f.branchCode) && !seen.has(f.branchCode)) { seen.add(f.branchCode); out.push({ code: f.branchCode, label: f.label || plantLabel(f.branchCode) || f.branchCode }); } });
    allowedPlants.forEach((code) => { if (code && !seen.has(code)) { seen.add(code); out.push({ code, label: plantLabel(code) || code }); } });
    return out;
  }, [allowedPlants, funds]);
  /* ---- Plant-level options ----
     The same branches rolled up to their parent plant. This is what builds the
     sidebar, so every user sees the SAME plants (Manila, Warner, Disney, RG)
     and a sub-branch never becomes a plant of its own in one person's sidebar
     and not another's. Branches outside every family keep their own entry. */
  const plantOptions = useMemo(() => {
    /* A branch that heads no family and holds no fund only earns a group once it
       actually carries a record. Without that, every unused code in the branch
       master (HAMFI, Starkson Industries) would add an empty plant to
       management's sidebar. Nothing can hide either way: inScope() still admits
       them, so the moment such a branch carries a record its group appears. */
    const used = new Set();
    [funds, requests, disbursements, replenishments, reimbursements].forEach((list) => {
      (list || []).forEach((r) => { if (r && r.branchCode) used.add(r.branchCode); });
    });
    const seen = new Set();
    const out = [];
    branchOptions.forEach((b) => {
      const p = plantOfBranch(b.code);
      if (seen.has(p)) return;
      if (PLANT_CODES.indexOf(p) < 0 && !used.has(b.code)) return;
      seen.add(p);
      out.push({ code: p, label: plantLabel(p) });
    });
    return out;
  }, [branchOptions, funds, requests, disbursements, replenishments, reimbursements]);
  const inScope = useCallback((code) => allowedPlants.includes(code), [allowedPlants]);
  /* PCF Requestor prepares transactions only: full Requests + Liquidation (minus
     approval, already gated by isLiquidationChecker), but no approve/reject/
     release rights and Release Ledger is view-only. Every other role keeps full
     edit/approve/release within its scope. Checked on BOTH the assigned role and
     the role being viewed so an admin's "view as Requestor" is an honest preview. */
  const isRequestor = (userRole || "") === "Requestor" || role === "Requestor";
  const canEdit = true;
  const canApprove = !isRequestor;
  const canRelease = !isRequestor;
  const canEditLedger = !isRequestor;

  /* ---- Delete rights ----
     Deleting records is reserved for the SuperAdmin role (window.PCP_USERS in
     index.html) — Accounting and Finance cannot delete. Gated on BOTH the user's
     assigned role and the role currently being viewed, so an admin using
     "view as Custodian" sees an honest preview with the delete actions hidden. */
  const isSuperAdmin = (userRole || "") === "SuperAdmin" && role === "SuperAdmin";
  /* Deleting a TRANSACTION (request, voucher, liquidation, reimbursement,
     replenishment) is narrower still: this one account, by the owner's
     instruction. By email, not role — Grace Gan is a SuperAdmin too and must
     not see a Delete button. Hidden while previewing another role, re-checked
     inside every delete handler, and enforced in the database by
     supabase-delete-gate.sql. Keep the three lists in step. */
  const DELETE_ACCOUNT_EMAILS = ["superuser@a1plus.com"];
  const canDeleteTxn = DELETE_ACCOUNT_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");

  /* ---- Series numbers ----
     Petty Cash Request and Reimbursement numbers are issued by the database
     and can never be typed or changed by any user — Accounting and SuperAdmin
     included (owner's instruction, Sep 2026). */
  /* ---- Accounting edit override ----
     By the owner's instruction, this account may also edit a Petty Cash
     Request after it is Disbursed. Final-approved liquidations stay locked for
     everyone. By email, and hidden while previewing another role. Every such
     edit is written to the audit trail. */
  const EDIT_OVERRIDE_EMAILS = ["accounting@a1plus.com"];
  const canEditOverride = EDIT_OVERRIDE_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Reimbursements: editable at any stage (status and approvals kept) by these
     accounts, for checking and verification — owner's instruction. PCF
     Requestors are deliberately not on it. */
  const REIMB_EDIT_OVERRIDE_EMAILS = [
    "a1plusadmin@a1plus.com", "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
    "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
  ];
  const canEditReimbOverride = REIMB_EDIT_OVERRIDE_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* PCF Requestors: may edit a SUBMITTED reimbursement — details and
     attachments — only until the custodian approves it (owner's instruction,
     Sep 2026). Status is kept; re-checked in updateReimbursement at save time,
     so an edit started before the custodian approved is refused after. */
  const REIMB_REQUESTOR_EDIT_EMAILS = [
    "pcfrequestordisney@a1plus.com", "pcfrequestormanila@a1plus.com", "pcfrequestorrgandco@a1plus.com",
  ];
  const canEditReimbBeforeCustodian = REIMB_REQUESTOR_EDIT_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Reimbursements — Uploaded Files (owner's instruction, Oct 2026): upload,
     set each document's Document Type and Amount, and delete an individual
     document (wrong, duplicate or incomplete upload) so it can be replaced —
     these accounts only; anyone else sees the documents read-only. Only the
     selected document leaves the record; the reimbursement, its status and its
     other documents are untouched, and the stored file itself is kept.
     Re-checked in updateReimbursement at save. */
  const REIMB_DOC_DELETE_EMAILS = [
    "pcfrequestordisney@a1plus.com", "pcfrequestormanila@a1plus.com", "pcfrequestorrgandco@a1plus.com",
    "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
    "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
  ];
  const canDeleteReimbDocs = REIMB_DOC_DELETE_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Liquidation worksheet: the highlighted Upload button beside Export to
     Excel (owner's instruction, Oct 2026). Display only — it opens the same
     upload as the Supporting Documents section, under the same rules. */
  const LIQ_HEADER_UPLOAD_EMAILS = [
    "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
    "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
    "pcfrequestordisney@a1plus.com", "pcfrequestormanila@a1plus.com", "pcfrequestorrgandco@a1plus.com",
  ];
  const canLiqHeaderUpload = LIQ_HEADER_UPLOAD_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Uploaded Files: SAVE FILE after rotating a document's preview (owner's
     instruction, Oct 2026). Rotating the preview stays open to everyone; saving
     the new orientation is these accounts only. Re-checked in saveDocRotation. */
  const DOC_ROTATE_SAVE_EMAILS = [
    "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
    "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
    "pcfrequestordisney@a1plus.com", "pcfrequestormanila@a1plus.com", "pcfrequestorrgandco@a1plus.com",
  ];
  const canSaveDocRotation = DOC_ROTATE_SAVE_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Reimbursements: authorize a variance between Total Expense Lines and Total
     Uploaded Documents, with a written reason (owner's instruction, Oct 2026).
     Requestors must balance before submitting. The authorization covers only
     the exact variance it was given for. Re-checked at save. */
  const REIMB_VARIANCE_AUTH_EMAILS = [
    "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
    "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
  ];
  const canAuthorizeReimbVariance = REIMB_VARIANCE_AUTH_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* REVERT to Requestor — Liquidation and Reimbursement (owner's instruction,
     Sep 2026). While a transaction is submitted and not yet final-approved,
     these accounts can send it back with a reason; it becomes FOR SUBMISSION,
     the requestor corrects / adds attachments and resubmits. Same record and
     number; any approval stamps move into the review history. By email, and
     re-checked in revertLiquidation / reimbursementAction. */
  const REVERT_EMAILS = [
    "accounting@a1plus.com", "finance@a1plus.com", "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
    "a1plusadmin@a1plus.com", "superuser@a1plus.com",
  ];
  const canRevert = REVERT_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Approval Module: row Select + Export Excel (owner's instruction, Sep 2026).
     Read-only — exporting never changes a record. */
  const APPROVAL_EXPORT_EMAILS = ["a1plusadmin@a1plus.com", "superuser@a1plus.com"];
  const canApprovalExport = APPROVAL_EXPORT_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");
  /* Replenishments: edit, mark completed and revert — these accounts only
     (owner's instruction, Sep 2026). Everyone else sees the records read-only. */
  const REPLEN_MANAGE_EMAILS = [
    "a1plusadmin@a1plus.com", "superuser@a1plus.com", "accounting@a1plus.com", "finance@a1plus.com",
    "puradr@a1plus.com", "lita@a1plus.com", "mauwi@a1plus.com",
  ];
  const canManageReplen = REPLEN_MANAGE_EMAILS.includes((userEmail || "").trim().toLowerCase())
    && role === (userRole || "Accounting");

  /* ---- Closing a cash shortage ----
     When a requestor returns less than they owe, the balance is a receivable
     from them — so somebody accountable has to decide it is recoverable (or
     recorded for payroll deduction) and say so on the record. Until then the
     liquidation stays PARTIALLY SETTLED.

     Custodians, Finance, Accounting and SuperAdmin may do this; a Requestor
     never can, since it would let the person who owes the cash sign off their
     own shortage. Custodians are included as a ROLE, so Manila's custodian can
     close Manila shortages just as Disney's can close Disney's — plant scoping
     already stops either from touching the other's records.

     Gated on BOTH the assigned role and the role being viewed, so previewing
     another role gains no hidden rights, matching REQUEST_NO_EDITOR_ROLES
     above. Re-checked inside closeShortage so a bypassed UI still fails. */
  const SHORTAGE_APPROVER_ROLES = ["Custodian", "Finance", "Accounting", "SuperAdmin"];
  const canApproveShortage = SHORTAGE_APPROVER_ROLES.includes(userRole || "Accounting")
    && SHORTAGE_APPROVER_ROLES.includes(role);

  /* ---- Two-level liquidation approval (see 11-liquidation.jsx) ----
     FINAL APPROVERS: Grace Gan and the System Superuser (identical final
     approval authority), by
     email only. Previewing another role hides it,
     so "view as" stays an honest preview.
     CHECKER: every Custodian, Accounting, Finance and SuperAdmin account, within
     its plant scope — including the System Superuser, but never Grace Gan
     (LIQUIDATION_FINAL_ONLY_EMAILS). The Superuser may hold both levels, but
     never on the same record: final approval is refused to whoever gave the
     custodian approval. Both are re-checked inside every handler below, so
     a bypassed UI still fails. */
  const emailIn = (list) => list.map((e) => e.toLowerCase()).includes((userEmail || "").trim().toLowerCase());
  const isFinalApproverAccount = useMemo(() => emailIn(LIQUIDATION_FINAL_APPROVER_EMAILS), [userEmail]); // eslint-disable-line
  const isFinalOnlyAccount = useMemo(() => emailIn(LIQUIDATION_FINAL_ONLY_EMAILS), [userEmail]); // eslint-disable-line
  const isFinalApprover = isFinalApproverAccount && role === (userRole || "Accounting");
  /* Grace Gan is excluded by ACCOUNT, not by the role being viewed — otherwise
     previewing "Custodian" would make her a checker. */
  const isLiquidationChecker = !isFinalOnlyAccount
    && LIQUIDATION_CHECKER_ROLES.includes(userRole || "Accounting")
    && LIQUIDATION_CHECKER_ROLES.includes(role);
  /* ACCOUNTING REVIEW: by email (ACCOUNTING_CHECKER_EMAILS), hidden while
     previewing another role. Re-checked inside accountingReview. */
  const isAccountingChecker = emailIn(ACCOUNTING_CHECKER_EMAILS) && role === (userRole || "Accounting");
  /* FINANCE CHECKER: the person using the shared Finance account, picked in
     the sidebar (FINANCE_CHECKER_NAMES). Kept for this browser tab only, so
     each sign-in starts by choosing a name. Required by checkLiquidation and
     the reimbursement custodian-approve, which stamp it as
     review.financeChecker. */
  const financeCheckerNames = financeCheckerNamesFor(userEmail);
  const [financeChecker, setFinanceCheckerRaw] = useState(() => {
    try { return sessionStorage.getItem("pcp.financeChecker") || ""; } catch (e) { return ""; }
  });
  const setFinanceChecker = useCallback((v) => {
    setFinanceCheckerRaw(v || "");
    try { sessionStorage.setItem("pcp.financeChecker", v || ""); } catch (e) { /* storage unavailable */ }
  }, []);
  const activeFinanceChecker = financeCheckerNames.includes(financeChecker) ? financeChecker : "";
  const missingFinanceChecker = () => {
    if (!financeCheckerNames.length || activeFinanceChecker) return false;
    window.alert("Select your name under Finance Checker (left sidebar, below your account name) before checking transactions.");
    return true;
  };
  /* APPROVAL MODULE: three accounts (APPROVAL_MODULE_EMAILS), plus the view-only
     accounts of APPROVAL_FINAL_VIEW_EMAILS, hidden while previewing another
     role, like the approver flags above. A view-only account that is not a
     module member gets no action in it at all (approvalViewOnly). */
  const isApprovalModuleMember = emailIn(APPROVAL_MODULE_EMAILS) && role === (userRole || "Accounting");
  const canViewFinalQueue = emailIn(APPROVAL_FINAL_VIEW_EMAILS) && role === (userRole || "Accounting");
  const canUseApprovalModule = isApprovalModuleMember || canViewFinalQueue;
  const approvalViewOnly = canViewFinalQueue && !isApprovalModuleMember;
  /* APPROVED MODULE: view-only, by email (APPROVED_MODULE_EMAILS). */
  const canUseApprovedModule = emailIn(APPROVED_MODULE_EMAILS) && role === (userRole || "Accounting");
  /* Accounts held to a fixed module list (RESTRICTED_MODULE_ACCESS) whatever
     their role or a role preview would grant. */
  const restrictedModules = RESTRICTED_MODULE_ACCESS[(userEmail || "").trim().toLowerCase()] || null;
  /* ACCESS PCF DOCUMENTS: view + download (PCF_DOCUMENTS_ACCESS_EMAILS). Read-only
     when the account has the module only through this grant or is held to
     fixed modules; otherwise its role's document rights are unchanged. */
  const canAccessPcfDocuments = emailIn(PCF_DOCUMENTS_ACCESS_EMAILS);
  const docsReadOnly = !!restrictedModules || !(ROLES[role] || ROLES["Accounting"]).tabs.includes("documents");
  /* Nothing under Grace Gan's final approval may move — it is what gets
     replenished. (Legacy approvals are not locked; they predate the lock.) */
  const isLiquidationFinalLocked = useCallback((disbursementId) => {
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    return !!liq && !!liq.workflow && liqReview(liq).final;
  }, [liquidations]);

  /* Append an entry to the immutable audit trail, tagged with the signed-in user. */
  const logAudit = useCallback((action, entity, remarks) => {
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19), user: userName || role, action, entity, remarks: remarks || "",
    }]);
  }, [role, userName]);

  /* ---- Series numbers: issued by the database, never reused ----
     Every numbered module runs its own series per plant (seriesPrefix in
     05-master-data.jsx). In the cloud the NUMBER COMES FROM THE DATABASE
     (window.storage.series -> supabase-series-guard.sql): a counter per series
     that only goes up, so two people saving at the same instant get
     different numbers, and a registry of every number ever issued, so a
     deleted, rejected or renumbered record's number is retired for good. A
     database trigger refuses any write that would give a registered number
     to a different record, so this holds even if the app is bypassed.

     If the database cannot issue a number, the record is NOT created — a
     locally invented number could already be taken. Only single-user local
     mode, which has no database, numbers locally (nextSeriesNo). */
  const seriesApi = (window.storage && window.storage.series) || null;
  /* The next number in `prefix`, bound to record `id`. Throws on failure. */
  const issueSeriesNo = async (prefix, collection, id, localNos) => {
    const no = seriesApi ? await seriesApi.issue(prefix, collection, id) : null;
    if (no === null) return nextSeriesNo(prefix, localNos);
    if (!no) throw new Error("The database did not return a number.");
    return no;
  };
  /* Claims `no` for record `id`. exact: "" when taken; otherwise a "-1",
     "-2"… suffix is added until free. Throws on failure. */
  const claimSeriesNo = async (no, collection, id, exact, localNos) => {
    const got = seriesApi ? await seriesApi.claim(no, collection, id, exact) : null;
    if (got !== null) return got;
    const taken = (localNos || []).some((v) => String(v || "").trim().toUpperCase() === no.toUpperCase());
    if (!taken) return no;
    return exact ? "" : nextSeriesNo(no + "-", localNos, 1);
  };
  const seriesFailed = (e, what) => {
    const msg = (e && e.message) || String(e || "");
    window.alert(
      `Could not get a ${what} number from the database, so nothing was saved. Please try again.\n\n${msg}`
      + (/pcp_(issue|claim)_series_no|PGRST202|does not exist/i.test(msg)
        ? "\n\nAdministrator: run supabase-series-guard.sql in Supabase." : "")
    );
  };
  /* The database refused a save whose number belongs to another record (the
     storage adapter drops just that row and reports it here). */
  useEffect(() => {
    const onRefused = (ev) => {
      const d = (ev && ev.detail) || {};
      window.alert(`A ${d.collection || "record"} was NOT saved: its number has already been issued to another transaction.\n\n`
        + "Reload the portal (Ctrl+F5) and enter it again.");
    };
    window.addEventListener("pcp-series-refused", onRefused);
    return () => window.removeEventListener("pcp-series-refused", onRefused);
  }, []);

  const numberStamp = (reason) => ({ ts: new Date().toISOString().slice(0, 19), user: userName || userEmail || role, reason });
  /* Gives one record a new number; the old one stays retired. */
  const renumberOne = (setter, key, id, from, to, reason) => {
    setter((rs) => rs.map((x) => (x.id === id ? withRenumber(x, key, to, numberStamp(reason)) : x)));
    logAudit("Renumbered", to, `was ${from} · ${reason}`);
  };
  /* True when a record edited onto a branch of ANOTHER plant must leave its
     old plant's series. Only a number in the standard format moves — one
     Accounting typed by hand stays as typed. */
  const leavesPlantSeries = (rec, key, newBranch, tag) => {
    if (!rec || !newBranch) return false;
    const fromCode = plantSeriesCode(rec.branchCode);
    if (fromCode === plantSeriesCode(newBranch)) return false;
    const esc = String(fromCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + tag + "-" + esc + "-\\d{4}-\\d+$", "i").test(String(rec[key] || "").trim());
  };
  /* Moves a record into its new plant's series: a freshly issued number
     there; the old one is retired, never reused. */
  const moveToPlantSeries = async (setter, key, rec, newBranch, tag, collection, localNos) => {
    if (!leavesPlantSeries(rec, key, newBranch, tag)) return;
    let to;
    try { to = await issueSeriesNo(seriesPrefix(tag, newBranch), collection, rec.id, localNos); }
    catch (e) {
      window.alert(`${rec[key]} was saved, but could not be given a ${plantNameOf(newBranch)} number, so it keeps ${rec[key]} for now. Edit and save it again to retry.\n\n${(e && e.message) || e}`);
      return;
    }
    renumberOne(setter, key, rec.id, rec[key], to, `Moved to ${plantNameOf(newBranch)}`);
  };

  /* ---- Transaction delete: confirmation, reason, record ----
     Every transaction delete goes through here. It states the exact
     confirmation the owner asked for, lists any numbers the delete will move,
     and will not proceed without a reason. Returns the reason, or null when
     the user backs out at any point. */
  const plantNameOf = (branchCode) => plantLabel(plantOfBranch(branchCode)) || branchCode || "—";
  const confirmTxnDelete = (no, details) => {
    if (!canDeleteTxn) {
      window.alert(`Only ${DELETE_ACCOUNT_EMAILS.join(", ")} can delete transactions.`);
      return null;
    }
    const msg = "Are you sure you want to delete this transaction? This action cannot be undone.\n\n"
      + [no, ...details].filter(Boolean).join("\n")
      + "\n\nIts number is retired and will never be issued again. No other number changes.";
    if (!window.confirm(msg)) return null;
    for (;;) {
      const reason = window.prompt(`Reason for deleting ${no} (required):`, "");
      if (reason === null) return null;
      if (reason.trim()) return reason.trim();
      window.alert("A reason is required to delete a transaction.");
    }
  };
  /* Written onto the deleted record's own row in the database (diffSync). */
  const stampDeleted = (id, no, branchCode, reason) => TOMBSTONE_META.set(id, {
    deletedNo: no, deletedPlant: plantNameOf(branchCode), deleteReason: reason,
    deletedBy: userName || userEmail || role, deletedByEmail: userEmail || "",
    deletedAt: new Date().toISOString().slice(0, 19),
  });
  /* The replenishment that has already claimed a liquidation / reimbursement.
     Such a record cannot be deleted: the fund was topped up against it. */
  const claimedBy = (field, id) => replenishments.find((rp) => (rp[field] || []).includes(id));

  /* Record sign-in once per session, and sign-out via a wrapped handler. */
  const loginLoggedRef = useRef(false);
  /* Last-synced snapshot for per-record change detection (concurrency-safe save). */
  const syncedRef = useRef(null);
  useEffect(() => {
    if (!loaded || loginLoggedRef.current) return;
    loginLoggedRef.current = true;
    setAuditLog((log) => [...log, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19),
      user: userName || (userEmail || "User"), action: "Signed In",
      entity: userEmail || "—", remarks: `Role: ${ROLES[role] ? ROLES[role].label : role}`,
    }]);
  }, [loaded]); // eslint-disable-line

  /* Signing out MUST NOT outrun the pending save. syncRecords only queues
     behind an 800ms debounce, but onSignOut() invalidates the Supabase session
     immediately — so the queued write used to land without a valid token, get
     rejected by RLS, and vanish. There is no local copy to fall back on any
     more, which makes flushing first not an optimisation but the only thing
     standing between the last edit and losing it. */
  const handleSignOut = useCallback(async () => {
    const nextAudit = [...auditLog, {
      id: uid("aud"), ts: new Date().toISOString().slice(0, 19),
      user: userName || (userEmail || "User"), action: "Signed Out",
      entity: userEmail || "—", remarks: "",
    }];
    setAuditLog(nextAudit);
    const next = {
      dataVersion: DATA_VERSION, funds, requests, disbursements, liquidations,
      replenishments, auditLog: nextAudit, documents, reimbursements,
    };
    /* Guarded: syncedRef is null until the initial load finishes, and a throw
       here must not skip the flush below. */
    try {
      if (syncedRef.current) syncRecords(diffSync(syncedRef.current, next));
    } catch (e) { /* best effort — the flush below is the last chance */ }
    try {
      if (window.storage && window.storage.flushNow) await window.storage.flushNow();
    } catch (e) { /* sign out regardless; nothing more we can do here */ }
    if (onSignOut) onSignOut();
  }, [onSignOut, userName, userEmail, funds, requests, disbursements, liquidations,
      replenishments, auditLog, documents, reimbursements]);

  useEffect(() => {
    (async () => {
      /* ---- Load: Supabase pcp_records, and nothing else ----
         One store, one truth. The old path merged a whole-state blob with the
         per-record rows and kept a browser copy besides, which meant three
         stores could disagree — the reason two accounts could look at the same
         database and see different data, and the reason deleted records came
         back when a stale copy won a merge. */
      const rows = await loadRecords();
      /* Set by the storage adapter when ANY page of the read failed. An empty
         `rows` then means "we could not read the database", not "the database
         is empty" — a distinction everything below depends on. */
      const readFailed = !!window.PCP_RECORDS_LOAD_FAILED;
      /* Always keep the four master plant funds available, adding any missing. */
      const ensureFunds = (fs) => {
        const list = (fs && fs.length) ? fs.map((f) => ({ ...f })) : seedFunds();
        seedFunds().forEach((sf) => { if (!list.some((f) => f.branchCode === sf.branchCode)) list.push(sf); });
        return list;
      };

      /* CRITICAL: transactions are NEVER wiped on load. Whatever is in
         pcp_records is carried forward verbatim — IDs, reference numbers and
         relationships preserved. Completed financial records must always
         survive an upgrade. */
      let source = stateFromRecords(rows);

      /* ---- One-time migration off the legacy blob ----
         Runs ONLY when pcp_records is completely empty, i.e. a project that
         predates the per-record store. The read is cloud-only, so a browser's
         leftover copy can never be the source. Once seeded, this never runs
         again — which is also why the wipe script must clear the blob: a
         non-empty blob left behind would be re-migrated the day pcp_records is
         emptied. */
      let seedFromBlob = null;
      if (!rows.length && !readFailed) {
        try {
          const legacy = await loadLegacyBlob();
          if (legacy && txnCount(migrateState(legacy)) > 0) {
            seedFromBlob = migrateState(legacy);
            source = seedFromBlob;
          }
        } catch (e) { /* no legacy blob — a clean project, nothing to do */ }
      }

      const startFunds = ensureFunds(source.funds);
      setFunds(startFunds);
      setRequests(source.requests || []);
      setDisbursements(source.disbursements || []);
      setLiquidations(source.liquidations || []);
      setReplenishments(source.replenishments || []);
      setAuditLog(source.auditLog || []);
      setDocuments(source.documents || []);
      setReimbursements(source.reimbursements || []);

      /* Baseline for per-record change detection. */
      const startState = {
        funds: startFunds, requests: source.requests || [], disbursements: source.disbursements || [],
        liquidations: source.liquidations || [], replenishments: source.replenishments || [],
        auditLog: source.auditLog || [], documents: source.documents || [], reimbursements: source.reimbursements || [],
      };
      if (!readFailed && (seedFromBlob || !rows.length)) {
        /* Either a legacy migration, or an empty store that needs initialising.
           Diff against an empty baseline so everything we hold — at minimum the
           master funds — is written to pcp_records once. Initialising matters:
           while the table has no rows at all, every load would re-read the
           legacy blob looking for something to migrate.

           Gated on the read having SUCCEEDED. A failed read also arrives with
           zero rows, and seeding on that would have this tab write its seed
           funds over a database it never managed to look at. */
        syncedRef.current = snapshotSync({});
        try { syncRecords(diffSync(syncedRef.current, startState)); } catch (e) { /* best effort */ }
      } else {
        /* Normal path: what we loaded IS what the database holds, so nothing
           needs writing back. Only real edits from here on are synced. */
        syncedRef.current = snapshotSync(startState);
      }
      setRecordsUnavailable(!!window.PCP_RECORDS_UNAVAILABLE);
      setLoadFailed(readFailed);
      setLoaded(true);

      /* ---- Deferred: the receipt payloads ----
         Liquidations, reimbursements and PCF documents hold their uploads as
         base64 INSIDE the record, so those three collections are tens of
         megabytes while everything a screen actually lists is a few hundred
         kilobytes. They are therefore left out of the load above and streamed
         in here, once the portal is already usable.

         Each row is folded in exactly the way a realtime change is: recorded
         in syncedRef FIRST, so the save effect treats it as already-synced and
         does not echo it straight back to the database. */
      const records = window.storage && window.storage.records;
      if (records && records.getHeavy) {
        records.getHeavy((change) => {
          noteLiveChangeSynced(syncedRef.current, change);
          applyLiveChange(change, {
            liquidations: setLiquidations,
            reimbursements: setReimbursements,
            documents: setDocuments,
          });
        }).then((ok) => { if (!ok) setReceiptsFailed(true); })
          .catch(() => setReceiptsFailed(true));
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const next = { dataVersion: DATA_VERSION, funds, requests, disbursements, liquidations, replenishments, auditLog, documents, reimbursements };
    /* The only write path: sync the records that actually changed to their own
       rows in Supabase. No blob, no browser copy — one store, so two accounts
       cannot end up looking at different versions of the same database. */
    try { syncRecords(diffSync(syncedRef.current, next)); } catch (e) { /* best effort */ }
  }, [funds, requests, disbursements, liquidations, replenishments, auditLog, documents, reimbursements, loaded]);

  /* ---- Live sync ----
     Streams every change to pcp_records into this tab, so accounts converge
     without a refresh. Each change is recorded in syncedRef BEFORE it is
     applied to state, so the save effect sees it as already-synced and does
     not echo it straight back — otherwise two open tabs would write to each
     other forever.

     Degrades silently: when Realtime is unavailable (a missing `realtime`
     schema, pcp_records not in the supabase_realtime publication, a blocked
     socket) subscribe() resolves to null and the portal behaves exactly as
     before, converging on page load. Nothing here is load-bearing. */
  useEffect(() => {
    if (!loaded) return undefined;
    if (!window.storage || !window.storage.records || !window.storage.records.subscribe) return undefined;
    const setters = {
      funds: setFunds, requests: setRequests, disbursements: setDisbursements,
      liquidations: setLiquidations, replenishments: setReplenishments,
      auditLog: setAuditLog, documents: setDocuments, reimbursements: setReimbursements,
    };
    let channel = null;
    let stopped = false;
    window.storage.records.subscribe((change) => {
      if (stopped) return;
      noteLiveChangeSynced(syncedRef.current, change);
      applyLiveChange(change, setters);
    }).then((ch) => {
      if (stopped && ch && ch.unsubscribe) { try { ch.unsubscribe(); } catch (e) { /* ignore */ } return; }
      channel = ch;
    }).catch(() => { /* live sync unavailable — page-load sync still works */ });
    return () => {
      stopped = true;
      if (channel && channel.unsubscribe) { try { channel.unsubscribe(); } catch (e) { /* ignore */ } }
    };
  }, [loaded]);

  /* ---- Requests ---- */
  /* Every Request No. in use across ALL plants — the local-mode fallback
     numbers from this. */
  const allRequestNos = useMemo(() => requests.map((r) => r.requestNo), [requests]);

  const addRequest = useCallback(async (form) => {
    /* The number is issued by the database (issueSeriesNo) the moment the
       request is saved — never taken from the form, so two people submitting
       at once cannot get the same one, and nobody can type one in. */
    const id = uid("req");
    let requestNo;
    try {
      requestNo = await issueSeriesNo(requestNoPrefix(form.branchCode), "requests", id, allRequestNos);
    } catch (e) { seriesFailed(e, "Request"); return; }
    if (form.previewNo && form.previewNo !== requestNo) {
      window.alert(`${form.previewNo} was taken by another request saved at the same time.\n\nYour request was saved as ${requestNo}.`);
    }
    setRequests((rs) => [...rs, {
      id, requestNo, date: form.date, employee: form.employee,
      department: form.department, branchCode: form.branchCode, purpose: form.purpose,
      purposeJustification: form.purposeJustification || "",
      amount: Number(form.amount), approver: form.approver, status: "Pending",
    }]);
    logAudit("Request Created", requestNo, `${form.employee} · ${peso(Number(form.amount))} · ${form.purpose}`);
  }, [logAudit, allRequestNos]); // eslint-disable-line

  const editRequest = useCallback(async (id, form) => {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    const released = disbursements.filter((d) => d.requestId === id);
    /* A released request cannot change plant: its voucher, liquidation and
       the fund they were drawn from all belong to the plant it was released
       under, and moving the request alone would give it the wrong prefix. */
    if (released.length && plantSeriesCode(r.branchCode) !== plantSeriesCode(form.branchCode)) {
      window.alert(
        `${r.requestNo} has already been released (${released.map((d) => d.voucherNo).join(", ")}) `
        + `and cannot be moved from ${plantNameOf(r.branchCode)} to ${plantNameOf(form.branchCode)}.\n\nNothing was saved.`
      );
      return;
    }
    setRequests((rs) => rs.map((x) => (x.id !== id ? x : {
      ...x, date: form.date, employee: form.employee, department: form.department,
      branchCode: form.branchCode, purpose: form.purpose,
      purposeJustification: form.purposeJustification || "", amount: Number(form.amount),
      approver: form.approver,
    })));
    logAudit("Edited", r.requestNo, `Request updated · ${form.employee} · ${peso(Number(form.amount))}`
      + (r.status === "Disbursed" ? " · edited after release (Accounting override — Release Ledger voucher unchanged)" : ""));

    /* Moved to another plant's branch: a new number in that plant's series. */
    await moveToPlantSeries(setRequests, "requestNo", r, form.branchCode, "PCR", "requests", allRequestNos);
  }, [logAudit, requests, disbursements, allRequestNos, userName, userEmail, role]); // eslint-disable-line

  /* Simple single-step approve / reject (the multi-level approval matrix was removed). */
  const approveRequest = useCallback((id) => {
    setRequests((rs) => rs.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Approved" } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Approved", r ? r.requestNo : id, "Request approved");
  }, [logAudit, requests]);

  const rejectRequest = useCallback((id) => {
    setRequests((rs) => rs.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Rejected" } : r)));
    const r = requests.find((x) => x.id === id);
    logAudit("Rejected", r ? r.requestNo : id, "Request rejected");
  }, [logAudit, requests]);

  /* ---- Disbursements ----
     The voucher carries its request's number (voucherNoForRequest), so the
     release stays traceable to the request on sight and follows it if the
     request is ever renumbered. The number used to be a portal-wide COUNT of
     vouchers, which re-issued an existing number after every delete.

     The number is claimed in the database registry at release. A voucher
     number is never issued twice, so when a request is released AGAIN after
     its first voucher was deleted, the retired number is skipped and the
     voucher is issued as PCV-M-2026-0007-1 — still visibly tied to its
     request. The dialog shows the expected number; the final one is claimed
     on confirm. */
  const nextVoucherNo = disburseTarget ? voucherNoForRequest(disburseTarget.requestNo) : "";

  /* The employee's advances that are not yet fully liquidated — shown on the
     release dialog and noted in the audit trail for MONITORING ONLY.

     An unliquidated previous advance no longer blocks a new one: the owner
     removed the rule "No new petty cash advance shall be released to an
     employee with unliquidated previous advances." Nothing here may refuse a
     release.

     Matched with samePerson (employee is free text, so capitalisation must not
     hide a match) and judged by liqFinalStatus (receipts approved AND cash
     settled), not by encoded expense lines alone. */
  const outstandingAdvancesFor = useCallback((employee) => disbursements
    .filter((d) => samePerson(d.employee, employee)
      && !liqIsComplete(liqFinalStatus(d, liquidationFor(d.id, liquidations))))
    .map((d) => ({ disb: d, status: liqFinalStatus(d, liquidationFor(d.id, liquidations)) })),
  [disbursements, liquidations]);

  const confirmDisburse = useCallback(async (extra) => {
    const req = disburseTarget;
    if (!req) return;
    /* Closed first, so a second click cannot release twice while the
       database is claiming the number. */
    setDisburseTarget(null);
    const outstanding = outstandingAdvancesFor(req.employee);
    if (disbursements.some((d) => d.requestId === req.id)) {
      window.alert(`${req.requestNo} has already been released.`);
      return;
    }
    const id = uid("dv");
    let voucherNo;
    try {
      voucherNo = await claimSeriesNo(voucherNoForRequest(req.requestNo), "disbursements", id, false, disbursements.map((d) => d.voucherNo));
    } catch (e) { seriesFailed(e, "voucher"); return; }
    setDisbursements((ds) => [...ds, {
      id, voucherNo, date: extra.date, requestId: req.id,
      employee: req.employee, branchCode: req.branchCode, department: req.department,
      expense: extra.expense || "", amount: extra.amount, status: "Open",
      remarks: extra.remarks, billed: false,
    }]);
    setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, status: "Disbursed" } : r)));
    logAudit("Released", voucherNo, `Cash released to ${req.employee} · ${peso(extra.amount)}`
      + (outstanding.length
        ? ` · employee has ${outstanding.length} unliquidated advance(s): ${outstanding.map((o) => `${o.disb.voucherNo} (${o.status})`).join(", ")}`
        : ""));
  }, [disburseTarget, logAudit, outstandingAdvancesFor, disbursements]); // eslint-disable-line

  const updateRemarks = useCallback((id, remarks) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, remarks } : d)));
  }, []);

  const editDisbursement = useCallback((id, patch) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const toggleBilled = useCallback((id) => {
    setDisbursements((ds) => ds.map((d) => (d.id === id ? { ...d, billed: !d.billed } : d)));
  }, []);

  /* ---- Liquidation ----
     Receipt amounts live on each supporting document. Every change to one is
     stamped into that document's own amountHistory (previous amount, new
     amount, who changed it, when, and why) as well as the global audit trail,
     so a receipt can be audited independently of the liquidation header. */
  const saveLiquidation = useCallback((disbursementId, lines, attachments, opts) => {
    const o = opts || {};
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const prevLiq = liquidations.find((l) => l.disbursementId === disbursementId) || null;
    /* What Grace Gan approved is what gets replenished — nothing under a final
       approval may change. */
    if (prevLiq && liqReview(prevLiq).final && prevLiq.workflow) {
      window.alert("This liquidation has final approval and can no longer be changed.");
      return;
    }
    const prevById = {};
    ((prevLiq && prevLiq.attachments) || []).forEach((a) => { prevById[a.id] = a; });

    const changes = [];
    const atts = (attachments || []).map((a) => {
      const prev = prevById[a.id];
      const amount = round2(a.receiptAmount);
      const carried = (prev && prev.amountHistory) || a.amountHistory || [];
      /* Approval state is authoritative on the STORED record — an approval made
         while the worksheet had unsaved edits must not be clobbered. */
      const base = {
        ...a,
        receiptAmount: amount,
        approvalStatus: prev ? (prev.approvalStatus || "Pending") : (a.approvalStatus || "Pending"),
        approvalHistory: prev ? (prev.approvalHistory || []) : (a.approvalHistory || []),
      };
      /* Likewise a saved rotation (SAVE FILE): a worksheet holding an older
         copy of the document must not point it back at the unrotated file. */
      if (prev && prev.rotatedAt && String(prev.rotatedAt) > String(a.rotatedAt || "")) {
        ["path", "name", "size", "type", "dataUrl", "fileId", "originalPath", "rotatedAt", "rotatedBy", "rotationHistory"]
          .forEach((k) => { base[k] = prev[k]; });
      }
      const prevAmount = prev ? round2(prev.receiptAmount) : null;
      if (prev && prevAmount !== amount) {
        const entry = { prevAmount, newAmount: amount, user: actor, ts, reason: o.reason || "" };
        changes.push({ name: a.name, ...entry });
        /* An approval is an approval OF AN AMOUNT. Change the amount and the
           receipt goes back to Pending — otherwise an approved ₱500 receipt
           could be saved as ₱5,000 and still count as approved. */
        const wasDecided = (base.approvalStatus || "Pending") !== "Pending";
        return {
          ...base, amountHistory: [...carried, entry],
          approvalStatus: wasDecided ? "Pending" : base.approvalStatus,
          approvalHistory: wasDecided
            ? [...base.approvalHistory, { approver: actor, ts, status: "Pending", remarks: `Amount changed ${peso(prevAmount)} → ${peso(amount)} — needs re-approval` }]
            : base.approvalHistory,
        };
      }
      if (!prev && amount > 0) {
        return { ...base, amountHistory: [...carried, { prevAmount: null, newAmount: amount, user: actor, ts, reason: o.reason || "Initial amount" }] };
      }
      return { ...base, amountHistory: carried };
    });

    /* Any change to the documents or their amounts after the custodian approved
       voids that approval: the custodian approved a specific set of receipts. */
    const prevIds = Object.keys(prevById).sort().join("|");
    const nextIds = atts.map((a) => a.id).sort().join("|");
    const docsChanged = changes.length > 0 || prevIds !== nextIds;
    const voidCheck = !!prevLiq && prevLiq.workflow && liqReview(prevLiq).checked && docsChanged;

    setLiquidations((ls) => {
      const exists = ls.find((l) => l.disbursementId === disbursementId);
      if (exists) {
        return ls.map((l) => {
          if (l.disbursementId !== disbursementId) return l;
          const next = { ...l, lines, attachments: atts };
          if (voidCheck) next.review = clearReview(l, actor, ts, "Custodian approval voided — receipts changed");
          return next;
        });
      }
      return [...ls, { id: uid("liq"), disbursementId, createdDate: todayISO(), lines, attachments: atts, submissionStatus: "Draft", workflow: 2 }];
    });
    if (voidCheck) logAudit("Liquidation Approval Voided", (disbursements.find((x) => x.id === disbursementId) || {}).voucherNo || disbursementId, "Receipts changed after custodian approval");
    setDisbursements((ds) => ds.map((d) => (d.id === disbursementId ? { ...d, status: "Closed" } : d)));
    const d = disbursements.find((x) => x.id === disbursementId);
    const voucher = d ? d.voucherNo : disbursementId;
    const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const receiptTotal = atts.reduce((s, a) => s + ((a.approvalStatus === "Approved") ? round2(a.receiptAmount) : 0), 0);
    logAudit("Liquidated", voucher, `${lines.length} receipt line(s) · ${peso(total)}${atts.length ? ` · ${atts.length} document(s) · approved receipts ${peso(receiptTotal)}` : ""}`);
    changes.forEach((c) => logAudit(
      "Receipt Amount Changed", voucher,
      `${c.name}: ${c.prevAmount == null ? "—" : peso(c.prevAmount)} → ${peso(c.newAmount)}${c.reason ? ` · ${c.reason}` : ""}`
    ));
  }, [logAudit, disbursements, liquidations, userName, role]);

  /* Submit the liquidation for custodian review. Receipt amounts become
     read-only afterwards for everyone except a checker. Submitting (or
     resubmitting after a rejection) always starts the two-level review afresh
     and moves the liquidation onto the new workflow. */
  const submitLiquidation = useCallback((disbursementId) => {
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, submissionStatus: "Submitted", submittedBy: actor, submittedAt: ts, workflow: 2,
            review: clearReview(l, actor, ts, "Review restarted — liquidation resubmitted") }
        : l
    )));
    const d = disbursements.find((x) => x.id === disbursementId);
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    const sum = receiptAmountSummary(liq);
    const rec = reconcileReceipts(d ? d.amount : 0, sum.allTotal);
    logAudit("Liquidation Submitted", d ? d.voucherNo : disbursementId,
      `Receipts claimed ${peso(sum.allTotal)} vs released ${peso(rec.released)}`
      + (rec.type === "excess" ? ` · refund due ${peso(rec.expected)}` : rec.type === "reimburse" ? ` · reimbursement due ${peso(rec.expected)} · FOR REVIEW` : " · exact")
      + " · for custodian review");
  }, [logAudit, disbursements, liquidations, userName, role]);

  /* Reopen a submitted liquidation for correction (checkers only, and never
     once it has final approval). Any review stamps are voided. */
  const reopenLiquidation = useCallback((disbursementId, reason) => {
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!isLiquidationChecker || !liq || (liq.workflow && liqReview(liq).final)) return;
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, submissionStatus: "Draft", review: clearReview(l, actor, ts, "Review voided — liquidation reopened") }
        : l
    )));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Liquidation Reopened", d ? d.voucherNo : disbursementId, reason || "");
  }, [logAudit, disbursements, liquidations, isLiquidationChecker, userName, role]);

  /* ---- Level 1: custodian approval of the liquidation ----
     Requires a submitted liquidation whose every receipt the checker has
     approved. The cash may be settled before or after; Grace Gan only sees it
     once both are done. */
  const checkLiquidation = useCallback((disbursementId, remarks) => {
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!isLiquidationChecker || !liq) return;
    const approval = receiptApprovalSummary(liq);
    const rv = liqReview(liq);
    if ((liq.submissionStatus || "Draft") !== "Submitted" || rv.checked || !approval.allApproved
      || !receiptAmountSummary(liq).complete) {
      window.alert("This liquidation cannot be approved yet — it must be submitted, with every receipt amount captured and every receipt approved.");
      return;
    }
    if (missingFinanceChecker()) return;
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (l.disbursementId === disbursementId ? {
      ...l, workflow: 2,
      review: {
        ...(l.review || {}), checkedBy: actor, financeChecker: activeFinanceChecker, checkedAt: ts, checkRemarks: remarks || "", finalBy: "", finalAt: "", finalRemarks: "",
        acctCheckedBy: "", acctCheckedByName: "", acctChecker: "", acctCheckedAt: "", acctRemarks: "", batchNo: "",
      },
    } : l)));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Liquidation Custodian Approved", d ? d.voucherNo : disbursementId,
      `Approved receipts ${peso(receiptAmountSummary(liq).approvedTotal)}${activeFinanceChecker ? ` · Finance Checker: ${activeFinanceChecker}` : ""}${remarks ? ` · ${remarks}` : ""} · for final approval`);
  }, [isLiquidationChecker, liquidations, disbursements, logAudit, userName, role, activeFinanceChecker]); // eslint-disable-line

  /* ---- Level 2: Grace Gan's final approval ----
     Only for a liquidation the custodian approved AND whose cash is settled.
     Makes it LIQUIDATED — Fully Approved / Ready for Replenishment. */
  const finalApproveLiquidation = useCallback((disbursementId, remarks) => {
    if (!isFinalApprover) {
      window.alert(`Only ${FINAL_APPROVER_NAME} can give final approval to a liquidation.`);
      return;
    }
    const d = disbursements.find((x) => x.id === disbursementId);
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!d || !liq) return;
    /* Custodian Approved AND Accounting Checked AND a Batch Number — or no
       final approval, whatever the UI showed. */
    if (!passesAccountingGate(liqReview(liq))) {
      window.alert(ACCOUNTING_GATE_MESSAGE);
      return;
    }
    if (liqApprovalStage(d, liq) !== LIQ_STAGE.FOR_FINAL) {
      window.alert("Only a liquidation the custodian has approved, with its cash settled, can be given final approval.");
      return;
    }
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    if (String(liqReview(liq).checkedBy).toLowerCase() === String(actor).toLowerCase()) {
      window.alert("The final approval must come from someone other than the custodian who approved it.");
      return;
    }
    setLiquidations((ls) => ls.map((l) => (l.disbursementId === disbursementId ? {
      ...l, review: { ...(l.review || {}), finalBy: actor, finalAt: ts, finalRemarks: remarks || "" },
    } : l)));
    logAudit("Liquidation Final Approved", d.voucherNo,
      `${peso(receiptAmountSummary(liq).approvedTotal)} · batch ${liqReview(liq).batchNo} · ready for replenishment${remarks ? ` · ${remarks}` : ""}`);
  }, [isFinalApprover, liquidations, disbursements, logAudit, userName, role]);

  /* ---- Accounting review: Assign Batch Number / Mark as Checked / Undo ----
     kind "liq" (id = disbursementId) or "reimb" (id = reimbursement id).
     Only Accounting. Applies to NEW and OLD transactions alike:
       "flow"  — custodian approved, awaiting final approval (the gate);
       "retro" — an old transaction already approved, checked after the fact
                 so every record carries its Accounting check and batch.
     A retro check ONLY adds the Accounting fields — approvals, status and
     every other field stay exactly as they were. The checker is stamped by
     EMAIL with the system time. Every rule is re-checked here so a bypassed
     UI still fails. */
  const accountingReview = useCallback((kind, id, action, payload) => {
    if (!isAccountingChecker) {
      window.alert("Only Accounting can review a transaction and assign its Batch Number.");
      return;
    }
    const p = payload || {};
    const batchNo = normalizeBatchNo(p.batchNo);
    const remarks = String(p.remarks || "").trim();
    const ts = new Date().toISOString();
    const by = (userEmail || "").trim().toLowerCase();
    const byName = userName || role;
    if ((action === "assign-batch" || action === "check") && !batchNo) {
      window.alert("Assign a Batch Number first.");
      return;
    }
    /* The named Accounting Checker (ACCOUNTING_CHECKER_NAMES): required on a
       check when this account has names, and must be one of them. */
    const checkerNames = accountingCheckerNamesFor(by);
    const checker = String(p.checker || "").trim();
    if (action === "check" && checkerNames.length && !checkerNames.includes(checker)) {
      window.alert("Select the Accounting Checker (your name) before marking this transaction as checked.");
      return;
    }
    const stamp = (cur, mode) => {
      if (action === "assign-batch") return { ...cur, batchNo };
      if (action === "check") {
        return {
          ...cur, batchNo, acctCheckedBy: by, acctCheckedByName: byName, acctChecker: checker, acctCheckedAt: ts, acctRemarks: remarks,
          acctRetro: mode === "retro",
        };
      }
      /* undo — the old stamps go to review.history, never silently lost. */
      return {
        ...cur, acctCheckedBy: "", acctCheckedByName: "", acctChecker: "", acctCheckedAt: "", acctRemarks: "", acctRetro: false,
        history: (cur.history || []).concat([{
          action: `Accounting check undone${remarks ? ` — ${remarks}` : ""}`, user: byName, ts,
          acctCheckedBy: cur.acctCheckedBy || "", acctChecker: cur.acctChecker || "", acctCheckedAt: cur.acctCheckedAt || "", batchNo: cur.batchNo || "",
        }]),
      };
    };
    const verb = action === "assign-batch" ? "Batch Number Assigned" : action === "check" ? "Accounting Checked" : "Accounting Check Undone";
    /* Undo never strips a check that a final approval relied on: allowed
       before final approval, or on a check that was itself made after the
       fact (retro). */
    const undoAllowed = (mode, rv) => mode === "flow" || (mode === "retro" && rv.acctRetro);
    const tag = (mode) => (mode === "retro" ? " · recorded on an already-approved transaction (approval unchanged)" : "");
    const checkedBy = action === "check" && checker ? ` · Accounting Checker: ${checker}` : "";
    const note = (mode) => (action === "undo" ? (remarks || "") : `Batch ${batchNo}${checkedBy}${remarks ? ` · ${remarks}` : ""}${tag(mode)}`);

    if (kind === "liq") {
      const d = disbursements.find((x) => x.id === id);
      const liq = liquidations.find((l) => l.disbursementId === id);
      const rv = liqReview(liq);
      const mode = liqAcctMode(liq);
      if (!d || !liq || !inScope(d.branchCode) || !mode) {
        window.alert("Accounting can review a liquidation once the custodian has approved it (or an old liquidation that is already approved).");
        return;
      }
      if (action !== "undo" && rv.acctChecked) { window.alert("This liquidation is already checked by Accounting."); return; }
      if (action === "undo" && (!rv.acctChecked || !undoAllowed(mode, rv))) {
        window.alert("This Accounting check was relied on by the final approval and cannot be undone.");
        return;
      }
      setLiquidations((ls) => ls.map((l) => (l.disbursementId === id ? { ...l, review: stamp(l.review || {}, mode) } : l)));
      logAudit("Liquidation " + verb, d.voucherNo, note(mode));
      return;
    }
    if (kind === "reimb") {
      const r0 = reimbursements.find((x) => x.id === id);
      const rv = reimbReview(r0);
      const mode = reimbAcctMode(r0);
      if (!r0 || !inScope(r0.branchCode) || !mode) {
        window.alert("Accounting can review a reimbursement once the custodian has approved it (or an old reimbursement that is already approved).");
        return;
      }
      if ([r0.createdBy, r0.employee].some((n) => (n || "").trim().toLowerCase() === String(byName).toLowerCase())) {
        window.alert("Segregation of duties: you cannot check your own reimbursement request.");
        return;
      }
      if (action !== "undo" && rv.acctChecked) { window.alert("This reimbursement is already checked by Accounting."); return; }
      if (action === "undo" && (!rv.acctChecked || !undoAllowed(mode, rv))) {
        window.alert("This Accounting check was relied on by the final approval and cannot be undone.");
        return;
      }
      setReimbursements((rs) => rs.map((r) => (r.id !== id ? r : {
        ...r, review: stamp(r.review || {}, mode),
        history: [...(r.history || []), { ts: reimbTs(), user: byName, action: verb, prevStatus: r.status, newStatus: r.status, comments: note(mode) }],
      })));
      logAudit("Reimbursement " + verb, r0.reimbNo, note(mode));
    }
  }, [isAccountingChecker, userEmail, userName, role, disbursements, liquidations, reimbursements, inScope, logAudit]); // eslint-disable-line

  /* Every Batch Number in use, with how many transactions carry it, and the
     next free one — for the Accounting batch picker. */
  const accountingBatches = useMemo(() => {
    const counts = {};
    const add = (rv) => { if (rv.batchNo) counts[rv.batchNo] = (counts[rv.batchNo] || 0) + 1; };
    liquidations.forEach((l) => add(liqReview(l)));
    reimbursements.forEach((r) => add(reimbReview(r)));
    const batches = Object.keys(counts).sort().reverse().map((b) => ({ batchNo: b, count: counts[b] }));
    return { batches, nextBatchNo: nextBatchNumber(Object.keys(counts)) };
  }, [liquidations, reimbursements]);
  const accountingProps = useMemo(() => ({
    isChecker: isAccountingChecker, checkerNames: accountingCheckerNamesFor(userEmail), batches: accountingBatches.batches,
    nextBatchNo: accountingBatches.nextBatchNo, onReview: accountingReview,
  }), [isAccountingChecker, userEmail, accountingBatches, accountingReview]);

  /* Record that the refund or reimbursement cash has ACTUALLY changed hands.
     The actual amount is stored so it can be checked against the expected one. */
  /* ---- Recording a cash movement against a settlement ----
     ADDS an entry; it never overwrites the running total. A settlement that
     arrives in two payments keeps both, each with its own date, amount, who
     took it in and why it fell short — which is what makes an outstanding
     balance chaseable instead of invisible.

     `clear: true` wipes every entry and any shortage closure, returning the
     settlement to untouched. That is the only destructive path, and it is what
     the "Clear Settlement" button uses. */
  const recordSettlement = useCallback((disbursementId, payload) => {
    /* A custodian act, never the requestor's: the person who owes the cash
       must not be able to record that it came back, or clear a shortage. */
    if (!isLiquidationChecker || isLiquidationFinalLocked(disbursementId)) return;
    const p = payload || {};
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const amount = round2(p.amount);
    const d = disbursements.find((x) => x.id === disbursementId);
    const voucher = d ? d.voucherNo : disbursementId;

    if (!p.clear && !(amount > 0)) return;

    setLiquidations((ls) => ls.map((l) => {
      if (l.disbursementId !== disbursementId) return l;
      const prev = l.settlement || {};
      if (p.clear) {
        return {
          ...l,
          settlement: {
            ...prev, type: p.type, expectedAmount: round2(p.expectedAmount),
            entries: [],
            /* The legacy single-figure fields are zeroed too, or settlementEntries
               would keep resurrecting the old amount as a synthetic entry. */
            completed: false, actualAmount: 0, recordedBy: "", recordedAt: "",
            closure: null,
          },
        };
      }
      const entries = (Array.isArray(prev.entries) ? prev.entries : settlementEntries(l)).concat([{
        id: uid("stl"), amount, date: p.date || todayISO(),
        recordedBy: actor, recordedAt: ts, reason: p.reason || "",
        /* How the cash moved and the proof of it (RecordSettlementModal). */
        mode: p.mode || "Cash", reference: p.reference || "", receivedBy: p.receivedBy || "",
        ackFile: p.ackFile || null,
      }]);
      const total = round2(entries.reduce((t, e) => t + (Number(e.amount) || 0), 0));
      return {
        ...l,
        settlement: {
          ...prev, type: p.type, expectedAmount: round2(p.expectedAmount),
          entries,
          /* Mirrored onto the old fields so anything still reading them — an
             export, an older report — sees the running total, not the first
             payment only. */
          completed: true, actualAmount: total, recordedBy: actor, recordedAt: ts,
        },
      };
    }));

    if (p.clear) {
      logAudit("Cash Settlement Cleared", voucher, "Every recorded movement and any shortage closure removed");
      return;
    }
    const label = p.type === "excess" ? "cash returned" : "reimbursement paid";
    const outstanding = round2(round2(p.expectedAmount) - round2(p.runningTotal || 0) - amount);
    logAudit("Cash Settlement Recorded", voucher,
      `${label} ${peso(amount)} · ${p.mode || "Cash"}`
      + (p.reference ? ` ref ${p.reference}` : "")
      + (p.receivedBy ? ` · received by ${p.receivedBy}` : "")
      + ` · expected ${peso(p.expectedAmount)}`
      + (outstanding > 0 ? ` · SHORT by ${peso(outstanding)}` : "")
      + (outstanding < 0 ? ` · OVER by ${peso(Math.abs(outstanding))}` : "")
      + (p.reason ? ` · ${p.reason}` : ""));
  }, [logAudit, disbursements, userName, role, isLiquidationChecker, isLiquidationFinalLocked]);

  /* ---- Closing an unrecovered shortage ----
     Accepts the outstanding balance as a receivable from the requestor so the
     liquidation can complete, and stamps who decided that and why. The status
     becomes LIQUIDATED (SHORT), never plain LIQUIDATED, so the balance stays
     visible. Role is re-checked here because a UI check alone is not a control. */
  const closeShortage = useCallback((disbursementId, payload) => {
    if (!canApproveShortage || isLiquidationFinalLocked(disbursementId)) return;
    const p = payload || {};
    const reason = String(p.reason || "").trim();
    if (!reason) return;
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (l.disbursementId === disbursementId ? {
      ...l,
      settlement: {
        ...(l.settlement || {}),
        closure: {
          closedBy: actor, closedAt: ts, reason,
          shortageAmount: round2(p.shortageAmount), treatment: p.treatment || "Receivable from requestor",
        },
      },
    } : l)));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Cash Shortage Closed", d ? d.voucherNo : disbursementId,
      `${peso(p.shortageAmount)} unrecovered · ${p.treatment || "Receivable from requestor"} · ${reason}`);
  }, [logAudit, disbursements, userName, role, canApproveShortage, isLiquidationFinalLocked]);

  /* Reverses a shortage closure, putting the liquidation back to PARTIALLY
     SETTLED. Same authority as closing it. */
  const reopenShortage = useCallback((disbursementId) => {
    if (!canApproveShortage || isLiquidationFinalLocked(disbursementId)) return;
    setLiquidations((ls) => ls.map((l) => (l.disbursementId === disbursementId ? {
      ...l, settlement: { ...(l.settlement || {}), closure: null },
    } : l)));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Cash Shortage Reopened", d ? d.voucherNo : disbursementId,
      "Shortage closure reversed — the balance is outstanding again");
  }, [logAudit, disbursements, canApproveShortage, isLiquidationFinalLocked]);

  /* Reviewer sign-off on an over-liquidation. Without this the liquidation can
     never reach LIQUIDATED, so an excess claim is never auto-approved. */
  const reviewOverLiquidation = useCallback((disbursementId, remarks) => {
    if (!isLiquidationChecker || isLiquidationFinalLocked(disbursementId)) return;
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, settlement: { ...(l.settlement || {}), reviewedBy: actor, reviewedAt: ts, reviewRemarks: remarks || "" } }
        : l
    )));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit("Over-Liquidation Reviewed", d ? d.voucherNo : disbursementId, remarks || "");
  }, [logAudit, disbursements, userName, role, isLiquidationChecker, isLiquidationFinalLocked]);

  /* ---- Liquidation rejection (checker, or Grace Gan at final approval) ----
     A rejection requires ONE standardized reason; the reviewer comment is
     optional and stored verbatim (empty stays empty — never a placeholder).
     Each rejection is appended as its own record and never overwrites an
     earlier one, and the liquidation returns to an editable state so the
     requestor can correct and resubmit — the review then starts over.
     Authorization is re-checked here, so a bypassed UI cannot reject through
     this handler. A liquidation with final approval cannot be rejected. */
  const rejectLiquidation = useCallback((disbursementId, payload) => {
    const d0 = disbursements.find((x) => x.id === disbursementId);
    const liq0 = liquidations.find((l) => l.disbursementId === disbursementId);
    const allowed = liq0 && !isLiquidationFinalLocked(disbursementId) && (
      (isLiquidationChecker && (liq0.submissionStatus || "Draft") === "Submitted")
      || (isFinalApprover && liqApprovalStage(d0, liq0) === LIQ_STAGE.FOR_FINAL)
    );
    if (!allowed) {
      window.alert(`Only the custodian (while it is under review) or ${FINAL_APPROVER_NAME} (at final approval) can reject this liquidation.`);
      return;
    }
    const reason = String((payload && payload.reason) || "").trim();
    if (!isValidLiquidationRejectionReason(reason)) {
      window.alert("Please select a rejection reason.");
      return;
    }
    const comment = String((payload && payload.comment) || "").trim();
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const d = disbursements.find((x) => x.id === disbursementId);
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!liq) return;
    const req = d ? requests.find((r) => r.id === d.requestId) : null;
    const prevStatus = liqFinalStatus(d, liq);
    const record = {
      id: uid("rej"),
      liquidationId: liq.id,
      pcfRequestor: d ? d.employee : "",
      reimbursementRequestor: "",
      purpose: req ? req.purpose : "",
      amount: d ? d.amount : 0,
      reason,
      comment, // empty string when no comment — no placeholder text
      rejectedBy: actor,
      rejectedAt: ts,
      prevStatus,
      newStatus: "REJECTED",
    };
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId
        ? { ...l, submissionStatus: "Rejected", rejections: [...(l.rejections || []), record],
            review: clearReview(l, actor, ts, `Review voided — rejected: ${reason}`) }
        : l
    )));
    logAudit("Liquidation Rejected", d ? d.voucherNo : disbursementId,
      `Reason: ${reason}${comment ? ` · Comment: ${comment}` : ""} · ${prevStatus} → REJECTED`);
  }, [isLiquidationChecker, isFinalApprover, isLiquidationFinalLocked, logAudit, disbursements, liquidations, requests, userName, role]);

  /* ---- Revert to Requestor (REVERT_EMAILS) ----
     A submitted liquidation that is not yet final-approved goes back to the
     requestor as FOR SUBMISSION with the custodian's reason. The requestor
     edits / uploads and resubmits with the normal Submit, which restarts the
     review. Same record and voucher; receipts and their decisions stay; any
     approval stamps are archived by clearReview; the revert is kept in
     liq.reverts and the audit trail. */
  const revertLiquidation = useCallback((disbursementId, reason) => {
    const liq0 = liquidations.find((l) => l.disbursementId === disbursementId);
    const why = String(reason || "").trim();
    if (!canRevert || !liq0 || (liq0.submissionStatus || "Draft") !== "Submitted" || isLiquidationFinalLocked(disbursementId)) {
      window.alert("Only a custodian can revert a liquidation, and only while it is submitted and not yet final-approved.");
      return;
    }
    if (!why) { window.alert("Enter the reason for the revert — the requestor sees it."); return; }
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const d = disbursements.find((x) => x.id === disbursementId);
    const prevStatus = liqFinalStatus(d, liq0);
    const entry = { id: uid("rev"), revertedBy: actor, revertedAt: ts, reason: why, prevStatus };
    setLiquidations((ls) => ls.map((l) => (
      l.disbursementId === disbursementId && (l.submissionStatus || "Draft") === "Submitted"
        ? { ...l, submissionStatus: LIQ_FOR_SUBMISSION, reverts: [...liqReverts(l), entry],
            review: clearReview(l, actor, ts, `Review voided — reverted to requestor: ${why}`) }
        : l
    )));
    logAudit("Liquidation Reverted to Requestor", d ? d.voucherNo : disbursementId,
      `Reason: ${why} · ${prevStatus} → FOR SUBMISSION`);
  }, [canRevert, isLiquidationFinalLocked, logAudit, disbursements, liquidations, userName, role]);

  /* ---- Receipt approval (per uploaded Official Receipt / Sales Invoice) ----
     Decided by the CHECKER (custodian level) once the requestor has submitted,
     while the amounts are locked. Each decision is stamped into the receipt's
     own approval history and the audit trail. Changing a decision after the
     custodian approved the liquidation voids that approval. */
  const decideReceipt = useCallback((disbursementId, attachmentId, decision, remarks) => {
    if (!isLiquidationChecker) {
      window.alert("Only a custodian (or Accounting / Finance) can approve or reject liquidation receipts.");
      return;
    }
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!liq || (liq.submissionStatus || "Draft") !== "Submitted" || isLiquidationFinalLocked(disbursementId)) {
      window.alert("Receipts can only be decided on a submitted liquidation that has not had final approval.");
      return;
    }
    const target = (liq.attachments || []).find((a) => a.id === attachmentId);
    if (!target) return;
    const ts = new Date().toISOString().slice(0, 19);
    const approver = userName || role;
    const voidCheck = liqReview(liq).checked && (target.approvalStatus || "Pending") !== decision;
    setLiquidations((ls) => ls.map((l) => {
      if (l.disbursementId !== disbursementId) return l;
      const attachments = (l.attachments || []).map((a) => (a.id !== attachmentId ? a : {
        ...a,
        approvalStatus: decision,
        approvalHistory: [...(a.approvalHistory || []), { approver, ts, status: decision, remarks: remarks || "" }],
      }));
      const next = { ...l, attachments };
      if (voidCheck) next.review = clearReview(l, approver, ts, "Custodian approval voided — receipt decision changed");
      return next;
    }));
    const d = disbursements.find((x) => x.id === disbursementId);
    logAudit(
      decision === "Approved" ? "Receipt Approved" : "Receipt Rejected",
      d ? d.voucherNo : disbursementId,
      `${target.name || attachmentId}${remarks ? ` · ${remarks}` : ""}`
    );
  }, [isLiquidationChecker, isLiquidationFinalLocked, liquidations, logAudit, disbursements, userName, role]);

  /* ---- Deletion (System Superuser only — canDeleteTxn) ----
     Each delete leaves the surviving records consistent: a voucher takes its
     liquidation with it and frees the source request, and removing a liquidation
     reopens its voucher. Anything a replenishment has claimed is refused — the
     fund was already topped up against it. A deleted record's number is
     RETIRED, never reused or handed down: the gap it leaves is permanent and
     no other record is renumbered. Every deletion records the number, plant, who, when and why, in
     the audit trail and on the deleted row. Balances are always derived,
     never stored, so they re-compute on their own. */
  const deleteRequest = useCallback((id) => {
    const r = requests.find((x) => x.id === id);
    if (!r || !canDeleteTxn) return;
    /* A request that already produced a voucher must be deleted bottom-up, so
       the ledger never contains a voucher pointing at a missing request. */
    const linked = disbursements.filter((d) => d.requestId === id);
    if (linked.length) {
      window.alert(
        `"${r.requestNo}" cannot be deleted — cash has already been released against it `
        + `(${linked.map((d) => d.voucherNo).join(", ")}).\n\n`
        + "Delete the disbursement voucher first, then delete this request."
      );
      return;
    }
    const reason = confirmTxnDelete(r.requestNo,
      [`${plantNameOf(r.branchCode)} · ${r.employee} · ${peso(r.amount)} · ${r.purpose}`]);
    if (reason == null) return;
    stampDeleted(id, r.requestNo, r.branchCode, reason);
    setRequests((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r.requestNo, `Request deleted · Plant: ${plantNameOf(r.branchCode)} · ${r.employee} · ${peso(r.amount)} · Reason: ${reason} · number retired`);
  }, [logAudit, requests, disbursements, canDeleteTxn, userName, userEmail, role]); // eslint-disable-line

  /* A voucher has no run of its own — it carries its request's number, and
     the request (returned to Approved) keeps that number, so releasing it
     again re-issues the same voucher number. Nothing else is renumbered. */
  const deleteDisbursement = useCallback((id) => {
    const d = disbursements.find((x) => x.id === id);
    if (!d || !canDeleteTxn) return;
    const liq = liquidations.find((l) => l.disbursementId === id);
    const req = requests.find((r) => r.id === d.requestId);
    const claim = liq && claimedBy("liquidationIds", liq.id);
    if (claim) {
      window.alert(`${d.voucherNo} cannot be deleted — its liquidation is part of replenishment ${claim.replenishmentNo}.\n\n`
        + "Remove it from that replenishment (or delete the replenishment) first.");
      return;
    }
    const reason = confirmTxnDelete(d.voucherNo, [
      `${plantNameOf(d.branchCode)} · ${d.employee} · ${peso(d.amount)}`,
      liq ? `Its liquidation will also be deleted (${(liq.lines || []).length} expense line(s), ${(liq.attachments || []).length} supporting document(s)).` : "",
      req ? `Request ${req.requestNo} will return to "Approved" so it can be released again.` : "",
    ]);
    if (reason == null) return;
    stampDeleted(id, d.voucherNo, d.branchCode, reason);
    if (liq) stampDeleted(liq.id, d.voucherNo, d.branchCode, `${reason} (voucher deleted)`);
    setDisbursements((ds) => ds.filter((x) => x.id !== id));
    if (liq) setLiquidations((ls) => ls.filter((l) => l.disbursementId !== id));
    if (req) setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, status: "Approved" } : r)));
    logAudit("Deleted", d.voucherNo, `Disbursement deleted · Plant: ${plantNameOf(d.branchCode)} · ${d.employee} · ${peso(d.amount)}`
      + (liq ? " · liquidation removed" : "")
      + (req ? ` · ${req.requestNo} returned to Approved` : "")
      + ` · Reason: ${reason}`);
  }, [logAudit, disbursements, liquidations, requests, replenishments, canDeleteTxn, userName, userEmail, role]); // eslint-disable-line

  /* A liquidation is filed under its voucher's number and has none of its
     own, so deleting one renumbers nothing. */
  const deleteLiquidation = useCallback((disbursementId) => {
    const liq = liquidations.find((l) => l.disbursementId === disbursementId);
    if (!liq || !canDeleteTxn) return;
    const d = disbursements.find((x) => x.id === disbursementId);
    const voucher = d ? d.voucherNo : disbursementId;
    const claim = claimedBy("liquidationIds", liq.id);
    if (claim) {
      window.alert(`The liquidation for ${voucher} cannot be deleted — it is part of replenishment ${claim.replenishmentNo}.\n\n`
        + "Remove it from that replenishment (or delete the replenishment) first.");
      return;
    }
    const reason = confirmTxnDelete(`Liquidation for ${voucher}`, [
      d ? `${plantNameOf(d.branchCode)} · ${d.employee} · ${peso(d.amount)}` : "",
      `${(liq.lines || []).length} expense line(s) and ${(liq.attachments || []).length} supporting document(s) `
        + "will be removed, along with any recorded cash settlement and approvals. The voucher returns to the liquidation worklist.",
    ]);
    if (reason == null) return;
    stampDeleted(liq.id, voucher, d && d.branchCode, reason);
    setLiquidations((ls) => ls.filter((l) => l.disbursementId !== disbursementId));
    setDisbursements((ds) => ds.map((x) => (x.id === disbursementId ? { ...x, status: "Open" } : x)));
    logAudit("Deleted", voucher, `Liquidation deleted · Plant: ${plantNameOf(d && d.branchCode)} · ${(liq.lines || []).length} line(s) · ${(liq.attachments || []).length} document(s) · Reason: ${reason}`);
  }, [logAudit, liquidations, disbursements, replenishments, canDeleteTxn, userName, userEmail, role]); // eslint-disable-line

  /* Audit entries are deletable by the SuperAdmin. One summary entry replaces
     what was removed so a deletion is not completely silent — note that the
     replacement entry can itself be deleted, so the trail is no longer
     tamper-evident once this is used. */
  const deleteAuditEntries = useCallback((ids) => {
    const set = new Set(ids || []);
    if (!set.size) return;
    const removed = auditLog.filter((a) => set.has(a.id));
    if (!removed.length) return;
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || role;
    const detail = removed.slice(0, 6).map((a) => `${a.action} · ${a.entity}`).join("; ")
      + (removed.length > 6 ? ` …and ${removed.length - 6} more` : "");
    setAuditLog((log) => [
      ...log.filter((a) => !set.has(a.id)),
      {
        id: uid("aud"), ts, user: actor, action: "Audit Entry Deleted",
        entity: `${removed.length} entr${removed.length === 1 ? "y" : "ies"}`,
        remarks: detail,
      },
    ]);
  }, [auditLog, userName, role]);

  /* ---- Replenishment ---- */
  /* Names the approved liquidations a replenishment claims, for the audit trail. */
  const linkedVouchers = (ids) => (ids || []).map((lid) => {
    const l = liquidations.find((x) => x.id === lid);
    const d = l && disbursements.find((x) => x.id === l.disbursementId);
    return d ? d.voucherNo : lid;
  });

  const linkedReimbNos = (ids) => (ids || []).map((rid) => {
    const r = reimbursements.find((x) => x.id === rid);
    return r ? r.reimbNo : rid;
  });

  /* The next Replenishment No. for a plant, checked against every plant's
     numbers. Assigned here on save, never trusted from the form. */
  const addReplenishment = useCallback(async (form) => {
    /* Issued by the database on save (issueSeriesNo), never from the form. */
    const id = uid("rep");
    let replenishmentNo;
    try {
      replenishmentNo = await issueSeriesNo(replenishmentNoPrefix(form.branchCode), "replenishments", id,
        replenishments.map((r) => r.replenishmentNo));
    } catch (e) { seriesFailed(e, "Replenishment"); return; }
    setReplenishments((rs) => [...rs, { ...form, id, replenishmentNo }]);
    const linked = linkedVouchers(form.liquidationIds);
    const linkedR = linkedReimbNos(form.reimbursementIds);
    logAudit("Replenished", replenishmentNo, `${peso(Number(form.amount))}${form.status ? ` · ${form.status}` : ""}`
      + (linked.length ? ` · liquidations: ${linked.join(", ")}` : "")
      + (linkedR.length ? ` · reimbursements: ${linkedR.join(", ")}` : ""));
  }, [logAudit, liquidations, disbursements, reimbursements, replenishments]); // eslint-disable-line

  const editReplenishment = useCallback(async (id, form) => {
    const r0 = replenishments.find((x) => x.id === id);
    if (!canManageReplen || !r0 || r0.status === "Reverted") return;
    /* The number is never taken from the form; only a plant move changes it. */
    const { replenishmentNo: _ignored, ...fields } = form;
    setReplenishments((rs) => rs.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    const linked = linkedVouchers(form.liquidationIds);
    const linkedR = linkedReimbNos(form.reimbursementIds);
    logAudit("Edited", (r0 && r0.replenishmentNo) || id, `Replenishment updated · ${peso(Number(form.amount))}${form.status ? ` · ${form.status}` : ""}`
      + (linked.length ? ` · liquidations: ${linked.join(", ")}` : "")
      + (linkedR.length ? ` · reimbursements: ${linkedR.join(", ")}` : ""));
    await moveToPlantSeries(setReplenishments, "replenishmentNo", r0, form.branchCode, "RPL", "replenishments",
      replenishments.map((r) => r.replenishmentNo));
  }, [logAudit, liquidations, disbursements, reimbursements, replenishments, canManageReplen, userName, userEmail, role]); // eslint-disable-line

  const completeReplenishment = useCallback((id) => {
    if (!canManageReplen) return;
    setReplenishments((rs) => rs.map((r) => (r.id === id ? { ...r, status: "Completed" } : r)));
    const r = replenishments.find((x) => x.id === id);
    logAudit("Replenished", r ? r.replenishmentNo : id, `Marked completed${r ? ` · ${peso(Number(r.amount))}` : ""}`);
  }, [logAudit, replenishments, canManageReplen]);

  /* Revert: undoes a replenishment without deleting it. The record stays (its
     number stays retired) marked Reverted with who, when and why; the
     liquidations and reimbursements it claimed are released back to Ready for
     Replenishment (kept on the record as revertedLiquidationIds /
     revertedReimbursementIds for the audit trail). A Completed one also stops
     counting toward the fund's replenished total. */
  const revertReplenishment = useCallback((id) => {
    const r = replenishments.find((x) => x.id === id);
    if (!canManageReplen || !r || r.status === "Reverted") return;
    const claims = (r.liquidationIds || []).length + (r.reimbursementIds || []).length;
    const reason = window.prompt(
      `Revert ${r.replenishmentNo}?\n\n${plantNameOf(r.branchCode)} · ${peso(Number(r.amount))}${r.status ? ` · ${r.status}` : ""}`
      + (claims ? `\n${claims} approved liquidation(s) / reimbursement(s) will return to Ready for Replenishment.` : "")
      + "\n\nThe record is kept, marked Reverted. Enter the reason:"
    );
    if (reason == null) return;
    if (!reason.trim()) { window.alert("A reason is required to revert a replenishment. Nothing was changed."); return; }
    const ts = new Date().toISOString().slice(0, 19);
    setReplenishments((rs) => rs.map((x) => (x.id !== id ? x : {
      ...x, status: "Reverted", prevStatus: x.status || "",
      liquidationIds: [], reimbursementIds: [],
      revertedLiquidationIds: x.liquidationIds || [], revertedReimbursementIds: x.reimbursementIds || [],
      revertedBy: userName || userEmail || role, revertedAt: ts, revertReason: reason.trim(),
    })));
    logAudit("Edited", r.replenishmentNo, `Replenishment reverted (was ${r.status || "—"}) · ${peso(Number(r.amount))} · Reason: ${reason.trim()}`
      + (claims ? ` · ${claims} item(s) returned to Ready for Replenishment` : ""));
  }, [logAudit, replenishments, canManageReplen, userName, userEmail, role]); // eslint-disable-line

  /* Revert an item in the Ready for Replenishment list: undoes its FINAL
     approval so it can be corrected or re-decided. The custodian approval and
     Accounting check are kept, so it goes back to For Final Approval. (A
     liquidation approved before the two-level review has no such stamps and
     goes back to custodian review.) The voided approval is kept in
     review.history. Only an item no replenishment has claimed yet — revert
     the replenishment first otherwise. */
  const revertReadyItem = useCallback((kind, id) => {
    if (!canManageReplen) return;
    const claimed = kind === "liq"
      ? replenishedLiquidationIds(replenishments).has(id)
      : replenishedReimbursementIds(replenishments).has(id);
    if (claimed) { window.alert("This item is already on a replenishment. Revert that replenishment first."); return; }
    const ts = new Date().toISOString().slice(0, 19);
    const actor = userName || userEmail || role;
    const ask = (ref, where) => {
      const reason = window.prompt(`Revert ${ref}?\n\nIts final approval is voided and it goes back to ${where}.\n\nEnter the reason:`);
      if (reason == null) return null;
      if (!reason.trim()) { window.alert("A reason is required to revert. Nothing was changed."); return null; }
      return reason.trim();
    };
    const voided = (rv, note, reason) => (rv.history || []).concat([{
      action: note, user: actor, ts, reason,
      checkedBy: rv.checkedBy || "", financeChecker: rv.financeChecker || "", checkedAt: rv.checkedAt || "",
      acctCheckedBy: rv.acctCheckedBy || "", acctChecker: rv.acctChecker || "", acctCheckedAt: rv.acctCheckedAt || "", batchNo: rv.batchNo || "",
      finalBy: rv.finalBy || "", finalAt: rv.finalAt || "",
    }]);
    if (kind === "liq") {
      const liq = liquidations.find((l) => l.id === id);
      if (!liq || !liqReview(liq).final) return;
      const d = disbursements.find((x) => x.id === liq.disbursementId);
      const ref = d ? d.voucherNo : id;
      const legacy = !liq.workflow;
      const reason = ask(ref, legacy ? "custodian review" : "For Final Approval");
      if (!reason) return;
      setLiquidations((ls) => ls.map((l) => {
        if (l.id !== id) return l;
        const rv = l.review || {};
        return legacy
          ? { ...l, workflow: 2, review: { ...acctStamps(rv), history: voided(rv, "Final approval reverted from Ready for Replenishment", reason) } }
          : { ...l, review: { ...rv, finalBy: "", finalAt: "", finalRemarks: "", history: voided(rv, "Final approval reverted from Ready for Replenishment", reason) } };
      }));
      logAudit("Liquidation Approval Voided", ref, `Reverted from Ready for Replenishment by ${actor} · Reason: ${reason}`);
      return;
    }
    const r0 = reimbursements.find((x) => x.id === id);
    if (!r0 || r0.status !== REIMB_STATUS.READY) return;
    const reason = ask(r0.reimbNo, "For Final Approval");
    if (!reason) return;
    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id || r.status !== REIMB_STATUS.READY) return r;
      const rv = r.review || {};
      return {
        ...r, status: REIMB_STATUS.FOR_FINAL, approvedBy: "", approvedAt: "",
        review: { ...rv, finalBy: "", finalAt: "", finalRemarks: "", history: voided(rv, "Final approval reverted from Ready for Replenishment", reason) },
        history: [...(r.history || []), { ts: reimbTs(), user: actor, action: "Final approval reverted (Ready for Replenishment)", prevStatus: r.status, newStatus: REIMB_STATUS.FOR_FINAL, comments: reason }],
      };
    }));
    logAudit("Edited", r0.reimbNo, `Reimbursement final approval reverted from Ready for Replenishment · Reason: ${reason}`);
  }, [canManageReplen, replenishments, liquidations, disbursements, reimbursements, logAudit, userName, userEmail, role]); // eslint-disable-line

  const deleteReplenishment = useCallback((id) => {
    const r = replenishments.find((x) => x.id === id);
    if (!r || !canDeleteTxn) return;
    const claims = (r.liquidationIds || []).length + (r.reimbursementIds || []).length;
    const reason = confirmTxnDelete(r.replenishmentNo, [
      `${plantNameOf(r.branchCode)} · ${peso(Number(r.amount))}${r.status ? ` · ${r.status}` : ""}`,
      claims ? `${claims} approved liquidation(s) / reimbursement(s) it claims will return to Ready for Replenishment.` : "",
    ]);
    if (reason == null) return;
    stampDeleted(id, r.replenishmentNo, r.branchCode, reason);
    setReplenishments((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r.replenishmentNo, `Replenishment deleted · Plant: ${plantNameOf(r.branchCode)} · ${peso(Number(r.amount))} · Reason: ${reason} · number retired`);
  }, [logAudit, replenishments, canDeleteTxn, userName, userEmail, role]); // eslint-disable-line

  const exportLiquidation = useCallback((disbursement, liq) => {
    const rows = buildLiquidationExportRows(disbursement, liq);
    const meta = [
      ["Petty Cash Liquidation — Acumatica Import Sheet"],
      ["Voucher No.", disbursement.voucherNo],
      ["Employee", disbursement.employee],
      ["Branch", disbursement.branchCode],
      ["Company", companyOfBranch(disbursement.branchCode)],
      ["Requested Amount", disbursement.amount],
      ["Total Liquidated", rows.reduce((s, r) => s + r.Amount, 0)],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1, header: ACUMATICA_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Liquidation");
    downloadWorkbook(wb, `Liquidation_${disbursement.voucherNo}.xlsx`);
  }, []);

  const exportAllToAcumatica = useCallback(() => {
    const rows = buildAllAcumaticaExportRows(disbursements, liquidations);
    const ws = XLSX.utils.json_to_sheet(rows, { header: ACUMATICA_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ACUMATICA_PO_SHEET_NAME);
    downloadWorkbook(wb, `Acumatica_PO_Export_All_${todayISO()}.xlsx`);
  }, [disbursements, liquidations]);

  /* ---- Funds ----
     Every mutation here is audit-logged. A fund's beginning balance feeds the
     available-balance figure for its whole plant family, so an unrecorded edit
     silently restates the plant's cash position with no way to trace who did
     it or what the previous figure was. */
  const addFund = useCallback((f) => {
    setFunds((fs) => [...fs, { id: uid("fund"), ...f }]);
    logAudit("Fund Created", f.label || f.branchCode || "—",
      `${f.branchCode || "—"} · custodian ${f.custodian || "—"} · beginning ${peso(Number(f.beginningBalance) || 0)}`);
  }, [logAudit]);
  const editFund = useCallback((id, f) => {
    const prev = funds.find((x) => x.id === id);
    setFunds((fs) => fs.map((x) => (x.id === id ? { ...x, ...f } : x)));
    const before = Number(prev && prev.beginningBalance) || 0;
    const after = Number(f.beginningBalance) || 0;
    logAudit("Fund Edited", (prev && prev.label) || f.label || id,
      before !== after
        ? `Beginning balance ${peso(before)} → ${peso(after)}`
        : `Details updated · custodian ${f.custodian || "—"}`);
  }, [logAudit, funds]);
  const deleteFund = useCallback((id) => {
    const prev = funds.find((x) => x.id === id);
    setFunds((fs) => fs.filter((x) => x.id !== id));
    logAudit("Fund Deleted", (prev && prev.label) || id,
      prev ? `${prev.branchCode} · beginning ${peso(Number(prev.beginningBalance) || 0)} removed` : "Fund removed");
  }, [logAudit, funds]);
  /* Bulk beginning-balance update from the Dashboard "Edit Balances" modal.
     One entry per fund that actually changed, carrying the before/after
     figures — saving the modal untouched records nothing. */
  const saveBalances = useCallback((updates) => {
    const map = new Map(updates.map((u) => [u.id, u.beginningBalance]));
    const changed = funds.filter((x) => map.has(x.id)
      && (Number(x.beginningBalance) || 0) !== (Number(map.get(x.id)) || 0));
    setFunds((fs) => fs.map((x) => (map.has(x.id) ? { ...x, beginningBalance: map.get(x.id) } : x)));
    changed.forEach((x) => logAudit("Beginning Balance Changed", x.label || x.branchCode,
      `${peso(Number(x.beginningBalance) || 0)} → ${peso(Number(map.get(x.id)) || 0)}`));
  }, [logAudit, funds]);

  /* Restore a recovery snapshot (admin, from System Settings). Transactions are
     replaced wholesale from the snapshot; funds/audit are only replaced when the
     snapshot actually carries them, so a partial snapshot never blanks them. */
  /* ---- PCF Documents ---- */
  const docTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
  const addDocuments = useCallback((docs) => {
    setDocuments((ds) => [...docs, ...ds]);
    docs.forEach((d) => logAudit("Document Uploaded", d.refNo, `${d.category} · ${d.name}`));
  }, [logAudit]);
  const updateDocument = useCallback((id, patch, action, remarks) => {
    const ts = docTs();
    setDocuments((ds) => ds.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d, ...patch, lastModified: ts };
      if (action) next.activity = [...(d.activity || []), { action, user: userName || role, ts, ip: "Local" }];
      return next;
    }));
    if (action) { const d = documents.find((x) => x.id === id); logAudit("Document " + action, (d && d.refNo) || id, remarks || (d ? d.name : "")); }
  }, [documents, logAudit, userName, role]);
  const replaceDocument = useCallback((id, file, by) => {
    const ts = docTs();
    setDocuments((ds) => ds.map((d) => {
      if (d.id !== id) return d;
      const version = (d.version || 1) + 1;
      const versions = [...(d.versions || []), { version, name: file.name, size: file.size, uploadedBy: by, date: todayISO() }];
      return {
        /* path points at the new bucket object. dataUrl and fileId are carried
           through so a replacement can explicitly clear the superseded
           pointers (both arrive as "") rather than leaving stale bytes to
           outrank the new path in useFileUrl. */
        ...d, name: file.name, size: file.size, type: file.type,
        path: file.path || "", fileId: file.fileId || "", dataUrl: file.dataUrl || "",
        version, versions, lastModified: ts,
        activity: [...(d.activity || []), { action: "Replaced", user: by || userName || role, ts, ip: "Local" }],
      };
    }));
    const d = documents.find((x) => x.id === id);
    logAudit("Document Replaced", (d && d.refNo) || id, file.name);
  }, [documents, logAudit, userName, role]);
  const deleteDocument = useCallback((id) => {
    const d = documents.find((x) => x.id === id);
    setDocuments((ds) => ds.filter((x) => x.id !== id));
    logAudit("Document Deleted", (d && d.refNo) || id, d ? d.name : "");
  }, [documents, logAudit]);
  const docActivity = useCallback((id, action, remarks) => {
    const ts = docTs();
    setDocuments((ds) => ds.map((d) => d.id === id
      ? { ...d, activity: [...(d.activity || []), { action, user: userName || role, ts, ip: "Local" }] }
      : d));
    const d = documents.find((x) => x.id === id);
    logAudit("Document " + action, (d && d.refNo) || id, remarks || (d ? d.name : ""));
  }, [documents, logAudit, userName, role]);

  /* ---- Reimbursement (AF P16) ----
     Independent of the Petty Cash Request flow: the employee already advanced
     the expense, so no Petty Cash Advance Form is created. After approval the
     request is handed off to Liquidation (status FOR LIQUIDATION), keeping the
     Reimbursement Request Number as the reference, then on to Payment. */
  const reimbTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
  const buildReimbFromForm = useCallback((form) => {
    /* A variance authorization is taken from the form only from an account on
       REIMB_VARIANCE_AUTH_EMAILS; anyone else keeps whatever the saved record
       already carries. */
    const saved = form.id ? reimbursements.find((x) => x.id === form.id) : null;
    const savedEx = (saved && saved.varianceException) || null;
    const varianceException = canAuthorizeReimbVariance ? (form.varianceException || null) : savedEx;
    const clean = { ...form, varianceException };
    const compliance = evaluateReimbursement(clean, reimbursements, form.id);
    return {
      employee: form.employee, department: form.department, branchCode: form.branchCode,
      company: companyOfBranch(form.branchCode), purpose: form.purpose,
      requestDate: form.requestDate, remarks: form.remarks || "",
      lines: (form.lines || []).map((l) => ({ ...l, amount: Number(l.amount) || 0, account: l.account || accountForCategory(l.category) })),
      attachments: (form.attachments || []).map((a) => ({ ...a, receiptAmount: receiptAmountOf(a) || "" })),
      needsPO: !!form.needsPO, needsProof: !!form.needsProof,
      hasPersonal: !!form.hasPersonal, entertainmentNotPreApproved: !!form.entertainmentNotPreApproved, hasFines: !!form.hasFines,
      varianceException,
      compliance,
    };
  }, [reimbursements, canAuthorizeReimbVariance]);

  /* Save-time checks for the Uploaded Files feature, shared by add and update.
     Returns an alert message when the save must be refused, else "". */
  const reimbDocsGate = (base, saved, submitting) => {
    if (!canDeleteReimbDocs) {
      /* Accounts outside REIMB_DOC_DELETE_EMAILS may not add documents or
         change a document's type, receipt no. or amount. */
      const key = (a) => [a.id, a.docType || "", a.receiptNo || "", receiptAmountOf(a)].join("|");
      const before = ((saved && saved.attachments) || []).map(key).sort().join("\n");
      const after = (base.attachments || []).map(key).sort().join("\n");
      if (before !== after) return "Your account cannot change the uploaded files on a reimbursement. Nothing was changed.";
    }
    if (submitting) {
      const b = reimbBalance(base);
      if (!b.ok) {
        return `NOT BALANCED — Total Expense Lines ${peso(b.lines)} vs Total Uploaded Documents ${peso(b.docs)}.\n`
          + `Difference: ${peso(Math.abs(b.diff))}\n\n`
          + "Correct the document amounts or expense lines so they match before submitting. Nothing was changed.";
      }
      const missing = (base.attachments || []).filter((a) => reimbDocNeedsAmount(a) && !(receiptAmountOf(a) > 0));
      if (missing.length) {
        return "Enter the amount for every uploaded document before submitting:\n"
          + missing.map((a) => `• ${a.name || "document"} (${a.docType || DEFAULT_DOC_TYPE})`).join("\n");
      }
    }
    return "";
  };
  /* History / audit note when a variance authorization is given or withdrawn. */
  const varianceNote = (base, saved) => {
    const now = base.varianceException, was = (saved && saved.varianceException) || null;
    if (now && (!was || was.at !== now.at || was.by !== now.by)) {
      return `Variance of ${peso(Math.abs(now.variance))} authorized by ${now.by}: ${now.reason}`;
    }
    if (!now && was) return "Variance authorization withdrawn";
    return "";
  };

  const addReimbursement = useCallback(async (form, submit) => {
    /* Backend enforcement (Section 7): a SUBMITTED reimbursement must carry one
       approved, ACTIVE purpose — never blank, free-text or injected. Drafts may
       still be saved with an incomplete purpose. */
    if (submit && !isActiveReimbPurpose((form.purpose || "").trim())) {
      window.alert((form.purpose || "").trim()
        ? "Invalid Purpose. Please select an approved expense category from the Purpose dropdown."
        : "Purpose is required. Please select an approved expense category.");
      return;
    }
    /* Uploaded Files permissions, document amounts and balancing — before a
       number is issued, so a refused save never consumes one. */
    const gate = reimbDocsGate(buildReimbFromForm(form), null, submit);
    if (gate) { window.alert(gate); return; }
    /* One series per plant (RMB-M-2026-0001), issued by the database on save
       (issueSeriesNo). It used to be a portal-wide COUNT, which re-issued an
       existing number after every delete. A draft is numbered when first
       saved, and keeps that number through submission and resubmission. */
    const id = uid("reimb");
    let reimbNo;
    try {
      reimbNo = await issueSeriesNo(reimbNoPrefix(form.branchCode), "reimbursements", id, reimbursements.map((r) => r.reimbNo));
    } catch (e) { seriesFailed(e, "Reimbursement"); return; }
    if (form.previewNo && form.previewNo !== reimbNo) {
      window.alert(`${form.previewNo} was taken by another reimbursement saved at the same time.\n\nYours was saved as ${reimbNo}.`);
    }
    const ts = reimbTs();
    const base = buildReimbFromForm(form);
    const status = submit ? REIMB_STATUS.SUBMITTED : REIMB_STATUS.DRAFT;
    const history = [{ ts, user: userName || role, action: submit ? "Submitted" : "Created (Draft)", prevStatus: "", newStatus: status, comments: varianceNote(base, null) }];
    setReimbursements((rs) => [...rs, {
      id, reimbNo, ...base, status,
      createdBy: userName || role, createdAt: ts,
      submittedBy: submit ? (userName || role) : "", submittedAt: submit ? ts : "",
      acumaticaStatus: "Not Yet Exported", payment: null, history,
    }]);
    logAudit(submit ? "Reimbursement Submitted" : "Reimbursement Drafted", reimbNo, `${form.employee} · ${peso(reimbTotal(base))}` + (varianceNote(base, null) ? ` · ${varianceNote(base, null)}` : ""));
  }, [buildReimbFromForm, logAudit, reimbursements, userName, role, canDeleteReimbDocs]); // eslint-disable-line

  /* A reimbursement edited onto another plant's branch moves to that plant's
     series under a freshly issued number; the old one is retired. */
  const moveReimbPlant = (r0, branchCode) => moveToPlantSeries(setReimbursements, "reimbNo", r0, branchCode, "RMB",
    "reimbursements", reimbursements.map((r) => r.reimbNo));

  const updateReimbursement = useCallback((id, form, mode) => {
    /* Same backend purpose check as addReimbursement, applied on resubmission
       and on a requestor's edit of an already-submitted reimbursement. */
    if ((mode === "submit" || mode === "pre-approval") && !isActiveReimbPurpose((form.purpose || "").trim())) {
      window.alert((form.purpose || "").trim()
        ? "Invalid Purpose. Please select an approved expense category from the Purpose dropdown."
        : "Purpose is required. Please select an approved expense category.");
      return;
    }
    const ts = reimbTs();
    const base = buildReimbFromForm({ ...form, id });
    /* Documents already saved on the record that this edit leaves out. Only
       REIMB_DOC_DELETE_EMAILS may remove one; each removal is named in the
       history and audit trail. */
    const saved = reimbursements.find((x) => x.id === id);
    const keptIds = new Set((base.attachments || []).map((a) => a.id));
    const removedDocs = ((saved && saved.attachments) || []).filter((a) => !keptIds.has(a.id));
    if (removedDocs.length && !canDeleteReimbDocs) {
      window.alert("Your account cannot delete attached documents. Nothing was changed.");
      return;
    }
    const gate = reimbDocsGate(base, saved, mode === "submit" || mode === "pre-approval");
    if (gate) { window.alert(gate); return; }
    const vNote = varianceNote(base, saved);
    const docNote = [removedDocs.length
      ? "Document(s) deleted: " + removedDocs.map((a) => `${a.name || "document"} (${a.docType || "—"})`).join(", ")
      : "", vNote].filter(Boolean).join(" · ");
    const withDocNote = (s) => (docNote ? `${s} · ${docNote}` : s);
    /* Checking / verification override (REIMB_EDIT_OVERRIDE_EMAILS): edit in
       place at any stage — status, approvals and submission stamps are kept;
       only the content changes. Plant scope still applies. */
    if (mode === "override") {
      const r0 = reimbursements.find((x) => x.id === id);
      if (!canEditReimbOverride || !r0 || !inScope(r0.branchCode)) return;
      setReimbursements((rs) => rs.map((r) => (r.id !== id ? r : {
        ...r, ...base, status: r.status, review: r.review,
        submittedBy: r.submittedBy, submittedAt: r.submittedAt,
        history: [...(r.history || []), { ts, user: userName || role, action: "Edited for checking / verification", prevStatus: r.status, newStatus: r.status, comments: docNote }],
      })));
      logAudit("Reimbursement Edited (checking / verification)", r0 ? r0.reimbNo : id,
        withDocNote(`${form.employee} · ${peso(reimbTotal(base))} · status kept: ${r0 ? r0.status : ""}`));
      moveReimbPlant(r0, base.branchCode);
      return;
    }
    /* PCF Requestor edit before custodian approval (REIMB_REQUESTOR_EDIT_EMAILS):
       details and attachments change, the status stays where it is. Refused
       outright once the custodian has approved — checked again against the
       latest record inside the state update, so an edit that was opened before
       the approval can never overwrite an approved reimbursement. */
    if (mode === "pre-approval") {
      const r0 = reimbursements.find((x) => x.id === id);
      if (!canEditReimbBeforeCustodian || !r0 || !inScope(r0.branchCode)) return;
      const locked = "This reimbursement has already been approved by the custodian, so it can no longer be edited."
        + " Nothing was changed.";
      if (!reimbAwaitingCustodian(r0)) { window.alert(locked); return; }
      setReimbursements((rs) => rs.map((r) => {
        if (r.id !== id || !reimbAwaitingCustodian(r)) return r;
        return {
          ...r, ...base, status: r.status, review: r.review,
          submittedBy: r.submittedBy, submittedAt: r.submittedAt,
          history: [...(r.history || []), { ts, user: userName || role, action: "Edited by requestor (before custodian approval)", prevStatus: r.status, newStatus: r.status, comments: docNote }],
        };
      }));
      logAudit("Reimbursement Edited (before custodian approval)", r0.reimbNo,
        withDocNote(`${form.employee} · ${peso(reimbTotal(base))} · ${(base.attachments || []).length} document(s) · status kept: ${r0.status}`));
      moveReimbPlant(r0, base.branchCode);
      return;
    }
    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const submit = mode === "submit";
      const status = submit ? REIMB_STATUS.SUBMITTED : (r.status === REIMB_STATUS.RETURNED ? REIMB_STATUS.DRAFT : r.status);
      const action = submit ? (r.status === REIMB_STATUS.RETURNED || r.status === REIMB_STATUS.FOR_SUBMISSION ? "Resubmitted" : "Submitted") : "Edited (Draft)";
      return {
        ...r, ...base, status,
        submittedBy: submit ? (userName || role) : r.submittedBy,
        submittedAt: submit ? ts : r.submittedAt,
        history: [...(r.history || []), { ts, user: userName || role, action, prevStatus: r.status, newStatus: status, comments: docNote }],
      };
    }));
    const r = reimbursements.find((x) => x.id === id);
    logAudit(mode === "submit" ? "Reimbursement Submitted" : "Reimbursement Edited", r ? r.reimbNo : id, withDocNote(`${form.employee} · ${peso(reimbTotal(base))}`));
    if (r) moveReimbPlant(r, base.branchCode);
  }, [buildReimbFromForm, logAudit, reimbursements, userName, role, canEditReimbOverride, canEditReimbBeforeCustodian, canDeleteReimbDocs, inScope]); // eslint-disable-line

  /* Workflow transition. The two approval levels mirror the liquidation's
     (see 11-liquidation.jsx): a custodian-level checker (isLiquidationChecker)
     approves first, then Grace Gan or the System Superuser (isFinalApprover)
     gives the final approval that makes it ready for replenishment. Every
     gate is re-checked here so a bypassed UI still fails. */
  const reimbursementAction = useCallback((id, action, payload) => {
    const o = payload || {};
    const comments = (o.comments || "").trim();
    const ts = reimbTs();
    const actor = userName || role;
    const r0 = reimbursements.find((x) => x.id === id);
    if (!r0 || !inScope(r0.branchCode)) return;
    const prev = r0.status;
    const atCheck = REIMB_CUSTODIAN_REVIEW_STATUSES.includes(prev);
    const atFinal = prev === REIMB_STATUS.FOR_FINAL;
    const isOwn = [r0.createdBy, r0.employee].some((n) => (n || "").trim().toLowerCase() === actor.toLowerCase());
    const rv = reimbReview(r0);

    let next = prev, label = action;
    switch (action) {
      case "custodian-approve":
        if (!isLiquidationChecker || !atCheck) {
          window.alert("Only a custodian can approve a reimbursement that is awaiting custodian review.");
          return;
        }
        if (isOwn) { window.alert("Segregation of duties: you cannot approve your own reimbursement request."); return; }
        if (missingFinanceChecker()) return;
        next = REIMB_STATUS.FOR_FINAL; label = "Custodian Approved → For Final Approval";
        break;
      case "final-approve":
        if (!isFinalApprover || !atFinal) {
          window.alert(`Only ${FINAL_APPROVER_NAME} can give final approval, and only to a custodian-approved reimbursement.`);
          return;
        }
        if (isOwn) { window.alert("Segregation of duties: you cannot approve your own reimbursement request."); return; }
        if (!passesAccountingGate(rv)) { window.alert(ACCOUNTING_GATE_MESSAGE); return; }
        if (rv.checkedBy.toLowerCase() === actor.toLowerCase()) {
          window.alert("You approved this reimbursement as custodian — the final approval must come from someone else.");
          return;
        }
        next = REIMB_STATUS.READY; label = "Final Approved → Ready for Replenishment";
        break;
      case "revert":
        /* REVERT_EMAILS: back to the requestor as FOR SUBMISSION, from custodian
           review or from For Final Approval (before the final approval). */
        if (!canRevert || !(atCheck || atFinal)) {
          window.alert("Only a custodian can revert a reimbursement, and only while it is submitted and not yet final-approved.");
          return;
        }
        if (!comments) { window.alert("Enter the reason for the revert in Comments first — the requestor sees it."); return; }
        next = REIMB_STATUS.FOR_SUBMISSION; label = "Reverted to Requestor → For Submission";
        break;
      case "return":
      case "reject":
        /* The custodian while it is under review, or the final approver at
           final approval — the same rule as rejecting a liquidation. */
        /* Accounting may also send back what it is reviewing. */
        if (!((isLiquidationChecker && atCheck) || (isFinalApprover && atFinal && passesAccountingGate(rv))
          || (isAccountingChecker && atFinal && !rv.acctChecked))) {
          window.alert(`Only the custodian (while it is under review), Accounting (while it checks it) or ${FINAL_APPROVER_NAME} (at final approval) can ${action} this reimbursement.`);
          return;
        }
        if (!comments) { window.alert("Enter the reason in Comments first."); return; }
        next = action === "return" ? REIMB_STATUS.RETURNED : REIMB_STATUS.REJECTED;
        label = action === "return" ? "Returned for Revision" : "Rejected";
        break;
      /* Legacy single-level chain — only for records approved before the
         two-level workflow, which still finish in the Liquidation module. */
      case "liquidation-review": next = REIMB_STATUS.UNDER_REVIEW; label = "Liquidation Under Review"; break;
      case "liquidation-complete": next = REIMB_STATUS.LIQUIDATION_DONE; label = "Liquidation Completed"; break;
      case "for-payment": next = REIMB_STATUS.FOR_PAYMENT; label = "Moved to Payment"; break;
      case "complete": next = REIMB_STATUS.COMPLETED; label = "Completed"; break;
      default: return;
    }
    if (next === prev) return;
    /* The Finance Checker goes on the approval and in the history / audit. */
    const fc = action === "custodian-approve" ? activeFinanceChecker : "";
    const logged = fc ? [`Finance Checker: ${fc}`, comments].filter(Boolean).join(" · ") : comments;

    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id || r.status !== prev) return r;
      const patch = { status: next, history: [...(r.history || []), { ts, user: actor, action: label, prevStatus: prev, newStatus: next, comments: logged, ...(fc ? { financeChecker: fc } : {}) }] };
      const cur = r.review || {};
      if (action === "custodian-approve") {
        patch.review = { history: cur.history || [], checkedBy: actor, financeChecker: fc, checkedAt: ts, checkRemarks: comments };
      } else if (action === "final-approve") {
        patch.review = { ...cur, finalBy: actor, finalAt: ts, finalRemarks: comments };
        patch.approvedBy = actor; patch.approvedAt = ts;
      } else if (action === "return" || action === "reject" || action === "revert") {
        /* Stamps are never silently lost: a cleared custodian approval moves
           into review.history, like clearReview does for a liquidation. */
        patch.review = {
          history: (cur.history || []).concat(cur.checkedBy ? [{
            action: label, user: actor, ts, checkedBy: cur.checkedBy, financeChecker: cur.financeChecker || "", checkedAt: cur.checkedAt || "",
            acctCheckedBy: cur.acctCheckedBy || "", acctChecker: cur.acctChecker || "", acctCheckedAt: cur.acctCheckedAt || "", batchNo: cur.batchNo || "",
          }] : []),
        };
      }
      return { ...r, ...patch };
    }));
    logAudit("Reimbursement " + label, r0.reimbNo, logged);
  }, [logAudit, reimbursements, userName, role, inScope, isLiquidationChecker, isFinalApprover, isAccountingChecker, canRevert, activeFinanceChecker]); // eslint-disable-line

  const recordReimbursementPayment = useCallback((id, payment) => {
    const ts = reimbTs();
    const actor = userName || role;
    setReimbursements((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      /* A fully approved reimbursement keeps its status when the employee is
         paid — it must stay ready until a replenishment claims it. */
      const status = r.status === REIMB_STATUS.READY ? REIMB_STATUS.READY : REIMB_STATUS.PAID;
      return {
        ...r, status, payment: { ...payment },
        history: [...(r.history || []), { ts, user: actor, action: "Payment Recorded", prevStatus: r.status, newStatus: status, comments: `${payment.method} · ${peso(payment.amount)}${payment.refNo ? ` · ${payment.refNo}` : ""}` }],
      };
    }));
    const r = reimbursements.find((x) => x.id === id);
    logAudit("Reimbursement Paid", r ? r.reimbNo : id, `${payment.method} · ${peso(payment.amount)}${payment.refNo ? ` · ${payment.refNo}` : ""}`);
  }, [logAudit, reimbursements, userName, role]);

  const deleteReimbursement = useCallback((id) => {
    const r = reimbursements.find((x) => x.id === id);
    if (!r || !canDeleteTxn) return;
    const claim = claimedBy("reimbursementIds", id);
    if (claim) {
      window.alert(`${r.reimbNo} cannot be deleted — it is part of replenishment ${claim.replenishmentNo}.\n\n`
        + "Remove it from that replenishment (or delete the replenishment) first.");
      return;
    }
    const reason = confirmTxnDelete(r.reimbNo,
      [`${plantNameOf(r.branchCode)} · ${r.employee} · ${peso(reimbTotal(r))} · ${r.status}`]);
    if (reason == null) return;
    stampDeleted(id, r.reimbNo, r.branchCode, reason);
    setReimbursements((rs) => rs.filter((x) => x.id !== id));
    logAudit("Deleted", r.reimbNo, `Reimbursement deleted · Plant: ${plantNameOf(r.branchCode)} · ${r.employee} · ${peso(reimbTotal(r))} · Reason: ${reason} · number retired`);
  }, [logAudit, reimbursements, replenishments, canDeleteTxn, userName, userEmail, role]); // eslint-disable-line

  const exportReimbursementAcumatica = useCallback((reimb) => {
    const rows = (reimb.lines || []).map((l) => ({
      "Branch": reimb.branchCode, "Employee": reimb.employee, "Company": companyOfBranch(reimb.branchCode),
      "Reference No.": reimb.reimbNo, "Expense Date": l.date, "GL Account": l.account || accountForCategory(l.category),
      "Subaccount": l.department, "Cost Center": l.costCenter || "", "Description": l.description,
      "Category": l.category, "Vendor/Payee": l.vendor || "", "Tax Category": l.taxCategory || "", "Amount": Number(l.amount) || 0,
    }));
    const meta = [
      ["Reimbursement — Acumatica Import Sheet"],
      ["Reimbursement No.", reimb.reimbNo], ["Employee", reimb.employee],
      ["Purpose", reimb.purpose || ""], ["Purpose Category", purposeCategory(reimb.purpose)],
      ["Company", companyOfBranch(reimb.branchCode)], ["Total", reimbTotal(reimb)], [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursement");
    downloadWorkbook(wb, `Reimbursement_${reimb.reimbNo}.xlsx`);
    setReimbursements((rs) => rs.map((r) => (r.id === reimb.id ? { ...r, acumaticaStatus: "Exported" } : r)));
    logAudit("Reimbursement Exported", reimb.reimbNo, "Acumatica export sheet generated");
  }, [logAudit]);

  const exportReimbursementReport = useCallback((list) => {
    const rows = (list || []).map((r) => ({
      "Reimb No.": r.reimbNo, "Employee": r.employee, "Department": deptDesc(r.department),
      "Company": companyOfBranch(r.branchCode), "Plant": plantLabel(r.branchCode),
      "Category": purposeCategory(r.purpose), "Purpose": r.purpose || "",
      "Request Date": r.requestDate, "Lines": (r.lines || []).length, "Total Amount": reimbTotal(r),
      "Compliance": (r.compliance && r.compliance.level) || "PASS", "Status": r.status,
      "Approved By": r.approvedBy || "", "Payment Date": (r.payment && r.payment.date) || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursements");
    downloadWorkbook(wb, `Reimbursement_Summary_${todayISO()}.xlsx`);
  }, []);

  /* ---- Plant-scoped views ---- */
  /* Every module only receives data for plants the user is allowed to see, so a
     custodian can never view or edit another plant's records. */
  const visibleFunds = useMemo(() => funds.filter((f) => inScope(f.branchCode)), [funds, inScope]);
  const visibleRequests = useMemo(() => requests.filter((r) => inScope(r.branchCode)), [requests, inScope]);
  const visibleDisbursements = useMemo(() => disbursements.filter((d) => inScope(d.branchCode)), [disbursements, inScope]);
  const visibleReplenishments = useMemo(() => replenishments.filter((r) => inScope(r.branchCode)), [replenishments, inScope]);
  const visibleReimbursements = useMemo(() => reimbursements.filter((r) => inScope(r.branchCode)), [reimbursements, inScope]);
  const visibleLiquidations = useMemo(() => {
    const ids = new Set(visibleDisbursements.map((d) => d.id));
    return liquidations.filter((l) => ids.has(l.disbursementId));
  }, [liquidations, visibleDisbursements]);
  /* Accounts with excluded plants (excludePlants) also must not see those
     plants in the shared, otherwise plant-wide screens: Funds & Master Data,
     PCF Documents and the Audit Trail. Applied ONLY to such accounts, so
     everyone else's view of those screens is unchanged. Display filters only —
     the full lists are still what every save writes to. */
  const plantRestricted = (userExcludePlants || []).length > 0;
  const docsForUser = useMemo(
    () => (plantRestricted ? documents.filter((d) => !d.plant || inScope(d.plant)) : documents),
    [plantRestricted, documents, inScope]
  );
  const auditForUser = useMemo(() => {
    if (!plantRestricted) return auditLog;
    /* Hide entries about a record of an excluded plant (matched by number). */
    const hidden = new Set();
    const note = (list, key) => list.forEach((r) => { if (r && !inScope(r.branchCode) && r[key]) hidden.add(String(r[key]).trim().toUpperCase()); });
    note(requests, "requestNo"); note(disbursements, "voucherNo"); note(reimbursements, "reimbNo"); note(replenishments, "replenishmentNo");
    funds.forEach((f) => { if (!inScope(f.branchCode)) { if (f.label) hidden.add(String(f.label).trim().toUpperCase()); hidden.add(String(f.branchCode).trim().toUpperCase()); } });
    documents.forEach((d) => { if (d.plant && !inScope(d.plant) && d.refNo) hidden.add(String(d.refNo).trim().toUpperCase()); });
    return auditLog.filter((a) => !hidden.has(String(a.entity || "").trim().toUpperCase()));
  }, [plantRestricted, auditLog, requests, disbursements, reimbursements, replenishments, funds, documents, inScope]);
  /* Dashboard plant tabs limited to the user's plants. */

  /* ---- Separate tab per plant ---- */
  /* The active tab is either a global module key ("audit") or a plant-scoped
     key ("A1+::requests"). Parse it so each module renders only its own plant. */
  const { plant: activePlant, module: activeModule } = parseTab(tab);
  /* A plant tab scopes to that plant's WHOLE family (intersected with what the
     user is allowed), not to the single plant code — otherwise the Disney tab
     showed only the records filed against D1 and silently dropped D2..D9. */
  const scopeCodes = useMemo(() => {
    if (!activePlant) return allowedPlants;
    const family = branchesOfPlant(activePlant).filter((c) => allowedPlants.includes(c));
    return family.length ? family : allowedPlants;
  }, [activePlant, allowedPlants]);
  const scopedFunds = useMemo(() => visibleFunds.filter((f) => scopeCodes.includes(f.branchCode)), [visibleFunds, scopeCodes]);
  const scopedRequests = useMemo(() => visibleRequests.filter((r) => scopeCodes.includes(r.branchCode)), [visibleRequests, scopeCodes]);
  const scopedDisbursements = useMemo(() => visibleDisbursements.filter((d) => scopeCodes.includes(d.branchCode)), [visibleDisbursements, scopeCodes]);
  const scopedReplenishments = useMemo(() => visibleReplenishments.filter((r) => scopeCodes.includes(r.branchCode)), [visibleReplenishments, scopeCodes]);
  const scopedReimbursements = useMemo(() => visibleReimbursements.filter((r) => scopeCodes.includes(r.branchCode)), [visibleReimbursements, scopeCodes]);
  const scopedLiquidations = useMemo(() => {
    const ids = new Set(scopedDisbursements.map((d) => d.id));
    return visibleLiquidations.filter((l) => ids.has(l.disbursementId));
  }, [visibleLiquidations, scopedDisbursements]);
  /* Plant selector options limited to the active tab's plant so module forms
     default to the correct plant and the redundant in-page selector hides.

     The plant's own fund-holding branch is tagged isPlantRoot. It stays in the
     list — records can still be filed against it and the module forms still
     offer it — but the in-page branch tab row drops it, because the page header
     already names the plant and the tab simply repeated it ("Manila" sitting
     under Manila, "Disney" under Disney). See PlantScopeTabs. */
  const scopedPlantOptions = useMemo(
    () => branchOptions
      .filter((p) => scopeCodes.includes(p.code))
      .map((p) => (activePlant && p.code === activePlant ? { ...p, isPlantRoot: true } : p)),
    [branchOptions, scopeCodes, activePlant]
  );
  const activePlantLabel = activePlant ? plantLabel(activePlant) : "";
  /* Resolve the per-plant dashboard header from the canonical list, falling back
     to the funds master data so newly created plants get a working dashboard. */
  const activeBranch = useMemo(() => {
    if (!activePlant) return null;
    const db = DASHBOARD_BRANCHES.find((b) => b.branchCode === activePlant);
    if (db) return db;
    const f = funds.find((x) => x.branchCode === activePlant);
    return f ? { key: activePlant, label: f.label || plantLabel(activePlant) || activePlant, branchCode: activePlant } : null;
  }, [activePlant, funds]);

  /* ---- Roles, navigation & notifications ---- */
  const roleModuleKeys = restrictedModules || (ROLES[role] || ROLES["Accounting"]).tabs;
  /* Changing a beginning balance restates a plant's whole cash position, so the
     dashboard's "Edit Beginning Balances" button is held to the SAME gate as the
     Master Data tab (SuperAdmin / Accounting / Finance). Derived from the tab
     list rather than a second hard-coded role list so the two cannot drift:
     a Custodian is deliberately kept out of Master Data, yet could previously
     change balances straight from the dashboard, which had no role check. */
  const canEditFunds = roleModuleKeys.includes("masterdata");
  /* User's plants in canonical order, then any additional master-data plants so
     newly created plants automatically get their own sidebar group + dashboard. */
  const orderedPlants = useMemo(() => plantOptions, [plantOptions]);

  /* Build the grouped sidebar: an optional consolidated overview, one group per
     plant with that plant's modules, then the shared administration tabs. */
  const navGroups = useMemo(() => {
    /* Home (landing page) — every role. Read-only summary + links, see 24-home.jsx. */
    const groups = restrictedModules && !restrictedModules.includes("home")
      ? [] : [{ key: "home", label: "", items: [{ tabKey: "home", label: "Home", icon: House }] }];
    const plantMods = PLANT_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (orderedPlants.length > 1 && roleModuleKeys.includes("dashboard")) {
      groups.push({ key: "overview", label: "Overview", items: [
        { tabKey: "dashboard", label: "Consolidated Dashboard", icon: LayoutDashboard },
      ] });
    }
    orderedPlants.forEach((p) => {
      groups.push({
        key: "plant-" + p.code,
        label: p.label,
        items: plantMods.map((m) => ({ tabKey: plantTabKey(p.code, m.key), label: m.label, icon: m.icon })),
      });
    });
    /* Approvals sit directly under the plants: it is the first place an approver
       looks, and it already spans every plant, so it is not repeated per plant. */
    const apprMods = APPROVAL_MODULES.filter((m) => (m.key === "approved"
      ? canUseApprovedModule && (!restrictedModules || restrictedModules.includes("approved"))
      : canUseApprovalModule && roleModuleKeys.includes(m.key)));
    if (apprMods.length) {
      groups.push({ key: "approvals", label: "Approvals", items: apprMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    const monMods = MONITORING_MODULES.filter((m) => roleModuleKeys.includes(m.key));
    if (monMods.length) {
      groups.push({ key: "monitoring", label: "Monitoring", items: monMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    const globalMods = GLOBAL_MODULES.filter((m) => roleModuleKeys.includes(m.key)
      || (m.key === "documents" && canAccessPcfDocuments && !restrictedModules));
    if (globalMods.length) {
      groups.push({ key: "admin", label: "Administration", items: globalMods.map((m) => ({ tabKey: m.key, label: m.label, icon: m.icon })) });
    }
    return groups;
  }, [roleModuleKeys, orderedPlants, canUseApprovalModule, canUseApprovedModule, restrictedModules, canAccessPcfDocuments]);

  /* Flat set of every valid tab key for this user — used to block navigation to
     unauthorized pages, including manual URL/state tampering. */
  const allowedTabs = useMemo(() => {
    const set = new Set();
    navGroups.forEach((g) => g.items.forEach((it) => set.add(it.tabKey)));
    return set;
  }, [navGroups]);
  /* A restricted account without Home lands on its Approval Module. */
  const firstTab = restrictedModules && !allowedTabs.has("home") && allowedTabs.has("approvals") ? "approvals"
    : (navGroups[0] && navGroups[0].items[0]) ? navGroups[0].items[0].tabKey : "dashboard";

  /* Keep the active tab valid whenever role/plants change. */
  useEffect(() => {
    if (loaded && !allowedTabs.has(tab)) setTab(firstTab);
  }, [role, loaded, allowedTabs]); // eslint-disable-line

  const navigate = useCallback((key, opts) => {
    /* Accept a bare module key from dashboard drill-downs and scope it to the
       plant currently in context (or the first allowed plant). */
    let target = key;
    if (!String(key).includes(TAB_SEP) && PLANT_MODULE_KEYS.includes(key)) {
      const cur = parseTab(tab).plant || (orderedPlants[0] && orderedPlants[0].code);
      if (cur) target = plantTabKey(cur, key);
    }
    if (!allowedTabs.has(target)) return;
    if (parseTab(target).module === "history") setHistoryFilter(opts && opts.type ? { type: opts.type } : null);
    setTab(target);
  }, [allowedTabs, tab, orderedPlants]);

  const notifications = useMemo(
    () => buildNotifications(visibleRequests, visibleDisbursements, visibleLiquidations, visibleReplenishments),
    [visibleRequests, visibleDisbursements, visibleLiquidations, visibleReplenishments]
  );

  const onNotifClick = useCallback((n) => {
    if (n.type === "approval" || n.type === "approved" || n.type === "rejected") navigate("requests");
    else if (n.type === "liquidation" || n.type === "overdue") navigate("liquidation");
    else if (n.type === "replenished" || n.type === "replenish-pending") navigate("replenishment");
  }, [navigate]);

  /* ---- Requestor liquidation reminders (large bell in every TopBar) ----
     PCF Requestor accounts only, from their own plants' vouchers (visible*
     is already plant-scoped). Recomputed on every change and at each new day.
     Their general bell then drops its own liquidation-pending notices, so the
     same voucher is never announced twice. */
  /* The date, re-checked every minute so reminders and alarms move on to the
     next day (due tomorrow -> due today -> overdue) with no page refresh. */
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const t = setInterval(() => setToday((d) => { const n = todayISO(); return n === d ? d : n; }), 60000);
    return () => clearInterval(t);
  }, []);
  /* Live liquidation alarms (25-liq-alarms.jsx) for LIQ_ALARM_EMAILS, over the
     plants each account can already see — a custodian gets their own plants'
     employees. Hidden while previewing another role. */
  const alarmsOn = LIQ_ALARM_EMAILS.includes((userEmail || "").trim().toLowerCase()) && role === (userRole || "Accounting");
  const showReminders = role === "Requestor" && !alarmsOn;
  const liveReminders = useMemo(
    () => ((showReminders || alarmsOn) ? liquidationReminders(visibleDisbursements, visibleLiquidations, today, visibleFunds) : null),
    [showReminders, alarmsOn, visibleDisbursements, visibleLiquidations, today, visibleFunds]
  );
  const reminders = showReminders ? liveReminders : null;
  const liqAlarms = useLiqAlarms(alarmsOn ? liveReminders : null, userEmail, alarmsOn);
  const bellNotifications = useMemo(
    () => ((showReminders || alarmsOn) ? notifications.filter((n) => !/^n-(over|due|rem|liq)-/.test(n.id)) : notifications),
    [showReminders, alarmsOn, notifications]
  );
  /* A clicked reminder opens that voucher's liquidation worksheet, on the tab
     of the plant it belongs to. */
  const [liqOpenRequest, setLiqOpenRequest] = useState(null);
  const onReminderClick = useCallback((r) => {
    const p = orderedPlants.find((x) => branchesOfPlant(x.code).includes(r.branchCode) || x.code === r.branchCode);
    const target = p ? plantTabKey(p.code, "liquidation") : "liquidation";
    setLiqOpenRequest({ id: r.id, at: Date.now() });
    navigate(target);
  }, [orderedPlants, navigate]);

  /* ---- Home (landing page) data — derived only, nothing is written ---- */
  const tabFor = (key) => (PLANT_MODULE_KEYS.includes(key) && orderedPlants[0] ? plantTabKey(orderedPlants[0].code, key) : key);
  const canOpen = (key) => allowedTabs.has(tabFor(key));
  const homeDeadlines = useMemo(
    () => liquidationReminders(visibleDisbursements, visibleLiquidations, today),
    [visibleDisbursements, visibleLiquidations, today]
  );
  const homeQuickLinks = [
    { key: "requests", label: "Petty Cash Request", desc: "Request a cash advance and track its approval", icon: ClipboardList, tint: "#4e7d63" },
    { key: "reimbursement", label: "Reimbursement", desc: "Claim back expenses you paid yourself", icon: ArrowLeftRight, tint: "#3f9c8f" },
    { key: "liquidation", label: "Liquidation", desc: "Liquidate released cash with receipts", icon: FileSpreadsheet, tint: "#a86b06" },
    { key: "disbursements", label: "Release Ledger", desc: "Vouchers released from the fund", icon: Receipt, tint: "#2f64a6" },
    { key: "replenishment", label: "Replenishment", desc: "Restore the fund for approved expenses", icon: RefreshCw, tint: "#6a4fb8" },
    { key: "approvals", label: "Approval", desc: "Everything awaiting your decision", icon: ClipboardCheck, tint: "#237a45" },
    { key: "approved", label: "Approved", desc: "Transactions with Grace Gan's final approval", icon: CircleCheck, tint: "#15803d" },
  ].filter((q) => canOpen(q.key)).map((q) => ({ ...q, onClick: () => navigate(q.key) }));
  /* Summary cards. Each appears only when the account can open the module it
     summarises; the fund balance only for roles with the dashboard. */
  const sumAmt = (xs, f) => xs.reduce((s, x) => s + (Number(f ? f(x) : x.amount) || 0), 0);
  const homeStats = [];
  if (canOpen("dashboard")) {
    const bal = sumAmt(visibleFunds, (f) => monitoringForFund(f, visibleDisbursements, visibleLiquidations, visibleReplenishments).available);
    homeStats.push({ label: "💰 Petty Cash Balance", value: peso(bal), icon: Wallet, tint: bal < 0 ? "#c0392b" : "#4e7d63",
      foot: `${visibleFunds.length} fund(s) available`, onClick: () => navigate("dashboard") });
  }
  if (canOpen("requests")) {
    const active = visibleRequests.filter((r) => r.status === "Pending" || r.status === "Approved");
    const pend = active.filter((r) => r.status === "Pending").length;
    homeStats.push({ label: "📋 Active Requests", value: active.length, icon: ClipboardList, tint: "#2f64a6",
      foot: `${pend} pending · ${active.length - pend} awaiting release · ${peso(sumAmt(active))}`, onClick: () => navigate("requests") });
  }
  if (canOpen("liquidation")) {
    const overdue = homeDeadlines.filter((d) => d.daysLeft < 0);
    homeStats.push({ label: "⏳ For Liquidation", value: homeDeadlines.length, icon: FileSpreadsheet, tint: "#c2560c",
      foot: peso(sumAmt(homeDeadlines)), onClick: () => navigate("liquidation") });
    homeStats.push({ label: "⚠️ Overdue Liquidations", value: overdue.length, icon: AlertTriangle, tint: overdue.length ? "#c0392b" : "#237a45",
      foot: overdue.length ? `${peso(sumAmt(overdue))} · for Authority to Deduct` : "None overdue",
      onClick: () => navigate(canOpen("aging") ? "aging" : "liquidation") });
  }
  if (canOpen("replenishment")) {
    const ready = replenishmentReadyItems(visibleDisbursements, visibleLiquidations, visibleReimbursements, visibleReplenishments);
    homeStats.push({ label: "🔄 For Replenishment", value: ready.length, icon: RefreshCw, tint: "#6a4fb8",
      foot: peso(sumAmt(ready)), onClick: () => navigate("replenishment") });
  }
  if (canOpen("reimbursement")) {
    const closed = [REIMB_STATUS.DRAFT, REIMB_STATUS.COMPLETED, REIMB_STATUS.PAID, REIMB_STATUS.REJECTED];
    const open = visibleReimbursements.filter((r) => !closed.includes(r.status));
    homeStats.push({ label: "💵 Reimbursements", value: open.length, icon: Banknote, tint: "#3f9c8f",
      foot: `${peso(sumAmt(open, (r) => reimbTotal(r)))} in progress`, onClick: () => navigate("reimbursement") });
  }

  /* Grace Gan's Home (owner's instruction, Oct 2026): no liquidation
     deadlines or general notifications — only what awaits HER final approval,
     the same rule as her Approval Module queue (custodian approved, Accounting
     checked with a Batch Number, not approved as custodian by herself).
     null for everyone else, whose Home is unchanged. */
  const homeApprovalReminders = useMemo(() => {
    if (!restrictedModules || !isFinalApprover) return null;
    const me = String(userName || role).trim().toLowerCase();
    const notMine = (rv) => String(rv.checkedBy || "").trim().toLowerCase() !== me;
    const liqs = pcaApprovalQueue(visibleDisbursements, visibleLiquidations, visibleReplenishments)
      .filter((x) => x.stage === LIQ_STAGE.FOR_FINAL && passesAccountingGate(x.review) && notMine(x.review))
      .map((x) => ({
        id: "liq:" + x.disb.id, seriesNo: x.disb.voucherNo, employee: x.disb.employee, kind: "Liquidation",
        branchCode: x.disb.branchCode, amount: x.amounts.approvedTotal, batchNo: x.review.batchNo,
        date: String(x.review.acctCheckedAt || x.liq.submittedAt || x.disb.date || "").slice(0, 10),
      }));
    const reimbs = visibleReimbursements
      .filter((r) => r.status === REIMB_STATUS.FOR_FINAL && !reimbAwaitingAccounting(r)
        && passesAccountingGate(reimbReview(r)) && notMine(reimbReview(r))
        && ![r.createdBy, r.employee].some((n) => String(n || "").trim().toLowerCase() === me))
      .map((r) => {
        const rv = reimbReview(r);
        return {
          id: "reimb:" + r.id, seriesNo: r.reimbNo, employee: r.employee, kind: "Reimbursement",
          branchCode: r.branchCode, amount: reimbTotal(r), batchNo: rv.batchNo,
          date: String(rv.acctCheckedAt || r.submittedAt || r.requestDate || "").slice(0, 10),
        };
      });
    return liqs.concat(reimbs).sort((a, b) => String(a.batchNo).localeCompare(String(b.batchNo)) || String(a.date).localeCompare(String(b.date)));
  }, [restrictedModules, isFinalApprover, userName, role, visibleDisbursements, visibleLiquidations, visibleReplenishments, visibleReimbursements]);

  /* An alarm opens its record in Liquidation Aging (or, without access to
     it, the liquidation itself). */
  const [agingFocus, setAgingFocus] = useState(null);
  const onAlarmOpen = useCallback((r) => {
    if (allowedTabs.has("aging")) { setAgingFocus({ id: r.id, at: Date.now() }); navigate("aging"); }
    else onReminderClick(r);
  }, [allowedTabs, navigate, onReminderClick]);

  /* SAVE FILE after a rotation (DOC_ROTATE_SAVE_EMAILS). `patch` points the
     document at the newly uploaded, rotated file; the original stays in the
     bucket and its path is kept on the document (originalPath) and in its
     rotationHistory. When the document is already saved on a liquidation
     (kind "liquidation", recordId = disbursement id) or a reimbursement
     (recordId = reimbursement id), the record is updated at once — no other
     field of the record changes. With no recordId (a file added since the last
     save) the stamped patch is only returned, for the form to keep until it is
     saved. Returns the stamped patch, or null when refused. */
  const saveDocRotation = useCallback((kind, recordId, att, patch, turnedBy) => {
    if (!canSaveDocRotation) {
      window.alert("Your account cannot save a rotated file. Nothing was changed.");
      return null;
    }
    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    const who = userName || role;
    const full = {
      ...patch,
      originalPath: att.originalPath || att.path || "",
      rotatedAt: ts, rotatedBy: who,
      rotationHistory: [...(att.rotationHistory || []), { ts, by: who, degrees: turnedBy, fromPath: att.path || "", toPath: patch.path }],
    };
    if (!recordId) return full;
    const stamp = (a) => (a.id !== att.id ? a : { ...a, ...full });
    let ref = recordId;
    if (kind === "liquidation") {
      setLiquidations((ls) => ls.map((l) => (l.disbursementId !== recordId ? l : { ...l, attachments: (l.attachments || []).map(stamp) })));
      const d = disbursements.find((x) => x.id === recordId);
      if (d) ref = d.voucherNo;
    } else {
      setReimbursements((rs) => rs.map((r) => (r.id !== recordId ? r : { ...r, attachments: (r.attachments || []).map(stamp) })));
      const r = reimbursements.find((x) => x.id === recordId);
      if (r) ref = r.reimbNo;
    }
    logAudit("Document Rotation Saved", ref, `${att.name || "document"} · rotated ${turnedBy}° clockwise · original file kept`);
    return full;
  }, [canSaveDocRotation, userName, role, disbursements, reimbursements, logAudit]);

  const uiValue = useMemo(
    () => ({ notifications: bellNotifications, reminders, onReminderClick, role, setRole: guardedSetRole, canSwitchRole, onNotifClick, liqAlarms, onAlarmOpen, canSaveDocRotation, saveDocRotation }),
    [bellNotifications, reminders, onReminderClick, role, guardedSetRole, canSwitchRole, onNotifClick, liqAlarms, onAlarmOpen, canSaveDocRotation, saveDocRotation]
  );

  if (!loaded) {
    return (
      <div className="pcp-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ color: "var(--text-mut)", fontSize: 13 }}>Loading petty cash portal…</div>
      </div>
    );
  }

  return (
    <AppUI.Provider value={uiValue}>
    <div className="pcp-root">
      <style>{CSS}</style>
      <ToastHost />
      <Sidebar tab={tab} setTab={setTab} role={role} roleLabel={accountRoleLabel(role, userEmail, userRole || "Accounting")} navGroups={navGroups} userEmail={userEmail} userName={userName} financeCheckerNames={financeCheckerNames} financeChecker={activeFinanceChecker} onFinanceChecker={setFinanceChecker} onSignOut={handleSignOut} onChangePassword={() => setShowChangePw(true)} onManageMfa={hasMfa ? () => setShowMfaDevices(true) : undefined} />
      <div className="pcp-main">
        {/* Shown to EVERYONE, not just admins: this one says the screen below
            is incomplete, and a custodian looking at a short list needs that
            more than an administrator does. */}
        {loadFailed && (
          <div style={{ background: "#8a1020", color: "#fff", padding: "8px 16px", fontSize: 12.5, lineHeight: 1.5 }}>
            <b>Could not load all records.</b> The connection to the database failed part-way, so this
            screen is INCOMPLETE — records are missing from it, not from the database. Please reload the
            page. If it keeps happening, tell your administrator before creating any new record, because
            new reference numbers are generated from the records this page can see.
          </div>
        )}
        {receiptsFailed && !loadFailed && (
          <div style={{ background: "#7a4a00", color: "#fff", padding: "8px 16px", fontSize: 12.5, lineHeight: 1.5 }}>
            <b>Receipt images did not finish loading.</b> Every transaction below is complete and correct —
            only the scanned attachments are missing. Reload the page to try fetching them again.
          </div>
        )}
        {blockedSaves > 0 && (
          <div style={{ background: "#8a1020", color: "#fff", padding: "8px 16px", fontSize: 12.5, lineHeight: 1.5 }}>
            <b>Your session has expired — {blockedSaves} change{blockedSaves === 1 ? " has" : "s have"} NOT been saved.</b> Sign
            out and sign in again to save {blockedSaves === 1 ? "it" : "them"}. Do not close this tab until you have.
          </div>
        )}
        {recordsUnavailable && isAdmin && (
          <div style={{ background: "#8a1020", color: "#fff", padding: "8px 16px", fontSize: 12.5, lineHeight: 1.5 }}>
            <b>Database setup incomplete:</b> the concurrency-safe <code>pcp_records</code> table is missing,
            so saves fall back to a shared blob. A safety net is preventing data loss, but please run the
            setup SQL (see README → Data Storage &amp; Login) in Supabase to fully restore multi-user safety.
            No existing data will be affected.
          </div>
        )}
        {activeModule === "home" && allowedTabs.has("home") && (
          <>
            <TopBar title="Home" sub="Your petty cash overview and shortcuts" />
            <div className="pcp-content">
              <HomePage
                userName={userName} userEmail={userEmail}
                roleLabel={accountRoleLabel(role, userEmail, userRole || "Accounting")}
                plants={orderedPlants}
                quickLinks={homeQuickLinks} stats={homeStats}
                notifications={bellNotifications} onNotifClick={onNotifClick}
                deadlines={homeDeadlines} onDeadlineClick={onReminderClick}
                approvalReminders={homeApprovalReminders}
                onApprovalReminderClick={() => navigate("approvals")}
              />
            </div>
          </>
        )}
        {activeModule === "dashboard" && (
          activePlant && activeBranch ? (
            <>
              <TopBar
                title={activeBranch.label + " Dashboard"}
                sub={"Real-time summary of petty cash activity for " + activeBranch.label}
                right={canEditFunds ? <button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button> : null}
              />
              <div className="pcp-content">
                <BranchDashboard
                  label={activeBranch.label}
                  branchCode={activeBranch.branchCode}
                  branchCodes={scopeCodes}
                  funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments}
                  onNavigate={navigate}
                />
              </div>
            </>
          ) : (
            <>
              <TopBar
                title="Consolidated Dashboard"
                sub="Real-time summary of petty cash activity across your assigned plants"
                right={canEditFunds ? <button className="pcp-btn" onClick={() => setShowEditBalances(true)}><Edit3 size={14} /> Edit Beginning Balances</button> : null}
              />
              <div className="pcp-content">
                <Dashboard funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments} onNavigate={navigate} canEdit={canEdit} />
              </div>
            </>
          )
        )}
        {activeModule === "requests" && (
          <RequestsTab
            key={tab}
            requests={scopedRequests} funds={scopedFunds}
            onCreate={addRequest} onEdit={editRequest}
            onApprove={approveRequest} onReject={rejectRequest}
            onDisburse={(req) => setDisburseTarget(req)}
            canEditDisbursed={canEditOverride}
            plantOptions={scopedPlantOptions} canApprove={canApprove} canRelease={canRelease}
            plantTitle={activePlantLabel}
            canDelete={canDeleteTxn} onDelete={deleteRequest}
          />
        )}
        {activeModule === "disbursements" && (
          <DisbursementsTab
            key={tab}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations} requests={scopedRequests}
            onUpdateRemarks={updateRemarks} onToggleBilled={toggleBilled} onEditDisbursement={editDisbursement}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
            canEdit={canEditLedger}
            canDelete={canDeleteTxn} onDelete={deleteDisbursement}
          />
        )}
        {activeModule === "liquidation" && (
          <LiquidationTab
            key={tab}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations}
            onSaveLiquidation={saveLiquidation} onExport={exportLiquidation}
            showHeaderUpload={canLiqHeaderUpload}
            onExportAll={exportAllToAcumatica}
            onDecideReceipt={decideReceipt}
            onSubmitLiquidation={submitLiquidation}
            onReopenLiquidation={reopenLiquidation}
            onRecordSettlement={recordSettlement}
            onCloseShortage={closeShortage} onReopenShortage={reopenShortage}
            canApproveShortage={canApproveShortage}
            onReviewOverLiquidation={reviewOverLiquidation}
            canDelete={canDeleteTxn} onDeleteLiquidation={deleteLiquidation}
            onDeleteReimbursement={deleteReimbursement}
            canApproveReceipts={isLiquidationChecker}
            canRejectLiquidation={isLiquidationChecker || isFinalApprover}
            onRejectLiquidation={rejectLiquidation}
            onCheckLiquidation={checkLiquidation}
            canFinalApprove={isFinalApprover}
            onFinalApprove={finalApproveLiquidation}
            accounting={accountingProps}
            currentUser={userName || role}
            reimbursements={scopedReimbursements}
            onReimbursementAction={reimbursementAction}
            canEditReimb={canEditReimbOverride}
            canDeleteReimbDocs={canDeleteReimbDocs}
            canAuthorizeReimbVariance={canAuthorizeReimbVariance}
            canRevert={canRevert}
            onRevertLiquidation={revertLiquidation}
            onUpdateReimbursement={updateReimbursement}
            allReimbursements={reimbursements}
            canFinance={["Accounting", "Finance", "SuperAdmin"].includes(role) || !!isAdmin}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
            openRequest={liqOpenRequest}
            onOpenHandled={() => setLiqOpenRequest(null)}
          />
        )}
        {activeModule === "replenishment" && (
          <ReplenishmentTab
            key={tab}
            replenishments={scopedReplenishments} funds={scopedFunds}
            disbursements={scopedDisbursements} liquidations={scopedLiquidations}
            reimbursements={scopedReimbursements}
            onCreate={addReplenishment} onEdit={editReplenishment}
            onComplete={completeReplenishment} onDelete={deleteReplenishment}
            onRevert={revertReplenishment} onRevertReady={revertReadyItem} canManage={canManageReplen}
            canDelete={canDeleteTxn}
            generatedBy={userName || userEmail}
            plantOptions={scopedPlantOptions} canEdit={canEdit}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "reimbursement" && (
          <ReimbursementTab
            key={tab}
            reimbursements={scopedReimbursements}
            allReimbursements={reimbursements}
            plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
            currentUser={userName || role}
            isChecker={isLiquidationChecker}
            isFinalApprover={isFinalApprover}
            canFinance={["Accounting", "Finance", "SuperAdmin"].includes(role) || !!isAdmin}
            canDelete={canDeleteTxn}
            canEditOverride={canEditReimbOverride}
            canEditBeforeCustodian={canEditReimbBeforeCustodian}
            canDeleteDocs={canDeleteReimbDocs}
            canAuthorizeVariance={canAuthorizeReimbVariance}
            canRevert={canRevert}
            onSaveDraft={(form) => addReimbursement(form, false)}
            onSubmit={(form) => addReimbursement(form, true)}
            onUpdate={(id, form, mode) => updateReimbursement(id, form, mode)}
            onAction={reimbursementAction}
            accounting={accountingProps}
            onRecordPayment={recordReimbursementPayment}
            onExportAcumatica={exportReimbursementAcumatica}
            onExportReport={exportReimbursementReport}
            onDelete={deleteReimbursement}
          />
        )}
        {activeModule === "history" && (
          <TransactionHistoryTab
            key={tab}
            requests={scopedRequests} disbursements={scopedDisbursements}
            liquidations={scopedLiquidations} replenishments={scopedReplenishments}
            initialFilter={historyFilter} plantOptions={scopedPlantOptions}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "report" && (
          <ManagementReportTab
            key={tab}
            funds={scopedFunds} requests={scopedRequests} disbursements={scopedDisbursements} liquidations={scopedLiquidations} replenishments={scopedReplenishments}
            reimbursements={scopedReimbursements}
            auditLog={auditForUser} generatedBy={userName || userEmail}
            plantTitle={activePlantLabel}
          />
        )}
        {activeModule === "approvals" && canUseApprovalModule && (
          <ApprovalModuleTab
            canSelectExport={canApprovalExport}
            viewFinalQueue={canViewFinalQueue}
            viewOnly={approvalViewOnly}
            disbursements={visibleDisbursements} liquidations={visibleLiquidations}
            reimbursements={visibleReimbursements}
            replenishments={visibleReplenishments}
            onDecideReceipt={decideReceipt}
            onRejectLiquidation={rejectLiquidation}
            onReopenLiquidation={reopenLiquidation}
            onCheckLiquidation={checkLiquidation}
            onFinalApprove={finalApproveLiquidation}
            accounting={accountingProps}
            onReimbursementAction={reimbursementAction}
            canEditReimb={canEditReimbOverride}
            canDeleteReimbDocs={canDeleteReimbDocs}
            canAuthorizeReimbVariance={canAuthorizeReimbVariance}
            canRevert={canRevert}
            onRevertLiquidation={revertLiquidation}
            onUpdateReimbursement={updateReimbursement}
            reimbPlantOptions={branchOptions.filter((p) => inScope(p.code))}
            onExportReimbursementAcumatica={exportReimbursementAcumatica}
            isChecker={isLiquidationChecker}
            isFinalApprover={isFinalApprover}
            canFinance={["Accounting", "Finance", "SuperAdmin"].includes(role) || !!isAdmin}
            currentUser={userName || role}
            plantOptions={plantOptions}
            onOpenReplenishment={[...allowedTabs].some((t) => parseTab(t).module === "replenishment")
              ? () => navigate("replenishment") : undefined}
          />
        )}
        {activeModule === "approved" && canUseApprovedModule && allowedTabs.has("approved") && (
          <ApprovedModuleTab
            disbursements={visibleDisbursements} liquidations={visibleLiquidations}
            reimbursements={visibleReimbursements} replenishments={visibleReplenishments}
            plantOptions={plantOptions} currentUser={userName || role}
          />
        )}
        {activeModule === "aging" && (
          <LiquidationAgingTab
            funds={visibleFunds} requests={visibleRequests} disbursements={visibleDisbursements}
            liquidations={visibleLiquidations} replenishments={visibleReplenishments}
            focus={agingFocus}
          />
        )}
        {activeModule === "audit" && (
          <AuditTrailTab auditLog={auditForUser} canDelete={isSuperAdmin} onDelete={deleteAuditEntries} />
        )}
        {activeModule === "documents" && allowedTabs.has("documents") && (
          <PcfDocumentsTab
            documents={docsForUser} allDocCount={documents.length}
            funds={plantRestricted ? visibleFunds : funds} plantOptions={plantOptions}
            userName={userName} role={role} isAdmin={isAdmin} readOnly={docsReadOnly}
            onAdd={addDocuments} onReplace={replaceDocument} onUpdate={updateDocument}
            onDelete={deleteDocument} onActivity={docActivity}
          />
        )}        {activeModule === "masterdata" && (
          <MasterDataTab
            funds={plantRestricted ? visibleFunds : funds}
            disbursements={plantRestricted ? visibleDisbursements : disbursements}
            liquidations={plantRestricted ? visibleLiquidations : liquidations}
            replenishments={plantRestricted ? visibleReplenishments : replenishments}
            onAddFund={addFund} onEditFund={editFund} onDeleteFund={deleteFund}
          />
        )}
        {activeModule === "users" && (
          <UserManagementTab currentEmail={userEmail} onChangePassword={() => setShowChangePw(true)} />
        )}
        {activeModule === "settings" && (
          <SystemSettingsTab
            userName={userName} userEmail={userEmail} role={role} plants={allowedPlants}
            isAdmin={isAdmin}
            requests={requests} disbursements={disbursements}
            liquidations={liquidations} replenishments={replenishments}
          />
        )}
      </div>

      {disburseTarget && (
        <DisburseModal
          request={disburseTarget}
          nextVoucherNo={nextVoucherNo}
          outstanding={outstandingAdvancesFor(disburseTarget.employee)}
          onClose={() => setDisburseTarget(null)}
          onConfirm={confirmDisburse}
        />
      )}
      {showEditBalances && canEditFunds && (
        <EditBalancesModal
          funds={visibleFunds}
          onClose={() => setShowEditBalances(false)}
          onSave={(updates) => { saveBalances(updates); setShowEditBalances(false); }}
        />
      )}
      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} onDone={(msg) => logAudit("Password Changed", userEmail || "—", msg || "Password updated")} />
      )}
      {showMfaDevices && (
        <MfaDevicesModal onClose={() => setShowMfaDevices(false)} onDone={(msg) => logAudit("Authenticator Changed", userEmail || "—", msg)} />
      )}
    </div>
    </AppUI.Provider>
  );
}

