/* ============================= DASHBOARD ============================= */

const CHART_COLORS = ["#4e7d63", "#5b8db8", "#c2a15a", "#7fb89a", "#8e7cc3", "#3f9c8f", "#d08a5a", "#8a978f"];

function KpiCard({ label, value, icon: Icon, tint, foot, onClick, active }) {
  return (
    <div className={"pcp-kpi" + (onClick ? " pcp-kpi-click" : "") + (active ? " active" : "")} onClick={onClick}>
      <div className="pcp-kpi-icon" style={{ background: tint + "22", color: tint }}>
        <Icon size={16} />
      </div>
      <div className="pcp-kpi-label">{label}</div>
      <div className="pcp-kpi-value pcp-num">{value}</div>
      {foot && <div className="pcp-kpi-foot">{foot}</div>}
    </div>
  );
}

/* Per-plant tab bar shown at the top of each module so users with more than one
   plant (Accounting, Finance, Pura Barloso) can view a single plant at a time —
   effectively a separate module per plant. Hidden when only one plant applies. */
function PlantScopeTabs({ plants, value, onChange }) {
  /* The plant's own fund-holding branch (isPlantRoot, set in 19-app.jsx) is left
     out of this row. The page header already names the plant, so the tab only
     repeated it — "Manila" under Manila · Petty Cash Requests, "Disney" under
     Disney. Nothing becomes unreachable: those records still show under "All
     Plants", and the branch is still selectable in the module forms, because
     only this filter row is filtered — not the underlying option list. */
  const list = (plants || []).filter((p) => !p.isPlantRoot);
  if (list.length <= 1) return null;
  return (
    <div className="pcp-tabs" style={{ marginBottom: 14 }}>
      <button className={"pcp-tab" + (value === "ALL" ? " active" : "")} onClick={() => onChange("ALL")}>All Plants</button>
      {list.map((p) => (
        <button key={p.code} className={"pcp-tab" + (value === p.code ? " active" : "")} onClick={() => onChange(p.code)}>{p.label}</button>
      ))}
    </div>
  );
}

function groupSum(items, keyFn, valFn) {
  const map = new Map();
  items.forEach((it) => {
    const k = keyFn(it) || "Unassigned";
    map.set(k, (map.get(k) || 0) + (valFn ? valFn(it) : 1));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function MiniBarChart({ data, height = 220, layout = "vertical", onSelect }) {
  if (!data.length) return <div className="pcp-empty">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout === "vertical" ? "vertical" : "horizontal"} margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={layout !== "vertical"} vertical={layout === "vertical"} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tickFormatter={shortPeso} fontSize={10.5} stroke="#8fa397" />
            <YAxis type="category" dataKey="name" width={120} fontSize={10.5} stroke="#8fa397" />
          </>
        ) : (
          <>
            <XAxis dataKey="name" fontSize={10.5} stroke="#8fa397" />
            <YAxis tickFormatter={shortPeso} fontSize={10.5} stroke="#8fa397" />
          </>
        )}
        <Tooltip formatter={(v) => peso(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
        <Bar dataKey="value" fill="#4e7d63" radius={[4, 4, 4, 4]} maxBarSize={22}
          cursor={onSelect ? "pointer" : undefined}
          onClick={onSelect ? (d) => onSelect(pickName(d)) : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const DASHBOARD_BRANCHES = PLANTS.map((p) => ({ key: p.key, label: p.label, branchCode: p.code }));

/* ---- Drill-down support -------------------------------------------------
   Every dashboard chart is clickable. Clicking a bar / slice / legend / point
   opens a slide-in panel listing the underlying transactions with search,
   filters, sorting, pagination, receipt viewing and Excel/CSV/PDF/Print export
   (the export reuses the professional report engine). Records are enriched
   once from the live data and paginated, so thousands of rows stay responsive. */

/* Extract the clicked category name from the various Recharts click payloads
   (bar datum, pie sector, or legend entry). */
function pickName(d) {
  if (!d) return null;
  if (d.name != null) return d.name;
  if (typeof d.value === "string") return d.value;
  if (d.payload) {
    if (d.payload.name != null) return d.payload.name;
    if (d.payload.payload && d.payload.payload.name != null) return d.payload.payload.name;
  }
  return null;
}

/* Flatten a disbursement (+ its request and liquidation) into one row that the
   drill-down table, detail card and exporter can all read from. */
function enrichDisbursement(d, requests, liquidations) {
  const req = requests.find((r) => r.id === d.requestId);
  const liq = liquidationFor(d.id, liquidations);
  const amtLiq = liquidatedTotal(liq);
  const amount = Number(d.amount) || 0;
  return {
    id: d.id, _date: d.date, date: fmtDate(d.date),
    dateRequested: req ? fmtDate(req.date) : "—",
    liqDate: liq ? fmtDate(liq.createdDate) : "—",
    requestNo: req ? req.requestNo : "—", voucherNo: d.voucherNo,
    company: companyOfBranch(d.branchCode), branch: d.branchCode,
    department: deptDesc(d.department), requestor: d.employee, payee: d.employee,
    purpose: req ? req.purpose : "—", expenseCategory: disbExpense(d) || "—",
    amountRequested: req ? (Number(req.amount) || 0) : amount,
    amount, amountLiquidated: amtLiq, remaining: amount - amtLiq,
    status: liqStatusFor(d, liquidations), liqRef: liq ? liq.id : "—",
    _receipts: (liq && liq.attachments) ? liq.attachments : [],
    _req: req, _liq: liq,
  };
}

/* Flatten a single liquidation line (for the "liquidated expense" drill-downs). */
function enrichLine(line, d, liq, req) {
  const desc = (line.expense && line.expense.trim()) ? line.expense.trim() : line.category;
  return {
    id: line.id, _date: line.date, date: fmtDate(line.date),
    branch: d.branchCode, company: companyOfBranch(d.branchCode),
    department: deptDesc(line.department || d.department), description: desc,
    amount: Number(line.amount) || 0, liqRef: liq ? liq.id : "—",
    requestor: d.employee, payee: d.employee, voucherNo: d.voucherNo,
    requestNo: req ? req.requestNo : "—", purpose: req ? req.purpose : "—",
    expenseCategory: line.category, status: "Liquidated",
    _receipts: (liq && liq.attachments) ? liq.attachments : [],
    _req: req, _liq: liq,
  };
}

const DRILL_COLS_DISB = [
  { key: "date", label: "Date", sortable: true },
  { key: "requestNo", label: "Request No.", sortable: true },
  { key: "voucherNo", label: "Voucher No.", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "branch", label: "Branch", sortable: true },
  { key: "department", label: "Department", sortable: true },
  { key: "expenseCategory", label: "Expense", sortable: true },
  { key: "payee", label: "Payee", sortable: true },
  { key: "amount", label: "Amount", money: true, align: "right", sortable: true },
  { key: "status", label: "Liquidation Status", badge: true, align: "center", sortable: true },
];

const DRILL_COLS_LIQSTATUS = [
  { key: "requestNo", label: "Request No.", sortable: true },
  { key: "dateRequested", label: "Date Requested", sortable: true },
  { key: "liqDate", label: "Liquidation Date", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "branch", label: "Branch", sortable: true },
  { key: "department", label: "Department", sortable: true },
  { key: "requestor", label: "Requestor", sortable: true },
  { key: "payee", label: "Payee", sortable: true },
  { key: "amountRequested", label: "Amt Requested", money: true, align: "right", sortable: true },
  { key: "amountLiquidated", label: "Amt Liquidated", money: true, align: "right", sortable: true },
  { key: "remaining", label: "Remaining", money: true, align: "right", sortable: true },
  { key: "status", label: "Status", badge: true, align: "center", sortable: true },
];

const DRILL_COLS_EXPLIQ = [
  { key: "date", label: "Date", sortable: true },
  { key: "branch", label: "Branch", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "department", label: "Department", sortable: true },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount", money: true, align: "right", sortable: true },
  { key: "liqRef", label: "Liquidation Ref" },
  { key: "receipt", label: "Receipt", align: "center" },
  { key: "requestor", label: "Requestor", sortable: true },
];

const DRILL_PAGE_SIZES = [10, 25, 50, 100];

function drillSortValue(row, key) {
  if (key === "date") return row._date || "";
  if (key === "dateRequested") return (row._req && row._req.date) || "";
  if (key === "liqDate") return (row._liq && row._liq.createdDate) || "";
  const v = row[key];
  return v == null ? "" : v;
}

/* One receipt chip. Separate component so it can resolve the file through
   useFileUrl — inline bytes on a legacy record, a signed bucket URL on a
   migrated one — which a hook cannot do from inside the map below. */
function DrillReceipt({ att }) {
  const src = useFileUrl(att);
  const isImg = (att.type || "").startsWith("image/") && src;
  return (
    <a className="pcp-receipt" href={src || "#"} target="_blank" rel="noopener noreferrer" title={att.name}>
      {isImg ? <img src={src} alt={att.name} /> : <div className="fileicon"><Receipt size={22} color="#8fa397" /></div>}
      <span>{att.name}</span>
    </a>
  );
}

function DrillReceipts({ items }) {
  if (!items || !items.length) return <span style={{ color: "var(--text-mut)", fontSize: 12 }}>No receipts attached.</span>;
  return (
    <div className="pcp-receipts">
      {items.map((a) => <DrillReceipt key={a.id} att={a} />)}
    </div>
  );
}

function DrillDownModal({ chartName, label, columns, records, canEdit, onEditRecord, onClose }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fBranch, setFBranch] = useState("ALL");
  const [fCompany, setFCompany] = useState("ALL");
  const [fDept, setFDept] = useState("ALL");
  const [fStatus, setFStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState(columns[0].key);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState(null);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 190); }, [onClose]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const opts = useMemo(() => {
    const uniq = (fn) => Array.from(new Set(records.map(fn).filter(Boolean))).sort();
    return { branches: uniq((r) => r.branch), companies: uniq((r) => r.company), departments: uniq((r) => r.department), statuses: uniq((r) => r.status) };
  }, [records]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((r) => {
      if (from && (r._date || "") < from) return false;
      if (to && (r._date || "") > to) return false;
      if (fBranch !== "ALL" && r.branch !== fBranch) return false;
      if (fCompany !== "ALL" && r.company !== fCompany) return false;
      if (fDept !== "ALL" && r.department !== fDept) return false;
      if (fStatus !== "ALL" && r.status !== fStatus) return false;
      if (needle) {
        const hay = [r.requestNo, r.voucherNo, r.requestor, r.payee, r.purpose, r.description, r.expenseCategory, r.branch, r.company, r.department]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [records, q, from, to, fBranch, fCompany, fDept, fStatus]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey) || {};
    return [...filtered].sort((a, b) => {
      let va = drillSortValue(a, sortKey), vb = drillSortValue(b, sortKey);
      if (col.money) { va = Number(va) || 0; vb = Number(vb) || 0; return sortDir === "asc" ? va - vb : vb - va; }
      va = String(va); vb = String(vb);
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortKey, sortDir, columns]);

  useEffect(() => { setPage(0); }, [q, from, to, fBranch, fCompany, fDept, fStatus, sortKey, sortDir, pageSize]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = page * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const sumAmount = useMemo(() => filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0), [filtered]);

  const setSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const buildDoc = () => {
    const docCols = columns.filter((c) => c.key !== "receipt").map((c) => ({ key: c.key, label: c.label, align: c.align || (c.money ? "right" : "left"), money: !!c.money }));
    let hasMoney = false;
    const totalsRow = { _total: true };
    docCols.forEach((col) => { if (col.money) { hasMoney = true; totalsRow[col.key] = sorted.reduce((s, r) => s + (Number(r[col.key]) || 0), 0); } });
    totalsRow[docCols[0].key] = "GRAND TOTAL";
    return {
      title: chartName + " — " + label, orientation: docCols.length > 7 ? "landscape" : "portrait",
      columns: docCols, rows: sorted, totalsRow: hasMoney ? totalsRow : null, count: total,
      meta: { "Report": chartName, "Data Point": label, "Records": String(total), "Generated By": "Dashboard Drill-Down", "Date Generated": nowStamp() },
      reference: makeReportRef("DRILL"), watermark: false,
    };
  };

  const align = (a) => ({ textAlign: a === "right" ? "right" : a === "center" ? "center" : "left" });
  const cellContent = (r, col) => {
    if (col.key === "receipt") {
      const n = (r._receipts || []).length;
      return n
        ? <span className="pcp-receipt-link" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{n} file{n > 1 ? "s" : ""}</span>
        : <span style={{ color: "#8fa397" }}>—</span>;
    }
    if (col.badge) return <Badge status={r[col.key]} />;
    if (col.money) return <span className="pcp-num">{money(r[col.key])}</span>;
    const v = r[col.key];
    return (v == null || v === "") ? "—" : v;
  };

  return (
    <div className={"pcp-drill-backdrop" + (closing ? " closing" : "")} onClick={close}>
      <div className={"pcp-drill" + (closing ? " closing" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-drill-head">
          <div className="pcp-breadcrumb">
            <span className="crumb link" onClick={close}><LayoutDashboard size={12} /> Dashboard</span>
            <ChevronRight size={12} />
            <span className="crumb"><b>{chartName}</b></span>
            <ChevronRight size={12} />
            <span className="crumb">{label} · Transactions</span>
          </div>
          <div className="pcp-drill-title">
            {chartName} <span className="pill">{label}</span>
            <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" style={{ marginLeft: "auto" }} onClick={close}><X size={16} /></button>
          </div>
        </div>
        <div className="pcp-drill-body">
          <div className="pcp-drill-toolbar">
            <div className="pcp-drill-search">
              <Search size={14} />
              <input placeholder="Search transactions…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="pcp-btn pcp-btn-sm" onClick={() => exportReportExcel(buildDoc())}><FileSpreadsheet size={13} /> Excel</button>
            <button className="pcp-btn pcp-btn-sm" onClick={() => exportReportCsv(buildDoc())}><Download size={13} /> CSV</button>
            <button className="pcp-btn pcp-btn-sm" onClick={() => printReportDocument(buildDoc())}><FileText size={13} /> PDF</button>
            <button className="pcp-btn pcp-btn-sm" onClick={() => printReportDocument(buildDoc())}><Printer size={13} /> Print</button>
          </div>
          <div className="pcp-drill-filters">
            <div className="pcp-rc-field"><label>From</label><input type="date" className="pcp-input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="pcp-rc-field"><label>To</label><input type="date" className="pcp-input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="pcp-rc-field"><label>Company</label><select className="pcp-select" value={fCompany} onChange={(e) => setFCompany(e.target.value)}><option value="ALL">All</option>{opts.companies.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="pcp-rc-field"><label>Branch</label><select className="pcp-select" value={fBranch} onChange={(e) => setFBranch(e.target.value)}><option value="ALL">All</option>{opts.branches.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="pcp-rc-field"><label>Department</label><select className="pcp-select" value={fDept} onChange={(e) => setFDept(e.target.value)}><option value="ALL">All</option>{opts.departments.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="pcp-rc-field"><label>Status</label><select className="pcp-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="ALL">All</option>{opts.statuses.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="pcp-drill-count" style={{ marginBottom: 8 }}>{total} transaction{total !== 1 ? "s" : ""} · Total {money(sumAmount)}</div>
          <div className="pcp-card">
            <div className="pcp-table-wrap">
              <table className="pcp-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className={col.sortable ? "pcp-sortable" : ""} style={align(col.align)} onClick={col.sortable ? () => setSort(col.key) : undefined}>
                        {col.label}{col.sortable && sortKey === col.key ? <span className="pcp-sort-ind">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span> : null}
                      </th>
                    ))}
                    <th style={{ textAlign: "right" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length ? pageRows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr>
                        {columns.map((col) => <td key={col.key} style={align(col.align)}>{cellContent(r, col)}</td>)}
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? "Hide" : "View"}</button>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr>
                          <td colSpan={columns.length + 1} style={{ background: "var(--dm-subtle, #fafbfd)" }}>
                            <div className="pcp-detail-card">
                              <div className="pcp-detail-grid">
                                <div><div className="lbl">Request No.</div>{r.requestNo || "—"}</div>
                                <div><div className="lbl">Voucher No.</div>{r.voucherNo || "—"}</div>
                                <div><div className="lbl">Status</div><Badge status={r.status} /></div>
                                <div><div className="lbl">Date Requested</div>{r.dateRequested || r.date}</div>
                                <div><div className="lbl">Liquidation Date</div>{r.liqDate || "—"}</div>
                                <div><div className="lbl">Company</div>{r.company}</div>
                                <div><div className="lbl">Branch</div>{r.branch}</div>
                                <div><div className="lbl">Department</div>{r.department}</div>
                                <div><div className="lbl">Expense</div>{r.expenseCategory || "—"}</div>
                                <div><div className="lbl">Requestor</div>{r.requestor || "—"}</div>
                                <div><div className="lbl">Payee</div>{r.payee || "—"}</div>
                                <div><div className="lbl">Purpose / Description</div>{r.purpose || r.description || "—"}</div>
                                <div><div className="lbl">Amount Requested</div>{money(r.amountRequested != null ? r.amountRequested : r.amount)}</div>
                                <div><div className="lbl">Amount Liquidated</div>{money(r.amountLiquidated || 0)}</div>
                                <div><div className="lbl">Remaining Balance</div>{money(r.remaining != null ? r.remaining : 0)}</div>
                              </div>
                              <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--text-mut)" }}>Attached Receipts / Documents</div>
                              <DrillReceipts items={r._receipts} />
                              {canEdit && onEditRecord && (
                                <div style={{ marginTop: 12 }}>
                                  <button className="pcp-btn pcp-btn-sm" onClick={() => onEditRecord(r)}><Edit3 size={13} /> Edit in Release Ledger</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : <tr><td colSpan={columns.length + 1} className="pcp-empty">No matching transactions.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pcp-pager">
            <span>Rows:</span>
            <select className="pcp-select" style={{ width: 72 }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {DRILL_PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{total ? start + 1 : 0}–{Math.min(start + pageSize, total)} of {total}</span>
            <button className="pcp-btn pcp-btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
            <span>Page {page + 1} / {pageCount}</span>
            <button className="pcp-btn pcp-btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pcp-btn" onClick={close}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Interactive Department drill-down --------------------------------
   A self-contained dashboard panel: a Department pie chart cross-filters an
   inline, paginated transaction table (no modal, no navigation). Clicking a
   slice toggles the department filter; the pie itself reflects every OTHER
   active filter, while the table and summary cards reflect ALL filters. */
const DEPT_LIQ_STATUSES = ["Not Liquidated", "Partially Liquidated", "Fully Liquidated", "Over-Liquidated"];

function DeptDrilldownPanel({ funds, requests, disbursements, liquidations }) {
  const today = todayISO();
  const [dept, setDept] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fCompany, setFCompany] = useState("ALL");
  const [fPlant, setFPlant] = useState("ALL");
  const [fBranch, setFBranch] = useState("ALL");
  const [fCategory, setFCategory] = useState("ALL");
  const [fLiq, setFLiq] = useState("ALL");
  const [fAging, setFAging] = useState("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  /* Enrich each disbursement once with its request/liquidation, plant label and
     aging status. Money values stay numeric so totals stay exact. */
  const rows = useMemo(() => {
    const fundByBranch = new Map((funds || []).map((f) => [f.branchCode, f]));
    return (disbursements || []).map((d) => {
      const base = enrichDisbursement(d, requests, liquidations);
      const fund = fundByBranch.get(d.branchCode);
      const fully = base.status === "Fully Liquidated" || base.status === "Over-Liquidated";
      const ageDays = Math.max(0, daysBetween(base._date, today));
      return {
        ...base,
        plantLabel: (fund && fund.label) || plantLabel(d.branchCode) || d.branchCode,
        agingStatus: agingStatusOf(ageDays, fully),
      };
    });
  }, [disbursements, requests, liquidations, funds, today]);

  /* Predicate for every filter except (optionally) the department, so the pie
     can be built from the other filters while the table applies them all. */
  const passes = useCallback((r, skipDept) => {
    if (from && (r._date || "") < from) return false;
    if (to && (r._date || "") > to) return false;
    if (fCompany !== "ALL" && r.company !== fCompany) return false;
    if (fPlant !== "ALL" && r.branch !== fPlant) return false;
    if (fBranch !== "ALL" && r.branch !== fBranch) return false;
    if (fCategory !== "ALL" && (r.expenseCategory || "Unassigned") !== fCategory) return false;
    if (fLiq !== "ALL" && r.status !== fLiq) return false;
    if (fAging !== "ALL" && r.agingStatus !== fAging) return false;
    if (!skipDept && dept && r.department !== dept) return false;
    return true;
  }, [from, to, fCompany, fPlant, fBranch, fCategory, fLiq, fAging, dept]);

  const rowsMinusDept = useMemo(() => rows.filter((r) => passes(r, true)), [rows, passes]);
  const finalRows = useMemo(() => (dept ? rowsMinusDept.filter((r) => r.department === dept) : rowsMinusDept), [rowsMinusDept, dept]);

  const deptDist = useMemo(() => {
    const g = groupSum(rowsMinusDept, (r) => r.department || "Unassigned", (r) => r.amount);
    return g.sort((a, b) => b.value - a.value);
  }, [rowsMinusDept]);

  /* Option lists derived from the data. */
  const opts = useMemo(() => {
    const uniq = (fn) => Array.from(new Set(rows.map(fn).filter(Boolean))).sort();
    return {
      companies: uniq((r) => r.company),
      plants: Array.from(new Map(rows.map((r) => [r.branch, r.plantLabel])).entries()).map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label)),
      categories: uniq((r) => r.expenseCategory || "Unassigned"),
      departments: uniq((r) => r.department || "Unassigned"),
    };
  }, [rows]);

  const summary = useMemo(() => finalRows.reduce((s, r) => ({
    count: s.count + 1,
    requested: s.requested + (Number(r.amountRequested) || 0),
    released: s.released + (Number(r.amount) || 0),
    liquidated: s.liquidated + (Number(r.amountLiquidated) || 0),
    outstanding: s.outstanding + (Number(r.remaining) || 0),
  }), { count: 0, requested: 0, released: 0, liquidated: 0, outstanding: 0 }), [finalRows]);

  useEffect(() => { setPage(0); }, [from, to, fCompany, fPlant, fBranch, fCategory, fLiq, fAging, dept, pageSize]);

  const total = finalRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = page * pageSize;
  const pageRows = finalRows.slice(start, start + pageSize);

  const clearAll = () => {
    setDept(null); setFrom(""); setTo("");
    setFCompany("ALL"); setFPlant("ALL"); setFBranch("ALL");
    setFCategory("ALL"); setFLiq("ALL"); setFAging("ALL");
  };
  const anyFilter = dept || from || to || fCompany !== "ALL" || fPlant !== "ALL" || fBranch !== "ALL" || fCategory !== "ALL" || fLiq !== "ALL" || fAging !== "ALL";

  const toggleDept = (name) => { if (!name) return; setDept((cur) => (cur === name ? null : name)); };
  const liqBadge = (s) => s === "Fully Liquidated" ? "green" : s === "Partially Liquidated" ? "amber" : s === "Over-Liquidated" ? "blue" : "gray";
  const agingBadge = (s) => s === "Completed" ? "green" : s === "Not Yet Due" ? "blue" : s === "Due Today" ? "amber" : "red";

  return (
    <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
      <div className="pcp-section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span><LayoutDashboard size={15} color="#4e7d63" /> Department Analysis &amp; Transaction Drill-Down</span>
        {anyFilter && <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={clearAll}><X size={13} /> Clear Filters</button>}
      </div>

      <div className="pcp-grid-2" style={{ alignItems: "start" }}>
        {/* ---- Pie chart ---- */}
        <div className="pcp-chart-click" title="Click to filter transactions">
          {deptDist.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={deptDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}
                  cursor="pointer" onClick={(s) => toggleDept(pickName(s))} isAnimationActive={true}>
                  {deptDist.map((entry, i) => {
                    const selected = dept === entry.name;
                    return <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} cursor="pointer"
                      stroke={selected ? "#111827" : "#fff"} strokeWidth={selected ? 2.5 : 1}
                      opacity={dept && !selected ? 0.3 : 1} />;
                  })}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, cursor: "pointer" }} onClick={(e) => toggleDept(e && e.value)} />
                <Tooltip formatter={(v, n) => [peso(v), n]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="pcp-empty">No disbursements match the current filters</div>}
          <div className="pcp-chart-hint">Click a slice (or legend) to filter the table below · click again to clear.</div>
        </div>

        {/* ---- Cross-filters ---- */}
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div className="pcp-rc-field"><label>Department</label>
              <select className="pcp-select" value={dept || "ALL"} onChange={(e) => setDept(e.target.value === "ALL" ? null : e.target.value)}>
                <option value="ALL">All Departments</option>
                {opts.departments.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-rc-field"><label>Company</label>
              <select className="pcp-select" value={fCompany} onChange={(e) => setFCompany(e.target.value)}>
                <option value="ALL">All</option>{opts.companies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-rc-field"><label>Plant</label>
              <select className="pcp-select" value={fPlant} onChange={(e) => setFPlant(e.target.value)}>
                <option value="ALL">All</option>{opts.plants.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
            <div className="pcp-rc-field"><label>Branch</label>
              <select className="pcp-select" value={fBranch} onChange={(e) => setFBranch(e.target.value)}>
                <option value="ALL">All</option>{opts.plants.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
              </select>
            </div>
            <div className="pcp-rc-field"><label>Expense</label>
              <select className="pcp-select" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                <option value="ALL">All</option>{opts.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-rc-field"><label>Liquidation Status</label>
              <select className="pcp-select" value={fLiq} onChange={(e) => setFLiq(e.target.value)}>
                <option value="ALL">All</option>{DEPT_LIQ_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-rc-field"><label>Aging Status</label>
              <select className="pcp-select" value={fAging} onChange={(e) => setFAging(e.target.value)}>
                <option value="ALL">All</option>{AGING_BUCKETS.map((c) => <option key={c} value={c}>{c}</option>)}<option value="Completed">Completed</option>
              </select>
            </div>
            <div className="pcp-rc-field"><label>Date From</label>
              <input type="date" className="pcp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="pcp-rc-field"><label>Date To</label>
              <input type="date" className="pcp-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {/* ---- Summary cards (reflect all active filters) ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
            <div className="pcp-mini-stat"><div className="lbl">Transactions</div><div className="val">{summary.count}</div></div>
            <div className="pcp-mini-stat"><div className="lbl">Amount Released</div><div className="val">{peso(summary.released)}</div></div>
            <div className="pcp-mini-stat"><div className="lbl">Amount Liquidated</div><div className="val">{peso(summary.liquidated)}</div></div>
            <div className="pcp-mini-stat"><div className="lbl">Amount Requested</div><div className="val">{peso(summary.requested)}</div></div>
            <div className="pcp-mini-stat"><div className="lbl">Outstanding</div><div className="val" style={{ color: summary.outstanding > 0 ? "var(--danger)" : "inherit" }}>{peso(summary.outstanding)}</div></div>
          </div>
        </div>
      </div>

      {/* ---- Active filter chip + count ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 8px", flexWrap: "wrap" }}>
        {dept ? (
          <span className="pcp-filter-chip">Department: <b>{dept}</b><button onClick={() => setDept(null)} title="Clear department filter"><X size={12} /></button></span>
        ) : <span style={{ fontSize: 12, color: "var(--text-mut)" }}>Showing all departments</span>}
        <span style={{ fontSize: 12, color: "var(--text-mut)", marginLeft: "auto" }}>{total} matching transaction{total !== 1 ? "s" : ""}</span>
      </div>

      {/* ---- Filtered transaction table ---- */}
      <div className="pcp-table-wrap" style={{ transition: "opacity 0.15s ease" }}>
        <table className="pcp-table">
          <thead>
            <tr>
              <th>Request No.</th><th>Request Date</th><th>Release Date</th><th>Department</th>
              <th>Plant</th><th>Branch</th><th>Company</th><th>Requestor</th><th>Payee</th>
              <th>Purpose</th><th>Expense Category</th>
              <th style={{ textAlign: "right" }}>Amt Requested</th><th style={{ textAlign: "right" }}>Amt Released</th>
              <th style={{ textAlign: "right" }}>Amt Liquidated</th><th style={{ textAlign: "right" }}>Outstanding</th>
              <th style={{ textAlign: "center" }}>Liquidation Status</th><th style={{ textAlign: "center" }}>Aging Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.requestNo}</td>
                <td>{r.dateRequested}</td>
                <td>{r.date}</td>
                <td>{r.department}</td>
                <td>{r.plantLabel}</td>
                <td>{r.branch}</td>
                <td>{r.company}</td>
                <td>{r.requestor}</td>
                <td>{r.payee}</td>
                <td style={{ maxWidth: 220, whiteSpace: "normal" }}>{r.purpose}</td>
                <td>{r.expenseCategory}</td>
                <td className="pcp-num">{peso(r.amountRequested)}</td>
                <td className="pcp-num">{peso(r.amount)}</td>
                <td className="pcp-num">{peso(r.amountLiquidated)}</td>
                <td className="pcp-num" style={{ fontWeight: 700, color: r.remaining > 0 ? "var(--danger)" : "inherit" }}>{peso(r.remaining)}</td>
                <td style={{ textAlign: "center" }}><span className={"pcp-badge pcp-badge-" + liqBadge(r.status)}>{r.status}</span></td>
                <td style={{ textAlign: "center" }}><span className={"pcp-badge pcp-badge-" + agingBadge(r.agingStatus)}>{r.agingStatus}</span></td>
              </tr>
            )) : <tr><td colSpan={17} className="pcp-empty">No transactions match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="pcp-pager">
          <span>Rows:</span>
          <select className="pcp-select" style={{ width: 72 }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {DRILL_PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>{start + 1}–{Math.min(start + pageSize, total)} of {total}</span>
          <button className="pcp-btn pcp-btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
          <span>Page {page + 1} / {pageCount}</span>
          <button className="pcp-btn pcp-btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ---- Date range, KPI groups, trend and plant comparison ------------------
   The date range filters ACTIVITY only — releases (by voucher date),
   liquidated receipts (by receipt date) and requests (by request date) — and
   every chart and drill-down built from them. Balances and the "as of today"
   worklist counts (pending, overdue, …) always read the whole record set: a
   fund's balance on screen must be its balance now, whatever period is shown. */
const DASH_CSS = `
  .pcp-dash-range { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
  .pcp-dash-range .pcp-tab { padding: 6px 12px; }
  .pcp-dash-range-note { font-size: 11.5px; color: var(--text-mut); margin-left: auto; }
  .pcp-dash-group { margin-bottom: 16px; }
  .pcp-dash-group-title {
    display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.8px;
    text-transform: uppercase; color: var(--text-mut); margin: 0 0 8px;
  }
  .pcp-dash-group-title::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .pcp-dash-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .pcp-dash-kpis .pcp-kpi { margin: 0; }
  .pcp-dash-low { color: var(--danger-dark, #c0392b); font-weight: 700; }
  .pcp-dash-bar { height: 6px; border-radius: 99px; background: var(--line); overflow: hidden; margin-top: 4px; min-width: 70px; }
  .pcp-dash-bar > span { display: block; height: 100%; border-radius: 99px; }
  tr.pcp-dash-row-click { cursor: pointer; }
  tr.pcp-dash-row-click:hover td { background: var(--brand-soft); }
  @media (max-width: 640px) { .pcp-dash-range-note { margin-left: 0; width: 100%; } }
`;

const DASH_RANGES = [
  { key: "ALL", label: "All time" },
  { key: "MONTH", label: "This month" },
  { key: "LAST_MONTH", label: "Last month" },
  { key: "QUARTER", label: "This quarter" },
  { key: "YEAR", label: "This year" },
  { key: "CUSTOM", label: "Custom" },
];

/* { from, to } as ISO dates (inclusive), or null for all time. */
function dashRangeBounds(key, from, to) {
  const t = todayISO();
  const y = Number(t.slice(0, 4)), mo = Number(t.slice(5, 7));
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (key === "MONTH") return { from: `${y}-${pad(mo)}-01`, to: `${y}-${pad(mo)}-${pad(lastDay(y, mo))}` };
  if (key === "LAST_MONTH") {
    const ly = mo === 1 ? y - 1 : y, lm = mo === 1 ? 12 : mo - 1;
    return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}` };
  }
  if (key === "QUARTER") {
    const q0 = Math.floor((mo - 1) / 3) * 3 + 1;
    return { from: `${y}-${pad(q0)}-01`, to: `${y}-${pad(q0 + 2)}-${pad(lastDay(y, q0 + 2))}` };
  }
  if (key === "YEAR") return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (key === "CUSTOM" && (from || to)) return { from: from || "0000-01-01", to: to || "9999-12-31" };
  return null;
}

const dashInRange = (date, b) => !b || ((date || "") >= b.from && (date || "") <= b.to);

function dashRangeText(b) {
  if (!b) return "All time";
  const f = b.from === "0000-01-01" ? "the start" : fmtDate(b.from);
  const t = b.to === "9999-12-31" ? "today" : fmtDate(b.to);
  return `${f} – ${t}`;
}

/* Range state + the bounds it resolves to, shared by both dashboards. */
function useDashRange() {
  const [range, setRange] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const bounds = useMemo(() => dashRangeBounds(range, from, to), [range, from, to]);
  return { range, setRange, from, setFrom, to, setTo, bounds };
}

function DashDateFilter({ r }) {
  return (
    <div className="pcp-dash-range">
      <div className="pcp-tabs" style={{ margin: 0 }}>
        {DASH_RANGES.map((x) => (
          <button key={x.key} className={"pcp-tab" + (r.range === x.key ? " active" : "")} onClick={() => r.setRange(x.key)}>{x.label}</button>
        ))}
      </div>
      {r.range === "CUSTOM" && (
        <>
          <input type="date" className="pcp-input" style={{ width: 150 }} value={r.from} max={r.to || undefined} onChange={(e) => r.setFrom(e.target.value)} aria-label="From date" />
          <span style={{ fontSize: 12, color: "var(--text-mut)" }}>to</span>
          <input type="date" className="pcp-input" style={{ width: 150 }} value={r.to} min={r.from || undefined} onChange={(e) => r.setTo(e.target.value)} aria-label="To date" />
        </>
      )}
      <div className="pcp-dash-range-note">
        Activity: <b>{dashRangeText(r.bounds)}</b> · balances and worklists are as of today
      </div>
    </div>
  );
}

function DashKpiGroup({ title, children }) {
  return (
    <div className="pcp-dash-group">
      <div className="pcp-dash-group-title">{title}</div>
      <div className="pcp-dash-kpis">{children}</div>
    </div>
  );
}

/* Records of the period: vouchers released in it, requests filed in it, and
   each liquidation cut down to its receipt lines dated in it. */
function dashPeriodData(requests, disbursements, liquidations, bounds) {
  if (!bounds) return { pReq: requests, pDisb: disbursements, pLines: liquidations.flatMap((l) => l.lines || []) };
  return {
    pReq: requests.filter((r) => dashInRange(r.date, bounds)),
    pDisb: disbursements.filter((d) => dashInRange(d.date, bounds)),
    pLines: liquidations.flatMap((l) => (l.lines || []).filter((ln) => dashInRange(ln.date, bounds))),
  };
}

/* Released vs liquidated per month, over the period. */
function dashMonthlyFlow(pDisb, pLines) {
  const map = new Map();
  const add = (month, key, v) => {
    if (!month) return;
    const row = map.get(month) || { month, disbursed: 0, liquidated: 0 };
    row[key] += Number(v) || 0;
    map.set(month, row);
  };
  pDisb.forEach((d) => add((d.date || "").slice(0, 7), "disbursed", d.amount));
  pLines.forEach((l) => add((l.date || "").slice(0, 7), "liquidated", l.amount));
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function DashTrendChart({ data, onMonth }) {
  if (!data.length) return <div className="pcp-empty">No releases or liquidated receipts in this period</div>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 8, right: 18, top: 4, bottom: 4 }} style={onMonth ? { cursor: "pointer" } : undefined}
        onClick={onMonth ? (e) => e && e.activeLabel && onMonth(e.activeLabel) : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
        <XAxis dataKey="month" fontSize={10.5} stroke="#8fa397" />
        <YAxis tickFormatter={shortPeso} fontSize={10.5} stroke="#8fa397" />
        <Tooltip formatter={(v) => peso(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" name="Released" dataKey="disbursed" stroke="#b9790a" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" name="Liquidated" dataKey="liquidated" stroke="#4e7d63" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* Low balance: below a fifth of the plant's fund, or negative. */
const dashLowBalance = (available, fund) => available < 0 || (fund > 0 && available < fund * 0.2);

/* One row per plant (the plant's whole branch family). Balance and open
   advances are as of today; released / liquidated follow the period. */
function dashPlantRows(funds, requests, disbursements, liquidations, replenishments, bounds) {
  const plants = [];
  const seen = new Set();
  [funds, disbursements].forEach((list) => list.forEach((x) => {
    const p = plantOfBranch(x.branchCode);
    if (p && !seen.has(p)) { seen.add(p); plants.push(p); }
  }));
  const today = todayISO();
  return plants.map((p) => {
    const inP = (x) => plantOfBranch(x.branchCode) === p;
    const f = funds.filter(inP), r = requests.filter(inP), d = disbursements.filter(inP), rp = (replenishments || []).filter(inP);
    const ids = new Set(d.map((x) => x.id));
    const l = liquidations.filter((x) => ids.has(x.disbursementId));
    const m = computeMetrics(f, r, d, l, rp);
    const per = dashPeriodData(r, d, l, bounds);
    const overdue = d.filter((x) => {
      const s = liqStatusFor(x, l);
      return s !== "Fully Liquidated" && s !== "Over-Liquidated" && daysBetween(x.date || today, today) > AGING_DUE_DAYS;
    }).length;
    return {
      code: p, label: plantLabel(p), fund: m.totalFund, available: m.availableBalance, outstanding: m.outstanding,
      open: m.pendingLiquidationCount, overdue, pending: m.pendingRequests,
      released: per.pDisb.reduce((s, x) => s + (Number(x.amount) || 0), 0),
      liquidated: per.pLines.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    };
  }).sort((a, b) => PLANT_CODES.indexOf(a.code) - PLANT_CODES.indexOf(b.code));
}

function PlantComparison({ rows, onOpenPlant }) {
  if (rows.length < 2) return null;
  const tot = rows.reduce((t, r) => ({
    fund: t.fund + r.fund, available: t.available + r.available, outstanding: t.outstanding + r.outstanding,
    open: t.open + r.open, overdue: t.overdue + r.overdue, pending: t.pending + r.pending,
    released: t.released + r.released, liquidated: t.liquidated + r.liquidated,
  }), { fund: 0, available: 0, outstanding: 0, open: 0, overdue: 0, pending: 0, released: 0, liquidated: 0 });
  return (
    <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
      <div className="pcp-section-title"><Building2 size={15} color="#4e7d63" /> Plant Comparison</div>
      <div className="pcp-table-wrap">
        <table className="pcp-table">
          <thead>
            <tr>
              <th>Plant</th><th>Fund</th><th>Available Balance</th><th>Open Advances</th>
              <th>Released (period)</th><th>Liquidated (period)</th><th>Pending Requests</th><th>Unliquidated</th><th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const low = dashLowBalance(r.available, r.fund);
              const pct = r.fund > 0 ? Math.max(0, Math.min(100, (r.available / r.fund) * 100)) : 0;
              return (
                <tr key={r.code} className={onOpenPlant ? "pcp-dash-row-click" : undefined}
                  onClick={onOpenPlant ? () => onOpenPlant(r.code) : undefined} title={onOpenPlant ? `Open the ${r.label} dashboard` : undefined}>
                  <td><strong>{r.label}</strong></td>
                  <td className="pcp-num">{peso(r.fund)}</td>
                  <td className="pcp-num">
                    <span className={low ? "pcp-dash-low" : undefined}>{peso(r.available)}</span>
                    <div className="pcp-dash-bar"><span style={{ width: pct + "%", background: low ? "#c0392b" : "#4e7d63" }} /></div>
                  </td>
                  <td className="pcp-num">{peso(r.outstanding)}</td>
                  <td className="pcp-num">{peso(r.released)}</td>
                  <td className="pcp-num">{peso(r.liquidated)}</td>
                  <td className="pcp-num">{r.pending}</td>
                  <td className="pcp-num">{r.open}</td>
                  <td className="pcp-num" style={{ color: r.overdue ? "#c0392b" : undefined, fontWeight: r.overdue ? 700 : undefined }}>{r.overdue}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 700 }}>
              <td>Total</td>
              <td className="pcp-num">{peso(tot.fund)}</td>
              <td className="pcp-num">{peso(tot.available)}</td>
              <td className="pcp-num">{peso(tot.outstanding)}</td>
              <td className="pcp-num">{peso(tot.released)}</td>
              <td className="pcp-num">{peso(tot.liquidated)}</td>
              <td className="pcp-num">{tot.pending}</td>
              <td className="pcp-num">{tot.open}</td>
              <td className="pcp-num">{tot.overdue}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="pcp-chart-hint">Available balance turns red below 20% of the fund. {onOpenPlant ? "Click a plant to open its dashboard." : ""}</div>
    </div>
  );
}

function Dashboard({ funds, requests, disbursements: allDisb, liquidations, replenishments, onNavigate, onOpenPlant, canEdit }) {
  const [drill, setDrill] = useState(null);
  const openDrill = (chartName, label) => { if (label == null || label === "") return; setDrill({ chartName, label: String(label) }); };
  /* Balances and worklist counts: every record, as of today. */
  const m = useMemo(() => computeMetrics(funds, requests, allDisb, liquidations, replenishments), [funds, requests, allDisb, liquidations, replenishments]);
  const dr = useDashRange();
  const { pReq, pDisb, pLines } = useMemo(() => dashPeriodData(requests, allDisb, liquidations, dr.bounds), [requests, allDisb, liquidations, dr.bounds]);
  /* Charts and drill-downs below read the period's vouchers. */
  const disbursements = pDisb;
  const plantRows = useMemo(
    () => dashPlantRows(funds, requests, allDisb, liquidations, replenishments, dr.bounds),
    [funds, requests, allDisb, liquidations, replenishments, dr.bounds]
  );
  const flow = useMemo(() => dashMonthlyFlow(pDisb, pLines), [pDisb, pLines]);
  const periodReleased = useMemo(() => pDisb.reduce((s, d) => s + (Number(d.amount) || 0), 0), [pDisb]);
  const periodLiquidated = useMemo(() => pLines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [pLines]);

  const byBranch = useMemo(() => groupSum(disbursements, (d) => d.branchCode, (d) => d.amount), [disbursements]);
  const byCompany = useMemo(() => groupSum(disbursements, (d) => companyOfBranch(d.branchCode), (d) => d.amount), [disbursements]);
  const byDept = useMemo(() => groupSum(disbursements, (d) => {
    const s = SUBACCOUNTS.find((x) => x.code === d.department);
    return s ? s.desc || s.code : d.department;
  }, (d) => d.amount), [disbursements]);
  const byCategory = useMemo(() => groupSum(disbursements, (d) => disbExpense(d), (d) => d.amount), [disbursements]);

  const topCategories = useMemo(() => {
    const g = groupSum(pLines, (l) => l.category, (l) => l.amount);
    return g.sort((a, b) => b.value - a.value).slice(0, 6);
  }, [pLines]);

  const liqStatusCounts = useMemo(() => {
    const g = groupSum(disbursements, (d) => liqStatusFor(d, liquidations));
    return g;
  }, [disbursements, liquidations]);

  const recentDisbursements = useMemo(() =>
    [...allDisb].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5),
    [allDisb]);

  const recentLiquidations = useMemo(() =>
    [...liquidations].sort((a, b) => (b.createdDate || "").localeCompare(a.createdDate || "")).slice(0, 5),
    [liquidations]);

  /* ---- Policy / approval widgets ---- */
  const receiptStats = useMemo(() => {
    let pending = 0, forRevision = 0;
    liquidations.forEach((l) => {
      const s = receiptApprovalSummary(l);
      pending += s.pending;
      if (s.anyRejected) forRevision++;
    });
    return { pending, forRevision };
  }, [liquidations]);

  /* Worklist counts below are as of today, over every voucher. */
  const overdueLiquidations = useMemo(() => allDisb.filter((d) => {
    if (liqStatusFor(d, liquidations) === "Fully Liquidated") return false;
    const ageDays = Math.floor((Date.now() - new Date((d.date || todayISO()) + "T00:00:00").getTime()) / 86400000);
    return ageDays > 5; // liquidation due within 5 calendar days
  }).length, [allDisb, liquidations]);

  /* Cash still owed past the settlement due date (see settlementInfo). */
  const overdueSettlements = useMemo(() => {
    let count = 0, amount = 0;
    allDisb.forEach((d) => {
      const info = settlementInfo(d, liquidationFor(d.id, liquidations));
      if (info.overdue) { count++; amount += info.st.remaining; }
    });
    return { count, amount };
  }, [allDisb, liquidations]);

  /* Vouchers released in the period that are now fully liquidated. */
  const completedLiquidations = useMemo(() =>
    disbursements.filter((d) => liqStatusFor(d, liquidations) === "Fully Liquidated").length,
    [disbursements, liquidations]);

  /* Records behind the currently opened chart data point — computed lazily
     (only when a drill is open) so the dashboard itself never re-renders the
     full transaction list. */
  const drillData = useMemo(() => {
    if (!drill) return null;
    const { chartName, label } = drill;
    const enrich = (d) => enrichDisbursement(d, requests, liquidations);
    if (chartName === "Liquidation Status")
      return { columns: DRILL_COLS_LIQSTATUS, records: disbursements.filter((d) => liqStatusFor(d, liquidations) === label).map(enrich) };
    if (chartName === "Disbursements by Branch")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => d.branchCode === label).map(enrich) };
    if (chartName === "Disbursements by Company")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => companyOfBranch(d.branchCode) === label).map(enrich) };
    if (chartName === "Disbursements by Department")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => deptDesc(d.department) === label).map(enrich) };
    if (chartName === "Disbursements by Expense")
      return { columns: DRILL_COLS_DISB, records: disbursements.filter((d) => (disbExpense(d) || "Unassigned") === label).map(enrich) };
    if (chartName === "Top Expense Categories (Liquidated)" || chartName === "Monthly Expense Trend") {
      /* Receipt lines are dated on their own, so walk every voucher and keep
         the lines inside the period (same rule as the charts). */
      const recs = [];
      allDisb.forEach((d) => {
        const liq = liquidationFor(d.id, liquidations);
        if (!liq || !liq.lines) return;
        const req = requests.find((r) => r.id === d.requestId);
        liq.lines.forEach((line) => {
          if (!dashInRange(line.date, dr.bounds)) return;
          if (chartName === "Top Expense Categories (Liquidated)" && line.category !== label) return;
          if (chartName === "Monthly Expense Trend" && (line.date || "").slice(0, 7) !== label) return;
          recs.push(enrichLine(line, d, liq, req));
        });
      });
      return { columns: DRILL_COLS_EXPLIQ, records: recs };
    }
    return null;
  }, [drill, disbursements, allDisb, requests, liquidations, dr.bounds]);

  const nav = (key) => (onNavigate ? () => onNavigate(key) : undefined);
  const lowBal = dashLowBalance(m.availableBalance, m.totalFund);

  return (
    <div>
      <style>{DASH_CSS}</style>
      <div className="pcp-flow">
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Total Fund (Beginning Balance)</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("disbursements")}>
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("liquidation")}>
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Available Balance</div>
          <div className="pcp-flow-value pcp-num" style={{ color: m.availableBalance < 0 ? "#ff8080" : "#8fffb0" }}>
            {peso(m.availableBalance)}
          </div>
        </div>
      </div>

      <DashDateFilter r={dr} />

      <DashKpiGroup title="Fund position · as of today">
        <KpiCard label="Current Petty Cash Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={lowBal ? "#c0392b" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : lowBal ? "Below 20% of the fund — replenish soon" : "Cash on hand across custodians"}
          onClick={nav("masterdata")} />
        <KpiCard label="Open Advances" value={peso(m.outstanding)} icon={ArrowUpRight} tint="#b9790a" foot="Released, not yet liquidated" onClick={nav("liquidation")} />
        <KpiCard label="Active Petty Cash Funds" value={funds.length + " Funds"} icon={PiggyBank} tint="#7c3aed" foot={peso(m.totalFund) + " total fund"} onClick={nav("masterdata")} />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#15803d" onClick={nav("history")} />
      </DashKpiGroup>

      <DashKpiGroup title={"Activity · " + dashRangeText(dr.bounds)}>
        <KpiCard label="Cash Released" value={peso(periodReleased)} icon={ArrowUpRight} tint="#b9790a" foot={`${pDisb.length} voucher(s)`} onClick={nav("disbursements")} />
        <KpiCard label="Expenses Liquidated" value={peso(periodLiquidated)} icon={TrendingUp} tint="#4e7d63" foot={`${pLines.length} receipt line(s)`} onClick={nav("history")} />
        <KpiCard label="Requests Filed" value={pReq.length} icon={ClipboardList} tint="#2054a3" foot={peso(pReq.reduce((s, r) => s + (Number(r.amount) || 0), 0)) + " requested"} onClick={nav("requests")} />
        <KpiCard label="Completed Liquidations" value={completedLiquidations} icon={Check} tint="#15803d" foot="Released in the period, fully liquidated" onClick={nav("liquidation")} />
      </DashKpiGroup>

      <DashKpiGroup title="Requests & release · as of today">
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval" onClick={nav("requests")} />
        <KpiCard label="Approved Requests" value={m.approvedRequests} icon={Check} tint="#2054a3" foot="Ready for release" onClick={nav("requests")} />
        <KpiCard label="Pending Replenishments" value={m.pendingReplenishments} icon={RefreshCw} tint="#b9790a" foot="Awaiting completion" onClick={nav("replenishment")} />
      </DashKpiGroup>

      <DashKpiGroup title="Liquidation · as of today">
        <KpiCard label="Pending Liquidations" value={m.pendingLiquidationCount} icon={FileSpreadsheet} tint="#2054a3" foot="Vouchers not fully liquidated" onClick={nav("liquidation")} />
        <KpiCard label="Receipts Waiting for Custodian Approval" value={receiptStats.pending} icon={Receipt} tint="#c0392b" foot="Pending receipt approvals" onClick={nav("liquidation")} />
        <KpiCard label="Liquidations For Revision" value={receiptStats.forRevision} icon={AlertTriangle} tint="#c0392b" foot="Rejected receipt(s) — needs correction" onClick={nav("liquidation")} />
        <KpiCard label="Overdue Liquidations" value={overdueLiquidations} icon={AlertTriangle} tint={overdueLiquidations ? "#c0392b" : "#15803d"} foot="Past 5-day liquidation deadline" onClick={nav("aging")} />
        <KpiCard label="Overdue Cash Settlements" value={overdueSettlements.count} icon={CircleDollarSign}
          tint={overdueSettlements.count ? "#c0392b" : "#15803d"}
          foot={overdueSettlements.count ? `${peso(overdueSettlements.amount)} still to be returned / reimbursed` : "No overdue cash returns or reimbursements"}
          onClick={nav("aging")} />
      </DashKpiGroup>

      <PlantComparison rows={plantRows} onOpenPlant={onOpenPlant} />

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title"><TrendingUp size={15} color="#4e7d63" /> Released vs Liquidated by Month</div>
          <DashTrendChart data={flow} onMonth={(month) => openDrill("Monthly Expense Trend", month)} />
          <div className="pcp-chart-hint">Click a month to view its liquidated receipts.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title"><FileSpreadsheet size={15} color="#4e7d63" /> Liquidation Status</div>
          {liqStatusCounts.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={liqStatusCounts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}
                  cursor="pointer" onClick={(s) => openDrill("Liquidation Status", pickName(s))}>
                  {liqStatusCounts.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} cursor="pointer" />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, cursor: "pointer" }} onClick={(e) => openDrill("Liquidation Status", e && e.value)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e5ea" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="pcp-empty">No vouchers yet</div>}
          <div className="pcp-chart-hint">Click a slice or legend to view transactions.</div>
        </div>
      </div>

      <div className="pcp-grid-3" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Branch</div>
          <MiniBarChart data={byBranch} onSelect={(name) => openDrill("Disbursements by Branch", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Company</div>
          <MiniBarChart data={byCompany} onSelect={(name) => openDrill("Disbursements by Company", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Department</div>
          <MiniBarChart data={byDept} onSelect={(name) => openDrill("Disbursements by Department", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
      </div>

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Top Expense Categories (Liquidated)</div>
          <MiniBarChart data={topCategories} onSelect={(name) => openDrill("Top Expense Categories (Liquidated)", name)} />
          <div className="pcp-chart-hint">Click a bar to view liquidated receipts.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title">Disbursements by Expense</div>
          <MiniBarChart data={byCategory} onSelect={(name) => openDrill("Disbursements by Expense", name)} />
          <div className="pcp-chart-hint">Click a bar to view its transactions.</div>
        </div>
      </div>

      <DeptDrilldownPanel funds={funds} requests={requests} disbursements={disbursements} liquidations={liquidations} />
      {/* Below: the most recent records whatever the period. */}

      <div className="pcp-grid-2">
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Recent Transactions</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Voucher</th><th>Employee</th><th>Branch</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {recentDisbursements.length ? recentDisbursements.map((d) => (
                  <tr key={d.id}>
                    <td>{d.voucherNo}</td>
                    <td>{d.employee}</td>
                    <td>{d.branchCode}</td>
                    <td className="pcp-num">{peso(d.amount)}</td>
                    <td><Badge status={liqStatusFor(d, liquidations)} /></td>
                  </tr>
                )) : <tr><td colSpan={5} className="pcp-empty">No disbursements recorded</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Recent Liquidations</div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead><tr><th>Voucher</th><th>Date</th><th>Liquidated</th><th>Remaining</th></tr></thead>
              <tbody>
                {recentLiquidations.length ? recentLiquidations.map((l) => {
                  const disb = allDisb.find((d) => d.id === l.disbursementId);
                  const total = liquidatedTotal(l);
                  const remaining = disb ? disb.amount - total : 0;
                  return (
                    <tr key={l.id}>
                      <td>{disb ? disb.voucherNo : "—"}</td>
                      <td>{fmtDate(l.createdDate)}</td>
                      <td className="pcp-num">{peso(total)}</td>
                      <td className="pcp-num" style={{ color: remaining < 0 ? "#c0392b" : "inherit" }}>{peso(remaining)}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={4} className="pcp-empty">No liquidations recorded</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {drill && drillData && (
        <DrillDownModal
          chartName={drill.chartName} label={drill.label}
          columns={drillData.columns} records={drillData.records}
          canEdit={canEdit}
          onEditRecord={() => { setDrill(null); onNavigate && onNavigate("disbursements"); }}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

/* Single-branch dashboard (Manila / Warner / Disney) — same KPI set as the
   consolidated view, scoped to one branch's funds, requests, disbursements
   and liquidations. */
/* `branchCodes` is the plant's whole family (Disney = D1..D9 + ST), so the
   per-plant dashboard counts every record that settles against this plant's
   fund. Filtering on the single plant code used to drop the sub-branches. */
function BranchDashboard({ label, branchCode, branchCodes, funds, requests, disbursements, liquidations, replenishments, onNavigate }) {
  const codes = useMemo(
    () => ((branchCodes && branchCodes.length) ? branchCodes : [branchCode]),
    [branchCodes, branchCode]
  );
  const inBranch = useCallback((code) => codes.indexOf(code) >= 0, [codes]);
  const fundsForBranch = useMemo(() => funds.filter((f) => inBranch(f.branchCode)), [funds, inBranch]);
  const requestsForBranch = useMemo(() => requests.filter((r) => inBranch(r.branchCode)), [requests, inBranch]);
  const disbForBranch = useMemo(() => disbursements.filter((d) => inBranch(d.branchCode)), [disbursements, inBranch]);
  const repForBranch = useMemo(() => (replenishments || []).filter((r) => inBranch(r.branchCode)), [replenishments, inBranch]);
  const liqForBranch = useMemo(() => {
    const disbIds = new Set(disbForBranch.map((d) => d.id));
    return liquidations.filter((l) => disbIds.has(l.disbursementId));
  }, [liquidations, disbForBranch]);

  const m = useMemo(
    () => computeMetrics(fundsForBranch, requestsForBranch, disbForBranch, liqForBranch, repForBranch),
    [fundsForBranch, requestsForBranch, disbForBranch, liqForBranch, repForBranch]
  );

  const custodians = fundsForBranch.map((f) => f.custodian).filter(Boolean).join(", ");
  const recentDisbursements = useMemo(() =>
    [...disbForBranch].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5),
    [disbForBranch]);

  /* Same split as the consolidated view: balances and worklists as of
     today, activity and the trend for the chosen period. */
  const dr = useDashRange();
  const { pReq, pDisb, pLines } = useMemo(
    () => dashPeriodData(requestsForBranch, disbForBranch, liqForBranch, dr.bounds),
    [requestsForBranch, disbForBranch, liqForBranch, dr.bounds]
  );
  const flow = useMemo(() => dashMonthlyFlow(pDisb, pLines), [pDisb, pLines]);
  const byExpense = useMemo(() => groupSum(pLines, (l) => l.category, (l) => l.amount).sort((a, b) => b.value - a.value).slice(0, 6), [pLines]);
  const overdue = useMemo(() => {
    const today = todayISO();
    return disbForBranch.filter((d) => {
      const s = liqStatusFor(d, liqForBranch);
      return s !== "Fully Liquidated" && s !== "Over-Liquidated" && daysBetween(d.date || today, today) > AGING_DUE_DAYS;
    }).length;
  }, [disbForBranch, liqForBranch]);
  const lowBal = dashLowBalance(m.availableBalance, m.totalFund);
  const nav = (key) => (onNavigate ? () => onNavigate(key) : undefined);

  return (
    <div>
      <style>{DASH_CSS}</style>
      <div className="pcp-flow">
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Beginning Balance</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("disbursements")}>
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("liquidation")}>
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={() => onNavigate && onNavigate("masterdata")}>
          <div className="pcp-flow-label">Available Balance</div>
          <div className="pcp-flow-value pcp-num" style={{ color: m.availableBalance < 0 ? "#ff8080" : "#8fffb0" }}>
            {peso(m.availableBalance)}
          </div>
        </div>
      </div>

      {(fundsForBranch.length > 0 || custodians) && (
        <div className="pcp-eyebrow" style={{ marginBottom: 10 }}>
          {branchCode} · {companyOfBranch(branchCode)}{custodians ? ` · Custodian: ${custodians}` : ""}
        </div>
      )}

      <DashDateFilter r={dr} />

      <DashKpiGroup title="Fund position · as of today">
        <KpiCard label="Available Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={lowBal ? "#c0392b" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : lowBal ? "Below 20% of the fund — replenish soon" : "Cash on hand"}
          onClick={nav("masterdata")} />
        <KpiCard label="Beginning Balance" value={peso(m.totalFund)} icon={Banknote} tint="#2054a3" onClick={nav("masterdata")} />
        <KpiCard label="Open Advances" value={peso(m.outstanding)} icon={ArrowUpRight} tint="#b9790a" foot="Released, not yet liquidated" onClick={nav("liquidation")} />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#7c3aed" onClick={nav("history")} />
      </DashKpiGroup>

      <DashKpiGroup title={"Activity · " + dashRangeText(dr.bounds)}>
        <KpiCard label="Cash Released" value={peso(pDisb.reduce((s, d) => s + (Number(d.amount) || 0), 0))} icon={ArrowUpRight} tint="#b9790a" foot={`${pDisb.length} voucher(s)`} onClick={nav("disbursements")} />
        <KpiCard label="Expenses Liquidated" value={peso(pLines.reduce((s, l) => s + (Number(l.amount) || 0), 0))} icon={ArrowDownRight} tint="#15803d" foot={`${pLines.length} receipt line(s)`} onClick={nav("liquidation")} />
        <KpiCard label="Requests Filed" value={pReq.length} icon={ClipboardList} tint="#2054a3" foot={peso(pReq.reduce((s, r) => s + (Number(r.amount) || 0), 0)) + " requested"} onClick={nav("requests")} />
        <KpiCard label="Completed & Billed" value={pDisb.filter((d) => d.billed).length} icon={Check} tint="#15803d" foot="Exported to Acumatica" onClick={nav("disbursements")} />
      </DashKpiGroup>

      <DashKpiGroup title="Worklist · as of today">
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval" onClick={nav("requests")} />
        <KpiCard label="Approved Requests" value={m.approvedRequests} icon={Check} tint="#2054a3" foot="Ready for release" onClick={nav("requests")} />
        <KpiCard label="Pending Liquidation" value={m.pendingLiquidationCount} icon={FileSpreadsheet} tint="#2054a3" foot="Vouchers not fully liquidated" onClick={nav("liquidation")} />
        <KpiCard label="Overdue Liquidations" value={overdue} icon={AlertTriangle} tint={overdue ? "#c0392b" : "#15803d"} foot={`Past ${AGING_DUE_DAYS}-day liquidation deadline`} onClick={nav("liquidation")} />
      </DashKpiGroup>

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title"><TrendingUp size={15} color="#4e7d63" /> Released vs Liquidated by Month</div>
          <DashTrendChart data={flow} />
        </div>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title">Top Expense Categories (Liquidated)</div>
          <MiniBarChart data={byExpense} />
        </div>
      </div>

      <div className="pcp-card pcp-card-pad">
        <div className="pcp-section-title">Recent Transactions — {label}</div>
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead><tr><th>Voucher</th><th>Employee</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {recentDisbursements.length ? recentDisbursements.map((d) => (
                <tr key={d.id}>
                  <td>{d.voucherNo}</td>
                  <td>{d.employee}</td>
                  <td className="pcp-num">{peso(d.amount)}</td>
                  <td><Badge status={liqStatusFor(d, liqForBranch)} /></td>
                </tr>
              )) : <tr><td colSpan={4} className="pcp-empty">No disbursements recorded for {label}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
