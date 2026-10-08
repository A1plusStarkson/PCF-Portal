/* ============================= DASHBOARD ============================= */

const CHART_COLORS = ["#3c6e76", "#5b8db8", "#c2a15a", "#88bdbc", "#8e7cc3", "#3f9c8f", "#d08a5a", "#8a978f"];

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
        <Bar dataKey="value" fill="#3c6e76" radius={[4, 4, 4, 4]} maxBarSize={22}
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
        <span><LayoutDashboard size={15} color="#3c6e76" /> Department Analysis &amp; Transaction Drill-Down</span>
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

/* ---- Analytics: date range, trend and plant comparison -------------------
   The date range filters ACTIVITY only — releases (by voucher date),
   liquidated receipts (by receipt date) and requests (by request date) — and
   every chart and drill-down built from them. Balances and the "as of today"
   worklist counts (pending, overdue, …) always read the whole record set: a
   fund's balance on screen must be its balance now, whatever period is shown. */
const DASH_CSS = `
  .pcp-dash-range { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
  .pcp-dash-range .pcp-tab { padding: 6px 12px; }
  .pcp-dash-range-note { font-size: 11.5px; color: var(--text-mut); margin-left: auto; }
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
        <Line type="monotone" name="Liquidated" dataKey="liquidated" stroke="#3c6e76" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
      <div className="pcp-section-title"><Building2 size={15} color="#3c6e76" /> Plant Comparison</div>
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
                    <div className="pcp-dash-bar"><span style={{ width: pct + "%", background: low ? "#c0392b" : "#3c6e76" }} /></div>
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

/* ---- Dashboard drill-through banner ----
   Shown at the top of Requests / Liquidation when they were opened from a
   dashboard count (openFiltered in 19-app.jsx): names what is listed and
   clears back to the module's normal view. Inline styles, because the
   dashboard's stylesheet is not on those pages. */
function DashFilterBanner({ filter, shown, onClear, noun }) {
  if (!filter) return null;
  const total = filter.ids.size;
  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px",
      borderRadius: 10, border: "1px solid var(--brand)", background: "var(--brand-soft)", fontSize: 12.5,
    }}>
      <FilterIcon size={14} color="var(--brand)" />
      <span>
        From the Dashboard: <b>{filter.label}</b> · showing {shown} {noun}{shown === 1 ? "" : "s"}
        {shown < total ? ` (${total - shown} more are in another plant's tab or hidden by the search)` : ""}
      </span>
      {onClear && (
        <button className="pcp-btn pcp-btn-sm" style={{ marginLeft: "auto" }} onClick={onClear}>
          <X size={12} /> Clear filter
        </button>
      )}
    </div>
  );
}

const DASH_CORE_CSS = `
  .pcp-dash-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .pcp-dash-head label { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-mut); }
  .pcp-dash-kpi-foot-mix { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 4px; font-size: 11px; }
  .pcp-dash-kpi-foot-mix button { background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  .pcp-dash-kpi-foot-mix button:hover { text-decoration: underline; }
  .pcp-dash-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .pcp-dash-action-table td { vertical-align: middle; }
  .pcp-dash-count {
    background: none; border: none; font: inherit; font-size: 16px; font-weight: 800; cursor: pointer; padding: 2px 6px;
    border-radius: 6px; color: inherit; font-variant-numeric: tabular-nums;
  }
  .pcp-dash-count:hover:not(:disabled) { background: var(--brand-soft); text-decoration: underline; }
  .pcp-dash-count:disabled { cursor: default; color: var(--text-mut); font-weight: 600; }
  .pcp-dash-aging-row {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 6px; border: none; border-bottom: 1px solid var(--line);
    background: none; font: inherit; color: inherit; text-align: left; cursor: pointer;
  }
  .pcp-dash-aging-row:last-child { border-bottom: none; }
  .pcp-dash-aging-row:hover:not(:disabled) { background: var(--brand-soft); }
  .pcp-dash-aging-row:disabled { cursor: default; }
  .pcp-dash-aging-n { margin-left: auto; font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
  .pcp-dash-aging-bar { height: 10px; display: flex; border-radius: 99px; overflow: hidden; background: var(--line); margin: 4px 0 10px; }
  .pcp-dash-util-bar { height: 16px; display: flex; border-radius: 99px; overflow: hidden; background: var(--line); margin: 10px 0 8px; }
  .pcp-dash-util-bar > span, .pcp-dash-aging-bar > span { display: block; height: 100%; }
  .pcp-dash-util-row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; }
  .pcp-dash-util-row:last-child { border-bottom: none; }
  .pcp-dash-util-row b { font-variant-numeric: tabular-nums; }
  .pcp-dash-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11px; color: var(--text-mut); margin-bottom: 6px; }
  .pcp-dash-legend span { display: inline-flex; align-items: center; gap: 5px; }
  .pcp-dash-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .pcp-dash-title-row .pcp-section-title { margin: 0; }
  .pcp-dash-section-label {
    display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.8px;
    text-transform: uppercase; color: var(--text-mut); margin: 22px 0 10px;
  }
  .pcp-dash-section-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  @media (max-width: 900px) { .pcp-dash-kpi8 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
  @media (max-width: 520px) { .pcp-dash-kpi8 { grid-template-columns: minmax(0, 1fr) !important; } }
`;

/* Liquidation aging of a voucher not yet fully liquidated, against the
   AGING_DUE_DAYS deadline counted from its release date. */
const DASH_AGING = [
  { key: "within", label: "Within Due Date", short: "Within Due Date", color: "#15803d" },
  { key: "soon", label: "Due Within 1 Day", short: "Due Soon", color: "#d4a017" },
  { key: "late", label: "Overdue 1–4 Days", short: "Overdue 1–4 Days", color: "#ea580c" },
  { key: "late5", label: "Overdue 5+ Days", short: "Overdue 5+ Days", color: "#c0392b" },
];
function dashAgingBucket(d, today) {
  const daysLeft = daysBetween(today, addDaysISO(d.date || today, AGING_DUE_DAYS));
  if (daysLeft >= 2) return "within";
  if (daysLeft >= 0) return "soon";
  if (daysLeft >= -4) return "late";
  return "late5";
}

/* Active Cash Advances — the list behind "Employees w/ Active Advances". */
function ActiveAdvancesModal({ rows, onOpen, onOpenAll, onClose }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => [r.d.employee, r.d.voucherNo, plantLabel(r.d.branchCode)].join(" ").toLowerCase().includes(needle)) : rows;
  const people = new Set(rows.map((r) => String(r.d.employee || "").trim().toLowerCase())).size;
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 980, width: "100%" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Active Cash Advances">
        <div className="pcp-modal-head">
          <h3>Active Cash Advances</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-mut)" }}>
              <b style={{ color: "var(--text)" }}>{people}</b> employee{people === 1 ? "" : "s"} · {rows.length} voucher{rows.length === 1 ? "" : "s"} ·{" "}
              <b style={{ color: "var(--text)" }}>{peso(rows.reduce((s, r) => s + r.balance, 0))}</b> not yet liquidated
            </div>
            <div style={{ position: "relative", marginLeft: "auto", width: 240 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
              <input className="pcp-input" style={{ paddingLeft: 28 }} placeholder="Search employee or voucher" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {onOpenAll && <button className="pcp-btn pcp-btn-sm pcp-btn-primary" onClick={onOpenAll}>Open all in Liquidation</button>}
          </div>
          <div className="pcp-table-wrap" style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="pcp-table">
              <thead>
                <tr><th>Employee</th><th>Voucher</th><th>Plant</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Not Liquidated</th><th>Date Released</th><th>Aging</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shown.length ? shown.map((r) => {
                  const b = DASH_AGING.find((x) => x.key === r.bucket);
                  return (
                    <tr key={r.d.id} className="pcp-dash-row-click" onClick={() => onOpen(r.d)} title={`Open ${r.d.voucherNo} in Liquidation`}>
                      <td><strong>{r.d.employee}</strong></td>
                      <td>{r.d.voucherNo}</td>
                      <td>{plantLabel(r.d.branchCode)}</td>
                      <td className="pcp-num" style={{ textAlign: "right" }}>{peso(r.d.amount)}</td>
                      <td className="pcp-num" style={{ textAlign: "right" }}>{peso(r.balance)}</td>
                      <td>{fmtDate(r.d.date)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="pcp-dash-dot" style={{ background: b.color, marginRight: 6 }} />
                        {r.age} day{r.age === 1 ? "" : "s"}
                      </td>
                      <td><Badge status={r.status} /></td>
                    </tr>
                  );
                }) : <tr><td colSpan={8} className="pcp-empty">No active cash advances</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pcp-chart-hint">Oldest first. Click a row to open that voucher in Liquidation.</div>
        </div>
      </div>
    </div>
  );
}

/* ---- Plant dashboard core ----
   One layout, used by each plant's dashboard and by the consolidated view for
   the chosen location. It answers, in order: how much money is there
   (financial summary + the eight KPI cards), what needs attention (Action
   Required, Liquidation Aging, Fund Utilization), and what happened recently
   (Recent Transactions). Every count opens the records behind it through
   onOpenFiltered(module, records, label) — 19-app.jsx lists exactly those in
   that module. `role` ("custodian" | "accounting" | "admin") only decides
   which Action Required rows appear. */
function DashboardCore({ label, funds, requests, disbursements, liquidations, replenishments, reimbursements, role, multiPlant, onNavigate, onOpenFiltered }) {
  const [showAdvances, setShowAdvances] = useState(false);
  const today = todayISO();
  const m = useMemo(
    () => computeMetrics(funds, requests, disbursements, liquidations, replenishments),
    [funds, requests, disbursements, liquidations, replenishments]
  );
  const nav = (key) => (onNavigate ? () => onNavigate(key) : undefined);
  const open = (module, records, what) => {
    if (!records.length) return;
    if (onOpenFiltered) onOpenFiltered(module, records, what);
    else if (onNavigate) onNavigate(module);
  };

  /* Not fully liquidated — the same rule as the Pending Liquidation card
     (computeMetrics), so the aging buckets always add up to it. */
  const w = useMemo(() => {
    const balance = (d) => Math.max(0, (Number(d.amount) || 0) - liquidatedTotal(liquidationFor(d.id, liquidations)));
    const pending = [];
    const aging = { within: [], soon: [], late: [], late5: [] };
    disbursements.forEach((d) => {
      const status = liqStatusFor(d, liquidations);
      if (status === "Fully Liquidated") return;
      const bucket = dashAgingBucket(d, today);
      const row = { d, status, bucket, balance: balance(d), age: Math.max(0, daysBetween(d.date || today, today)) };
      pending.push(row);
      aging[bucket].push(row);
    });
    pending.sort((a, b) => b.age - a.age);
    const replenished = replenishedLiquidationIds(replenishments);
    const stage = (s) => disbursements.filter((d) => {
      const l = liquidationFor(d.id, liquidations);
      return l && liqApprovalStage(d, l, replenished) === s;
    });
    const missingDocs = disbursements.filter((d) => {
      const l = liquidationFor(d.id, liquidations);
      return l && (l.lines || []).some((ln) => Number(ln.amount) > 0) && !(l.attachments || []).length;
    });
    const settleOverdue = disbursements.filter((d) => settlementInfo(d, liquidationFor(d.id, liquidations)).overdue);
    const notExported = disbursements.filter((d) => {
      const l = liquidationFor(d.id, liquidations);
      const s = l ? liqApprovalStage(d, l, replenished) : null;
      return !d.billed && (s === LIQ_STAGE.READY || s === LIQ_STAGE.REPLENISHED);
    });
    return {
      pending, aging, balance,
      forCheck: stage(LIQ_STAGE.FOR_CHECK), forAcct: stage(LIQ_STAGE.FOR_ACCOUNTING),
      correction: stage(LIQ_STAGE.NEEDS_CORRECTION), missingDocs, settleOverdue, notExported,
    };
  }, [disbursements, liquidations, replenishments, today]);

  const pendingReq = useMemo(() => requests.filter((r) => r.status === "Pending"), [requests]);
  const approvedReq = useMemo(() => requests.filter((r) => r.status === "Approved"), [requests]);
  const billed = useMemo(() => disbursements.filter((d) => d.billed), [disbursements]);
  const reimbAcct = useMemo(() => (reimbursements || []).filter((r) => reimbAwaitingAccounting(r)), [reimbursements]);
  const readyRepl = useMemo(
    () => replenishmentReadyItems(disbursements, liquidations, reimbursements || [], replenishments),
    [disbursements, liquidations, reimbursements, replenishments]
  );
  const openRepl = useMemo(() => (replenishments || []).filter((r) => r.status !== "Completed" && r.status !== "Reverted"), [replenishments]);

  const amt = (xs, f) => xs.reduce((s, x) => s + (Number(f ? f(x) : x.amount) || 0), 0);
  const rowsOf = (xs) => xs.map((x) => x.d);
  const overdue = w.aging.late.concat(w.aging.late5);
  const isAdmin = role === "admin";
  const isAcct = role === "accounting" || isAdmin;
  const isCust = role === "custodian" || isAdmin;

  /* Action Required rows. `records` drive the drill-through; rows without
     records (reimbursements, replenishments) open their module instead. */
  const actions = [
    { key: "overdue", color: "#c0392b", label: "Overdue Liquidations", sub: `Past the ${AGING_DUE_DAYS}-day deadline`, n: overdue.length,
      amount: amt(overdue, (r) => r.balance), records: rowsOf(overdue), module: "liquidation", verb: "View" },
    { key: "soon", color: "#d4a017", label: "Due Soon", sub: "Due today or tomorrow", n: w.aging.soon.length,
      amount: amt(w.aging.soon, (r) => r.balance), records: rowsOf(w.aging.soon), module: "liquidation", verb: "View" },
    { key: "req", color: "#ea580c", label: "Pending Requests", sub: "Awaiting approval", n: pendingReq.length,
      amount: amt(pendingReq), records: pendingReq, module: "requests", verb: "Review" },
    isCust && { key: "release", color: "#2054a3", label: "Approved — For Release", sub: "Approved, cash not yet released", n: approvedReq.length,
      amount: amt(approvedReq), records: approvedReq, module: "requests", verb: "Release" },
    isCust && { key: "check", color: "#2f64a6", label: "Pending Custodian Review", sub: "Liquidations submitted to the custodian", n: w.forCheck.length,
      amount: amt(w.forCheck), records: w.forCheck, module: "liquidation", verb: "Review" },
    isAcct && { key: "acct", color: "#2f64a6", label: "For Accounting Check", sub: "Custodian-reviewed liquidations", n: w.forAcct.length,
      amount: amt(w.forAcct), records: w.forAcct, module: "liquidation", verb: "Review" },
    isAcct && { key: "reimb", color: "#3f9c8f", label: "Reimbursements for Accounting Check", sub: "Opens the Liquidation module", n: reimbAcct.length,
      amount: amt(reimbAcct, (r) => reimbTotal(r)), module: "liquidation", verb: "Review" },
    { key: "docs", color: "#7c3aed", label: "Missing Documents", sub: "Expenses entered with no receipt attached", n: w.missingDocs.length,
      amount: null, records: w.missingDocs, module: "liquidation", verb: "View" },
    { key: "fix", color: "#c0392b", label: "Needs Correction", sub: "A receipt was rejected", n: w.correction.length,
      amount: amt(w.correction), records: w.correction, module: "liquidation", verb: "View" },
    { key: "settle", color: "#c0392b", label: "Overdue Cash Settlements", sub: "Change to return / amount to reimburse is past due", n: w.settleOverdue.length,
      amount: null, records: w.settleOverdue, module: "liquidation", verb: "View" },
    isCust && { key: "repl", color: "#6a4fb8", label: "Ready for Replenishment", sub: "Fully approved, not yet replenished", n: readyRepl.length,
      amount: amt(readyRepl), module: "replenishment", verb: "View" },
    isAcct && { key: "replopen", color: "#6a4fb8", label: "Replenishments in Progress", sub: "Awaiting completion", n: openRepl.length,
      amount: amt(openRepl), module: "replenishment", verb: "View" },
    isAcct && { key: "export", color: "#15803d", label: "Not Yet Exported to Acumatica", sub: "Fully approved, not billed", n: w.notExported.length,
      amount: amt(w.notExported), records: w.notExported, module: "liquidation", verb: "View" },
  ].filter(Boolean);
  const runAction = (a) => {
    if (!a.n) return;
    if (a.records) open(a.module, a.records, a.label);
    else if (onNavigate) onNavigate(a.module);
  };
  const needAttention = actions.filter((a) => a.n > 0).length;

  const agingCount = (k) => w.aging[k].length;
  const pendingTotal = w.pending.length;

  /* Fund utilization: the fund splits into cash still out as advances, spent
     cash waiting to be replenished, and what is left. */
  const fund = m.totalFund;
  const outPart = Math.max(0, m.outstanding);
  const spentPart = Math.max(0, fund - m.availableBalance - outPart);
  const pct = (v) => (fund > 0 ? Math.max(0, Math.min(100, (v / fund) * 100)) : 0);
  const availPct = pct(m.availableBalance);
  const low = dashLowBalance(m.availableBalance, fund);

  const recent = useMemo(
    () => [...disbursements].sort((a, b) => (b.date || "").localeCompare(a.date || "") || String(b.voucherNo).localeCompare(String(a.voucherNo))).slice(0, 8),
    [disbursements]
  );

  const custodians = Array.from(new Set(funds.flatMap((f) => String(f.custodian || "").split(",")).map((s) => s.trim()).filter(Boolean))).join(", ");

  return (
    <div>
      <style>{DASH_CSS + DASH_CORE_CSS}</style>

      {/* Financial summary */}
      <div className="pcp-flow">
        <div className="pcp-flow-step pcp-flow-click" onClick={nav("masterdata")}>
          <div className="pcp-flow-label">Beginning Balance</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalFund)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={nav("disbursements")}>
          <div className="pcp-flow-label">Total Disbursed</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalDisbursed)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={nav("liquidation")}>
          <div className="pcp-flow-label">Total Liquidated</div>
          <div className="pcp-flow-value pcp-num">{peso(m.totalLiquidated)}</div>
          <ChevronRight className="pcp-flow-arrow" size={18} />
        </div>
        <div className="pcp-flow-step pcp-flow-click" onClick={nav("masterdata")}>
          <div className="pcp-flow-label">Available Balance</div>
          <div className="pcp-flow-value pcp-num" style={{ color: m.availableBalance < 0 ? "#ff8080" : "#8fffb0" }}>
            {peso(m.availableBalance)}
          </div>
        </div>
      </div>

      {(funds.length > 0 || custodians) && (
        <div className="pcp-eyebrow" style={{ marginBottom: 10 }}>
          {label}{custodians ? ` · Custodian: ${custodians}` : ""}
        </div>
      )}

      {/* The eight KPI cards — every one opens what it counts. */}
      <div className="pcp-kpi-grid pcp-dash-kpi8" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <KpiCard label="Beginning Balance" value={peso(m.totalFund)} icon={Banknote} tint="#2054a3" onClick={nav("masterdata")} />
        <KpiCard label="Total Disbursed" value={peso(m.totalDisbursed)} icon={ArrowUpRight} tint="#b9790a" onClick={nav("disbursements")} />
        <KpiCard label="Total Liquidated" value={peso(m.totalLiquidated)} icon={ArrowDownRight} tint="#15803d" onClick={nav("liquidation")} />
        <KpiCard label="Available Balance" value={peso(m.availableBalance)} icon={CircleDollarSign}
          tint={low ? "#c0392b" : "#15803d"}
          foot={m.availableBalance < 0 ? "Over committed — replenish soon" : low ? "Below 20% of the fund — replenish soon" : "Cash on hand"}
          onClick={nav("masterdata")} />
        <KpiCard label="Completed & Billed" value={m.completedBilled} icon={Check} tint="#15803d" foot="Exported to Acumatica"
          onClick={billed.length ? () => open("liquidation", billed, "Completed & Billed") : nav("disbursements")} />
        <KpiCard label="Pending Requests" value={m.pendingRequests} icon={ClipboardList} tint="#b9790a" foot="Awaiting approval"
          onClick={pendingReq.length ? () => open("requests", pendingReq, "Pending Requests") : nav("requests")} />
        <KpiCard label="Pending Liquidation" value={pendingTotal} icon={FileSpreadsheet} tint="#2054a3"
          onClick={pendingTotal ? () => open("liquidation", rowsOf(w.pending), "Pending Liquidation") : nav("liquidation")}
          foot={
            <>
              Vouchers not fully liquidated
              {pendingTotal > 0 && (
                <span className="pcp-dash-kpi-foot-mix" onClick={(e) => e.stopPropagation()}>
                  {[["Overdue", overdue, "#c0392b"], ["Due Soon", w.aging.soon, "#d4a017"], ["Within Due Date", w.aging.within, "#15803d"]].map(([t, xs, c]) => (
                    <button key={t} type="button" disabled={!xs.length} title={`Open the ${t.toLowerCase()} vouchers`}
                      onClick={() => open("liquidation", rowsOf(xs), "Pending Liquidation — " + t)}>
                      <span className="pcp-dash-dot" style={{ background: c }} /> {t}: <b>{xs.length}</b>
                    </button>
                  ))}
                </span>
              )}
            </>
          } />
        <KpiCard label="Employees w/ Active Advances" value={m.activeEmployeeCount} icon={Users} tint="#7c3aed" foot="Click to see who and how much"
          onClick={() => setShowAdvances(true)} />
      </div>

      {/* Action Required */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
        <div className="pcp-dash-title-row">
          <div className="pcp-section-title"><Bell size={15} color="#c0392b" /> Action Required</div>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-mut)" }}>
            {needAttention ? `${needAttention} item type${needAttention === 1 ? "" : "s"} need attention` : "Nothing needs attention right now"}
          </span>
        </div>
        <div className="pcp-table-wrap">
          <table className="pcp-table pcp-dash-action-table">
            <thead><tr><th>Action</th><th style={{ textAlign: "center" }}>Count</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr></thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.key} style={a.n ? undefined : { opacity: 0.55 }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="pcp-dash-dot" style={{ background: a.color, width: 11, height: 11 }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.label}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{a.sub}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button type="button" className="pcp-dash-count" disabled={!a.n} onClick={() => runAction(a)}
                      style={a.n ? { color: a.color } : undefined} title={a.n ? `Open the ${a.n} record(s)` : undefined}>{a.n}</button>
                  </td>
                  <td className="pcp-num" style={{ textAlign: "right" }}>{a.amount == null || !a.n ? "—" : peso(a.amount)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="pcp-btn pcp-btn-sm" disabled={!a.n} onClick={() => runAction(a)}>{a.verb}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liquidation Aging + Fund Utilization */}
      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title"><CalendarClock size={15} color="#b9790a" /> Liquidation Aging — {label}</div>
          {pendingTotal > 0 && (
            <div className="pcp-dash-aging-bar" aria-hidden="true">
              {DASH_AGING.map((b) => <span key={b.key} style={{ width: (agingCount(b.key) / pendingTotal) * 100 + "%", background: b.color }} />)}
            </div>
          )}
          {DASH_AGING.map((b) => {
            const rows = w.aging[b.key];
            return (
              <button key={b.key} type="button" className="pcp-dash-aging-row" disabled={!rows.length}
                onClick={() => open("liquidation", rowsOf(rows), "Liquidation Aging — " + b.label)}
                title={rows.length ? `Open these ${rows.length} voucher(s) in Liquidation` : undefined}>
                <span className="pcp-dash-dot" style={{ background: b.color, width: 12, height: 12 }} />
                <span>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{b.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-mut)" }}>{peso(amt(rows, (r) => r.balance))} not yet liquidated</div>
                </span>
                <span className="pcp-dash-aging-n" style={{ color: rows.length ? b.color : "var(--text-mut)" }}>{rows.length}</span>
              </button>
            );
          })}
          <div className="pcp-chart-hint">Vouchers not fully liquidated, by days from release ({AGING_DUE_DAYS}-day deadline). Click a row to open them.</div>
        </div>

        <div className="pcp-card pcp-card-pad">
          <div className="pcp-section-title"><PiggyBank size={15} color="#3c6e76" /> PCF Fund Utilization</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-mut)", textTransform: "uppercase", letterSpacing: 0.6 }}>Beginning Fund</div>
              <div style={{ fontSize: 18, fontWeight: 800 }} className="pcp-num">{peso(fund)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-mut)", textTransform: "uppercase", letterSpacing: 0.6 }}>Available</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: low ? "#c0392b" : "#15803d" }} className="pcp-num">{peso(m.availableBalance)}</div>
            </div>
          </div>
          <div className="pcp-dash-util-bar" role="img" aria-label={`${Math.round(availPct)}% of the fund is available`}>
            <span style={{ width: pct(outPart) + "%", background: "#b9790a" }} title={`Open advances ${peso(outPart)}`} />
            <span style={{ width: pct(spentPart) + "%", background: "#8a978f" }} title={`Spent, awaiting replenishment ${peso(spentPart)}`} />
            <span style={{ width: availPct + "%", background: low ? "#c0392b" : "#3c6e76" }} title={`Available ${peso(m.availableBalance)}`} />
          </div>
          <div className="pcp-dash-legend">
            <span><span className="pcp-dash-dot" style={{ background: "#b9790a" }} /> Open advances {Math.round(pct(outPart))}%</span>
            <span><span className="pcp-dash-dot" style={{ background: "#8a978f" }} /> Spent, for replenishment {Math.round(pct(spentPart))}%</span>
            <span><span className="pcp-dash-dot" style={{ background: low ? "#c0392b" : "#3c6e76" }} /> Available {Math.round(availPct)}%</span>
          </div>
          <div className="pcp-dash-util-row"><span>Disbursed</span><b>{peso(m.totalDisbursed)}</b></div>
          <div className="pcp-dash-util-row"><span>Liquidated</span><b>{peso(m.totalLiquidated)}</b></div>
          <div className="pcp-dash-util-row"><span>Replenished</span><b>{peso(m.totalReplenished)}</b></div>
          <div className="pcp-dash-util-row"><span>Open advances (not yet liquidated)</span><b>{peso(m.outstanding)}</b></div>
          {low && <div className="pcp-chart-hint" style={{ color: "#c0392b", fontWeight: 600 }}>Available balance is below 20% of the fund — replenish soon.</div>}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
        <div className="pcp-dash-title-row">
          <div className="pcp-section-title">Recent Transactions — {label}</div>
          {onNavigate && <button className="pcp-btn pcp-btn-sm" style={{ marginLeft: "auto" }} onClick={() => onNavigate("disbursements")}>View All <ChevronRight size={13} /></button>}
        </div>
        <div className="pcp-table-wrap">
          <table className="pcp-table">
            <thead>
              <tr><th>Voucher</th><th>Employee</th><th>Date</th>{multiPlant && <th>Plant</th>}<th style={{ textAlign: "right" }}>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recent.length ? recent.map((d) => (
                <tr key={d.id} className="pcp-dash-row-click" onClick={() => open("liquidation", [d], d.voucherNo)} title={`Open ${d.voucherNo} in Liquidation`}>
                  <td><strong>{d.voucherNo}</strong></td>
                  <td>{d.employee}</td>
                  <td>{fmtDate(d.date)}</td>
                  {multiPlant && <td>{plantLabel(plantOfBranch(d.branchCode))}</td>}
                  <td className="pcp-num" style={{ textAlign: "right" }}>{peso(d.amount)}</td>
                  <td><Badge status={liqStatusFor(d, liquidations)} /></td>
                </tr>
              )) : <tr><td colSpan={multiPlant ? 6 : 5} className="pcp-empty">No disbursements recorded for {label}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showAdvances && (
        <ActiveAdvancesModal
          rows={w.pending}
          onOpen={(d) => { setShowAdvances(false); open("liquidation", [d], d.voucherNo); }}
          onOpenAll={w.pending.length ? () => { setShowAdvances(false); open("liquidation", rowsOf(w.pending), "Active Cash Advances"); } : null}
          onClose={() => setShowAdvances(false)}
        />
      )}
    </div>
  );
}

/* Consolidated dashboard: a PCF Location filter (All or one plant) over the
   same core layout, then an Analytics section — date range, plant
   comparison and the clickable charts. */
function Dashboard({ funds: allFunds, requests: allReq, disbursements: allDisbAll, liquidations: allLiq, replenishments: allRep, reimbursements: allReimb, role, onNavigate, onOpenPlant, onOpenFiltered, canEdit }) {
  const [loc, setLoc] = useState("ALL");
  const locations = useMemo(() => {
    const seen = new Set();
    const out = [];
    [allFunds, allDisbAll].forEach((list) => list.forEach((x) => {
      const p = plantOfBranch(x.branchCode);
      if (p && !seen.has(p)) { seen.add(p); out.push(p); }
    }));
    return out.sort((a, b) => PLANT_CODES.indexOf(a) - PLANT_CODES.indexOf(b));
  }, [allFunds, allDisbAll]);
  const inLoc = useCallback((x) => loc === "ALL" || plantOfBranch(x.branchCode) === loc, [loc]);
  const funds = useMemo(() => allFunds.filter(inLoc), [allFunds, inLoc]);
  const requests = useMemo(() => allReq.filter(inLoc), [allReq, inLoc]);
  const allDisb = useMemo(() => allDisbAll.filter(inLoc), [allDisbAll, inLoc]);
  const liquidations = useMemo(() => {
    const ids = new Set(allDisb.map((d) => d.id));
    return allLiq.filter((l) => ids.has(l.disbursementId));
  }, [allLiq, allDisb]);
  const replenishments = useMemo(() => (allRep || []).filter(inLoc), [allRep, inLoc]);
  const reimbursements = useMemo(() => (allReimb || []).filter(inLoc), [allReimb, inLoc]);
  const locLabel = loc === "ALL" ? "All Plants" : plantLabel(loc);

  const [drill, setDrill] = useState(null);
  const openDrill = (chartName, label) => { if (label == null || label === "") return; setDrill({ chartName, label: String(label) }); };
  const dr = useDashRange();
  const { pDisb, pLines } = useMemo(() => dashPeriodData(requests, allDisb, liquidations, dr.bounds), [requests, allDisb, liquidations, dr.bounds]);
  /* Charts and drill-downs below read the period's vouchers. */
  const disbursements = pDisb;
  const plantRows = useMemo(
    () => dashPlantRows(allFunds, allReq, allDisbAll, allLiq, allRep, dr.bounds),
    [allFunds, allReq, allDisbAll, allLiq, allRep, dr.bounds]
  );
  const flow = useMemo(() => dashMonthlyFlow(pDisb, pLines), [pDisb, pLines]);

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
  const liqStatusCounts = useMemo(() => groupSum(disbursements, (d) => liqStatusFor(d, liquidations)), [disbursements, liquidations]);
  const recentLiquidations = useMemo(() =>
    [...liquidations].sort((a, b) => (b.createdDate || "").localeCompare(a.createdDate || "")).slice(0, 5),
    [liquidations]);

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

  return (
    <div>
      {locations.length > 1 && (
        <div className="pcp-dash-head">
          <label htmlFor="pcp-dash-loc">PCF Location</label>
          <select id="pcp-dash-loc" className="pcp-select" style={{ width: 200 }} value={loc} onChange={(e) => setLoc(e.target.value)}>
            <option value="ALL">All Plants</option>
            {locations.map((p) => <option key={p} value={p}>{plantLabel(p)}</option>)}
          </select>
          {loc !== "ALL" && onOpenPlant && (
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" onClick={() => onOpenPlant(loc)}>Open the {plantLabel(loc)} dashboard <ChevronRight size={13} /></button>
          )}
        </div>
      )}

      <DashboardCore
        label={locLabel} funds={funds} requests={requests} disbursements={allDisb} liquidations={liquidations}
        replenishments={replenishments} reimbursements={reimbursements} role={role} multiPlant={loc === "ALL" && locations.length > 1}
        onNavigate={onNavigate} onOpenFiltered={onOpenFiltered}
      />

      <div className="pcp-dash-section-label">Analytics — {locLabel}</div>
      <DashDateFilter r={dr} />

      {loc === "ALL" && <PlantComparison rows={plantRows} onOpenPlant={onOpenPlant} />}

      <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title"><TrendingUp size={15} color="#3c6e76" /> Released vs Liquidated by Month</div>
          <DashTrendChart data={flow} onMonth={(month) => openDrill("Monthly Expense Trend", month)} />
          <div className="pcp-chart-hint">Click a month to view its liquidated receipts.</div>
        </div>
        <div className="pcp-card pcp-card-pad pcp-chart-click" title="Click to view detailed transactions.">
          <div className="pcp-section-title"><FileSpreadsheet size={15} color="#3c6e76" /> Liquidation Status</div>
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
          ) : <div className="pcp-empty">No vouchers in this period</div>}
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

/* Single-plant dashboard (Manila / Warner / Disney / RG). `branchCodes` is
   the plant's whole family (Disney = D1..D9 + ST), so it counts every record
   that settles against this plant's fund. */
function BranchDashboard({ label, branchCode, branchCodes, funds, requests, disbursements, liquidations, replenishments, reimbursements, role, onNavigate, onOpenFiltered }) {
  const codes = useMemo(
    () => ((branchCodes && branchCodes.length) ? branchCodes : [branchCode]),
    [branchCodes, branchCode]
  );
  const inBranch = useCallback((code) => codes.indexOf(code) >= 0, [codes]);
  const fundsForBranch = useMemo(() => funds.filter((f) => inBranch(f.branchCode)), [funds, inBranch]);
  const requestsForBranch = useMemo(() => requests.filter((r) => inBranch(r.branchCode)), [requests, inBranch]);
  const disbForBranch = useMemo(() => disbursements.filter((d) => inBranch(d.branchCode)), [disbursements, inBranch]);
  const repForBranch = useMemo(() => (replenishments || []).filter((r) => inBranch(r.branchCode)), [replenishments, inBranch]);
  const reimbForBranch = useMemo(() => (reimbursements || []).filter((r) => inBranch(r.branchCode)), [reimbursements, inBranch]);
  const liqForBranch = useMemo(() => {
    const disbIds = new Set(disbForBranch.map((d) => d.id));
    return liquidations.filter((l) => disbIds.has(l.disbursementId));
  }, [liquidations, disbForBranch]);

  return (
    <DashboardCore
      label={label} funds={fundsForBranch} requests={requestsForBranch} disbursements={disbForBranch}
      liquidations={liqForBranch} replenishments={repForBranch} reimbursements={reimbForBranch}
      role={role} onNavigate={onNavigate} onOpenFiltered={onOpenFiltered}
    />
  );
}
