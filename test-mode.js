/* ============================= TEST MODE =============================
   Loaded by index.html ONLY when the address ends in ?test=1, for
   presentations and training. It holds made-up transactions in the browser's
   memory: refresh and everything is back as it started.

   It can never touch the live portal:
     - index.html blanks the Supabase address and key before anything connects;
     - the guard below refuses any request to Supabase, as a second lock.
   The passwords here open this sample data and nothing else. They are not the
   real accounts' passwords, and the live login never reads this file.
------------------------------------------------------------------------- */
(function () {
  var TEST_PASSWORD = "test1234";
  window.PCP_LOCAL_USERS = [
    { user: "a1plusadmin@a1plus.com", password: TEST_PASSWORD, role: "SuperAdmin", name: "Grace Gan" },
    { user: "accounting@a1plus.com", password: TEST_PASSWORD, role: "Accounting", name: "Accounting Department" },
  ];

  /* ---- Second lock: nothing in this tab may reach the live database ---- */
  var isLive = function (u) { return /supabase\.(co|in)/i.test(String((u && u.url) || u || "")); };
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    if (isLive(input)) return Promise.reject(new Error("Blocked: test mode does not connect to the live portal."));
    return realFetch.call(window, input, init);
  };
  var realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isLive(url)) throw new Error("Blocked: test mode does not connect to the live portal.");
    return realOpen.apply(this, arguments);
  };
  var RealWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (isLive(url)) throw new Error("Blocked: test mode does not connect to the live portal.");
    return protocols ? new RealWS(url, protocols) : new RealWS(url);
  };
  window.WebSocket.prototype = RealWS.prototype;

  /* ---- Sample data, dated relative to today so nothing looks stale ---- */
  var day = function (back) {
    var d = new Date(Date.now() + 8 * 3600000 - back * 86400000);
    return d.toISOString().slice(0, 10);
  };
  /* Approval stamps are saved in UTC without a zone, like the real ones. */
  var stamp = function (back, hour) { return day(back) + "T" + ("0" + hour).slice(-2) + ":15:00"; };
  var receiptSvg = function (no, amount) {
    return "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="620"><rect width="480" height="620" fill="#fff" stroke="#999"/>'
      + '<text x="240" y="70" font-family="Arial" font-size="26" font-weight="700" text-anchor="middle">SAMPLE RECEIPT</text>'
      + '<text x="240" y="110" font-family="Arial" font-size="16" fill="#c62828" text-anchor="middle">Test mode - not a real document</text>'
      + '<text x="50" y="220" font-family="Arial" font-size="20">Reference: ' + no + '</text>'
      + '<text x="50" y="280" font-family="Arial" font-size="20">Amount: PHP ' + amount.toLocaleString("en-PH", { minimumFractionDigits: 2 }) + '</text></svg>');
  };
  var attachment = function (id, no, amount) {
    return { id: "att-" + id, name: "sample-receipt-" + no + ".svg", type: "image/svg+xml", dataUrl: receiptSvg(no, amount), approvalStatus: "Approved", receiptAmount: amount, receiptNo: "OR-" + no };
  };
  var EMPLOYEES = ["Juan Dela Cruz", "Maria Santos", "Pedro Reyes", "Ana Bautista", "Jose Garcia", "Liza Mendoza"];
  var SAMPLES = [
    ["Gasoline", "Fuel for delivery run", "000-00006"], ["OE Toll Fee", "Toll fee - client visit", "000-00003"],
    ["OE Transportation and travel", "Parking and transport", "000-00012"], ["OE Communication, Light & Water", "Mobile load", "000-00009"],
  ];
  var rows = [];
  var add = function (collection, data) { rows.push({ id: data.id, collection: collection, data: data }); };
  var liqNo = 9000, rmbNo = 9000, seq = 0;
  /* How many days ago each group reached Accounting; every other date follows
     from it, so a transaction's history always runs in order. */
  var B = 5;
  var CUSTODIAN = function () { return { checkedBy: "Sample Custodian", checkedAt: stamp(B + 1, 2) }; };
  var ACCOUNTING = function (batch) { return { acctCheckedBy: "accounting@a1plus.com", acctCheckedByName: "Accounting Department", acctCheckedAt: stamp(B, 3), batchNo: batch }; };
  var FINAL = function () { return { finalBy: "Grace Gan", finalAt: stamp(B - 1, 1), finalRemarks: "" }; };
  var merge = function () { return Object.assign.apply(Object, [{}].concat([].slice.call(arguments))); };

  /* A released voucher with its liquidation. Returns the liquidation id. */
  var liquidation = function (branch, amount, review, submitted) {
    var n = ++liqNo, i = seq++, s = SAMPLES[i % SAMPLES.length], id = "t-liq-" + n, dv = "t-dv-" + n, date = day(B + 4 + (i % 3));
    add("disbursements", { id: dv, voucherNo: "PCV-T-2026-" + n, date: date, employee: EMPLOYEES[i % EMPLOYEES.length], department: s[2], branchCode: branch, expense: s[1], purpose: s[1], amount: amount, status: "Open" });
    add("liquidations", {
      id: id, disbursementId: dv, createdDate: day(B + 3), workflow: true, submissionStatus: submitted === false ? "Draft" : "Submitted", submittedAt: stamp(B + 2, 2),
      review: review, settlement: { settled: true },
      lines: [{ id: "ln-" + n, date: date, expense: s[1], category: s[0], department: s[2], amount: amount }],
      attachments: [attachment(id, n, amount)],
    });
    return id;
  };
  var reimbursement = function (branch, amount, status, review) {
    var n = ++rmbNo, i = seq++, s = SAMPLES[i % SAMPLES.length], id = "t-rmb-" + n, date = day(B + 4 + (i % 3));
    add("reimbursements", {
      id: id, reimbNo: "RMB-T-2026-" + n, requestDate: date, submittedAt: stamp(B + 2, 3), employee: EMPLOYEES[i % EMPLOYEES.length], createdBy: EMPLOYEES[i % EMPLOYEES.length],
      department: s[2], branchCode: branch, purpose: s[1], status: status, review: review,
      lines: [{ id: "rl-" + n, date: date, description: s[1], vendor: "Sample Vendor", category: s[0], department: s[2], amount: amount }],
      attachments: [attachment(id, n, amount)],
    });
    return id;
  };

  /* Waiting for Grace Gan: two batches she can approve live. */
  var B1 = "BATCH-T01", B2 = "BATCH-T02";
  liquidation("HASBRO", 4250, merge(CUSTODIAN(), ACCOUNTING(B1)));
  liquidation("MATTEL", 2875.5, merge(CUSTODIAN(), ACCOUNTING(B1)));
  liquidation("HASBRO", 1320, merge(CUSTODIAN(), ACCOUNTING(B1)));
  reimbursement("HASBRO", 960, "FOR FINAL APPROVAL", merge(CUSTODIAN(), ACCOUNTING(B1)));
  liquidation("WARNER", 3600, merge(CUSTODIAN(), ACCOUNTING(B2)));
  reimbursement("WARNER", 1540.75, "FOR FINAL APPROVAL", merge(CUSTODIAN(), ACCOUNTING(B2)));

  /* Earlier steps, for Accounting's view. */
  liquidation("HASBRO", 2150, merge(CUSTODIAN()));
  liquidation("PERULANDIA", 780, merge(CUSTODIAN()));
  liquidation("SITIO", 1190, {});

  /* Approved, ready for Accounting to replenish. */
  B = 6;
  liquidation("HASBRO", 5100, merge(CUSTODIAN(), ACCOUNTING("BATCH-T00"), FINAL()));
  liquidation("MATTEL", 2300, merge(CUSTODIAN(), ACCOUNTING("BATCH-T00"), FINAL()));
  reimbursement("HASBRO", 845.25, "FULLY APPROVED / READY FOR REPLENISHMENT", merge(CUSTODIAN(), ACCOUNTING("BATCH-T00"), FINAL()));

  /* In a replenishment, not yet completed. */
  B = 12;
  var pendA = liquidation("HASBRO", 3400, merge(CUSTODIAN(), ACCOUNTING("BATCH-S09"), FINAL()));
  var pendB = liquidation("MATTEL", 1950, merge(CUSTODIAN(), ACCOUNTING("BATCH-S09"), FINAL()));
  var pendC = reimbursement("HASBRO", 650, "FULLY APPROVED / READY FOR REPLENISHMENT", merge(CUSTODIAN(), ACCOUNTING("BATCH-S09"), FINAL()));
  add("replenishments", { id: "t-rpl-1", replenishmentNo: "RPL-T-2026-9002", date: day(10), branchCode: "A1+", amount: 6000, preparedBy: "Accounting Department", status: "Pending", remarks: "Sample replenishment", liquidationIds: [pendA, pendB], reimbursementIds: [pendC] });

  /* Replenished and completed. */
  B = 24;
  var doneA = liquidation("HASBRO", 6200, merge(CUSTODIAN(), ACCOUNTING("BATCH-S08"), FINAL()));
  var doneB = reimbursement("MATTEL", 1800, "FULLY APPROVED / READY FOR REPLENISHMENT", merge(CUSTODIAN(), ACCOUNTING("BATCH-S08"), FINAL()));
  add("replenishments", { id: "t-rpl-0", replenishmentNo: "RPL-T-2026-9001", date: day(20), branchCode: "A1+", amount: 8000, preparedBy: "Accounting Department", status: "Completed", completedBy: "Accounting Department", completedAt: stamp(16, 3), acumaticaPoNo: "PO-SAMPLE-01", acumaticaApvNo: "APV-SAMPLE-01", remarks: "Sample completed replenishment", liquidationIds: [doneA], reimbursementIds: [doneB] });

  window.PCP_TEST_ROWS = rows;

  /* ---- Always-visible markers ---- */
  document.addEventListener("DOMContentLoaded", function () {
    document.title = "TEST MODE - " + document.title;
    var bar = document.createElement("div");
    bar.id = "pcp-test-banner";
    bar.textContent = "TEST MODE · Sample data only · Nothing here reaches the live portal · Refresh to reset";
    bar.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;padding:7px 16px;border-radius:99px;background:#c62828;color:#fff;font:700 13px Arial,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.3)";
    document.body.appendChild(bar);
    var help = document.createElement("div");
    help.id = "pcp-test-logins";
    help.style.cssText = "position:fixed;left:22px;top:22px;z-index:99999;padding:12px 16px;border-radius:10px;background:#fff176;color:#3b2a00;border:2px solid #e0a800;font:13px/1.5 Arial,sans-serif;display:none";
    help.innerHTML = "<b>Test logins</b> (password for both: <b>" + TEST_PASSWORD + "</b>)<br>Grace Gan: a1plusadmin@a1plus.com<br>Accounting: accounting@a1plus.com";
    document.body.appendChild(help);
    setInterval(function () { help.style.display = document.querySelector("input[type=password]") ? "block" : "none"; }, 400);
  });
})();
