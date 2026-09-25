/* ============================= STYLES ============================= */

const CSS = `
  :root {
    --ink: #12172a;
    --paper: #f3f4f7;
    --card: #ffffff;
    --line: #e3e5ea;
    --text: #1c2130;
    --text-mut: #6b7182;
    --brand: #c8102e;
    --brand-dark: #970c22;
    --amber: #b9790a;
    --green: #15803d;
    --green-bg: #e8f5ec;
    --red-bg: #fbe9e9;
    --amber-bg: #fdf3e0;
    --blue-bg: #eaf1fb;
    --blue: #2054a3;
  }
  * { box-sizing: border-box; }
  .pcp-root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--paper);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .pcp-root * { font-variant-numeric: tabular-nums; }
  .pcp-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

  /* ---- Sidebar ---- */
  .pcp-sidebar {
    width: 232px;
    flex-shrink: 0;
    background: var(--ink);
    color: #cfd3e0;
    display: flex;
    flex-direction: column;
    padding: 18px 14px;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .pcp-brand-row {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 6px 18px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 14px;
  }
  .pcp-brand-mark {
    width: 34px; height: 34px; border-radius: 8px;
    background: linear-gradient(135deg, var(--brand), var(--brand-dark));
    display: flex; align-items: center; justify-content: center;
    color: white; flex-shrink: 0;
  }
  .pcp-brand-title { font-weight: 700; font-size: 14.5px; color: #fff; letter-spacing: 0.2px; }
  .pcp-brand-sub { font-size: 10.5px; color: #8891a8; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; }

  .pcp-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .pcp-nav::-webkit-scrollbar { width: 6px; }
  .pcp-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
  .pcp-nav-group-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    color: #7f889f; padding: 12px 8px 4px 8px; margin-top: 2px;
  }
  .pcp-nav-group:first-child .pcp-nav-group-label { margin-top: 0; }
  .pcp-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 11px 8px 14px; border-radius: 8px; cursor: pointer;
    color: #b7bccd; font-size: 12.5px; font-weight: 500;
    transition: background 0.12s, color 0.12s;
    border: none; background: transparent; text-align: left; width: 100%;
  }
  .pcp-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .pcp-nav-item.active { background: var(--brand); color: #fff; }
  .pcp-nav-item svg { flex-shrink: 0; }

  .pcp-sidebar-foot {
    margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);
  }
  .pcp-logos-strip { display: flex; align-items: center; gap: 12px; padding: 10px 6px; }
  .pcp-logos-strip img { max-height: 40px; max-width: 104px; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.9; }

  /* ---- Main ---- */
  .pcp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .pcp-topbar {
    background: var(--card); border-bottom: 1px solid var(--line);
    padding: 14px 26px; display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 5;
  }
  .pcp-topbar h1 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .pcp-topbar-sub { font-size: 12px; color: var(--text-mut); margin-top: 2px; }
  .pcp-content { padding: 22px 26px 60px 26px; }

  .pcp-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 7px; border: 1px solid var(--line);
    background: #fff; color: var(--text); font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
  }
  .pcp-btn:hover { border-color: #c7cad3; background: #fafafb; }
  .pcp-btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  .pcp-btn-primary:hover { background: var(--brand-dark); border-color: var(--brand-dark); }
  .pcp-btn-ghost { border-color: transparent; background: transparent; }
  .pcp-btn-ghost:hover { background: var(--paper); }
  .pcp-btn-sm { padding: 5px 10px; font-size: 11.5px; }
  .pcp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pcp-btn-danger { color: var(--brand); }

  .pcp-card {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  }
  .pcp-card-pad { padding: 18px 20px; }

  .pcp-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
  .pcp-kpi {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 15px 17px; position: relative; overflow: hidden;
  }
  .pcp-kpi-label { font-size: 11px; color: var(--text-mut); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .pcp-kpi-value { font-size: 21px; font-weight: 700; margin-top: 6px; letter-spacing: -0.3px; }
  .pcp-kpi-icon {
    position: absolute; right: 14px; top: 14px; width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
  }
  .pcp-kpi-foot { font-size: 11px; margin-top: 6px; color: var(--text-mut); }

  .pcp-section-title { font-size: 14px; font-weight: 700; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
  .pcp-eyebrow { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--brand); margin-bottom: 4px; }

  .pcp-grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
  .pcp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  table.pcp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.pcp-table thead th {
    text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-mut); font-weight: 700; padding: 9px 10px; border-bottom: 1px solid var(--line);
    background: #fafbfc; white-space: nowrap;
  }
  table.pcp-table tbody td { padding: 9px 10px; border-bottom: 1px solid #eef0f3; vertical-align: middle; }
  table.pcp-table tbody tr:hover { background: #fafbfd; }
  table.pcp-table tbody tr:last-child td { border-bottom: none; }
  .pcp-table-wrap { overflow-x: auto; }

  .pcp-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px;
    font-size: 10.5px; font-weight: 700; white-space: nowrap; letter-spacing: 0.2px;
  }
  .pcp-badge-green { background: var(--green-bg); color: var(--green); }
  .pcp-badge-amber { background: var(--amber-bg); color: var(--amber); }
  .pcp-badge-red { background: var(--red-bg); color: var(--brand); }
  .pcp-badge-blue { background: var(--blue-bg); color: var(--blue); }
  .pcp-badge-gray { background: #eef0f3; color: var(--text-mut); }

  .pcp-input, .pcp-select, textarea.pcp-input {
    width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px;
    font-size: 12.5px; background: #fff; color: var(--text); font-family: inherit;
  }
  .pcp-input:focus, .pcp-select:focus, textarea.pcp-input:focus { outline: 2px solid var(--brand); outline-offset: 0; border-color: var(--brand); }
  .pcp-field { margin-bottom: 12px; }
  .pcp-field label { display: block; font-size: 11.5px; font-weight: 600; color: var(--text-mut); margin-bottom: 5px; }
  .pcp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .pcp-modal-backdrop {
    position: fixed; inset: 0; background: rgba(15,18,30,0.55); display: flex;
    align-items: flex-start; justify-content: center; z-index: 50; padding: 40px 20px; overflow-y: auto;
  }
  .pcp-modal {
    background: #fff; border-radius: 14px; width: 100%; max-width: 620px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  }
  /* Larger modal the user can resize by dragging <ModalResizeGrip /> in the
     bottom-right corner. Pair with backdropCloseProps() on the backdrop. */
  .pcp-modal.pcp-modal-resizable {
    position: relative; width: min(1000px, 96vw); max-width: 98vw; min-width: min(360px, 96vw);
    max-height: calc(100vh - 40px); min-height: 300px;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .pcp-modal-resizable .pcp-modal-body { flex: 1; min-height: 0; max-height: none; overflow-y: auto; }
  .pcp-modal-grip {
    position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; z-index: 2;
    display: flex; align-items: flex-end; justify-content: flex-end; padding: 0 5px 5px 0;
    cursor: nwse-resize; color: var(--text-mut); touch-action: none;
  }
  .pcp-modal-grip:hover { color: var(--brand); }
  .pcp-modal-head {
    padding: 18px 22px; border-bottom: 1px solid var(--line); display: flex;
    align-items: center; justify-content: space-between;
  }
  .pcp-modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; }
  .pcp-modal-body { padding: 20px 22px; max-height: 65vh; overflow-y: auto; }
  .pcp-modal-foot { padding: 14px 22px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 8px; }

  .pcp-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
  .pcp-tab {
    padding: 9px 14px; font-size: 12.5px; font-weight: 600; color: var(--text-mut);
    cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; border-left:none;border-right:none;border-top:none;
  }
  .pcp-tab.active { color: var(--brand); border-bottom-color: var(--brand); }

  .pcp-empty { text-align: center; padding: 40px 20px; color: var(--text-mut); }
  .pcp-flow {
    display: flex; align-items: stretch; gap: 0; background: var(--ink);
    border-radius: 12px; overflow: hidden; margin-bottom: 18px;
  }
  .pcp-flow-step { flex: 1; padding: 16px 20px; position: relative; color: #fff; }
  .pcp-flow-step + .pcp-flow-step { border-left: 1px solid rgba(255,255,255,0.12); }
  .pcp-flow-click { cursor: pointer; transition: background 0.12s; }
  .pcp-flow-click:hover { background: rgba(255,255,255,0.08); }
  .pcp-flow-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #9098b3; font-weight: 700; }
  .pcp-flow-value { font-size: 19px; font-weight: 700; margin-top: 6px; }
  .pcp-flow-arrow { position: absolute; right: -11px; top: 50%; transform: translateY(-50%); z-index: 2; color: #676f8c; }

  .pcp-liq-line { display: grid; grid-template-columns: 100px 1fr 1.1fr 1fr 0.85fr 100px 32px; gap: 8px; align-items: center; margin-bottom: 8px; }
  .pcp-liq-line-head { display: grid; grid-template-columns: 100px 1fr 1.1fr 1fr 0.85fr 100px 32px; gap: 8px; font-size: 10.5px; text-transform: uppercase; color: var(--text-mut); font-weight: 700; margin-bottom: 8px; letter-spacing: 0.4px;}
  /* Running total for the line editor. The last two tracks match the row grid,
     so the figure sits directly under the Amount inputs. */
  .pcp-liq-line-total { display: grid; grid-template-columns: 1fr 100px 32px; gap: 8px; align-items: center; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--line); }
  .pcp-liq-line-total .lbl { text-align: right; font-size: 11.5px; font-weight: 700; color: var(--text-mut); text-transform: uppercase; letter-spacing: 0.4px; }
  .pcp-liq-line-total .val { font-weight: 700; font-size: 13.5px; }

  .pcp-voucher-card {
    border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; cursor: pointer;
    transition: all 0.12s; margin-bottom: 8px;
  }
  .pcp-voucher-card:hover { border-color: var(--brand); }
  .pcp-voucher-card.active { border-color: var(--brand); background: var(--red-bg); }

  /* ---- Liquidation workspace (Section 25 — maximize screen space) ---- */
  .pcp-liq-full .pcp-content { padding: 14px 18px 48px 18px; }
  table.pcp-table tbody tr.pcp-liq-row { cursor: pointer; }
  /* Replenishment — Ready for Replenishment panel (cut-off chips, selection). */
  .pcp-rr-plant { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
  .pcp-rr-plant-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 9px 12px; background: var(--paper); border-bottom: 1px solid var(--line); }
  table.pcp-table tbody tr.pcp-rr-row { cursor: pointer; }
  table.pcp-table tbody tr.pcp-rr-row.on { background: #fff4f5; }
  .pcp-rr-bar {
    position: sticky; bottom: 10px; z-index: 4; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    margin-top: 6px; padding: 10px 14px; border-radius: 10px; background: var(--ink); color: #fff; font-size: 12.5px;
    box-shadow: 0 8px 24px rgba(15,18,30,0.25);
  }
  /* Cash settlement result banner — tone by direction, red only for problems. */
  .pcp-stl-banner { border: 1px solid var(--line); border-left-width: 4px; border-radius: 8px; padding: 11px 13px; }
  .pcp-stl-banner.tone-amber { background: var(--amber-bg); border-color: #efd49a; border-left-color: var(--amber); }
  .pcp-stl-banner.tone-blue  { background: var(--blue-bg);  border-color: #c4d6f0; border-left-color: var(--blue); }
  .pcp-stl-banner.tone-green { background: var(--green-bg); border-color: #b9dfc5; border-left-color: var(--green); }
  .pcp-stl-banner.tone-red   { background: var(--red-bg);   border-color: #f0bcbc; border-left-color: var(--brand); }
  .pcp-stl-banner.tone-gray  { background: var(--paper);    border-left-color: #9aa0ad; }
  .pcp-stl-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .pcp-stl-head { font-size: 14px; font-weight: 700; }
  .pcp-stl-sub { font-size: 12px; color: var(--text-mut); margin-top: 3px; }
  .pcp-stl-sub strong { color: var(--text); }
  .pcp-stl-check { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
  .pcp-stl-check li { display: flex; align-items: center; gap: 7px; color: var(--text-mut); }
  .pcp-stl-check li.ok { color: var(--green); }
  .pcp-stl-check .box { width: 12px; height: 12px; border: 1.5px solid #9aa0ad; border-radius: 3px; display: inline-block; }
  .pcp-stl-due {
    display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600;
    padding: 3px 9px; border-radius: 99px; background: #fff; border: 1px solid var(--line); color: var(--text-mut); white-space: nowrap;
  }
  .pcp-stl-due.soon { color: var(--amber); border-color: #efd49a; }
  .pcp-stl-due.overdue { color: #fff; background: var(--brand); border-color: var(--brand); }
  .pcp-stl-entry { font-size: 11.5px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 4px 0; border-bottom: 1px dashed #eef0f3; }
  .pcp-stl-entry:last-child { border-bottom: none; }
  /* Liquidation worksheet pop-up: wide and tall by default (still resizable). */
  .pcp-modal.pcp-liq-modal { width: min(1300px, 96vw); height: calc(100vh - 80px); }
  .pcp-liq-modal .pcp-modal-body { background: var(--paper); padding: 14px 16px; }
  .pcp-liq-workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 14px; align-items: start; }
  .pcp-liq-sticky {
    position: sticky; top: 8px; z-index: 5; background: var(--card, #fff);
    border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;
    box-shadow: 0 1px 4px rgba(20,24,40,0.06);
  }
  .pcp-liq-sticky-grid { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: center; }
  .pcp-liq-metric .pcp-kpi-label { font-size: 10px; }
  .pcp-liq-metric .pcp-num { font-size: 14px; font-weight: 700; }
  .pcp-collapse { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
  .pcp-collapse-head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 10px 14px; cursor: pointer; background: var(--paper); font-weight: 700; font-size: 12.5px;
    user-select: none;
  }
  .pcp-collapse-head:hover { background: #eef0f5; }
  .pcp-collapse-body { padding: 12px 14px; }
  @media (max-width: 900px) { .pcp-liq-workspace { grid-template-columns: 1fr; } }

  ::-webkit-scrollbar { width: 9px; height: 9px; }
  ::-webkit-scrollbar-thumb { background: #d3d6de; border-radius: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }

  /* Searchable dropdown — every master-data picker (branch, department,
     expense category, tax category, purpose) shares this one look. */
  .pcp-purpose-wrap, .pcp-ss-wrap { position: relative; }
  .pcp-purpose-btn, .pcp-ss-btn {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    width: 100%; text-align: left; cursor: pointer;
  }
  .pcp-purpose-btn.placeholder, .pcp-ss-btn.placeholder { color: var(--text-mut); }
  .pcp-ss-btn:disabled { background: #f4f6f9; color: var(--text-mut); cursor: not-allowed; }
  .pcp-purpose-pop, .pcp-ss-pop {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 60;
    background: #fff; border: 1px solid var(--line); border-radius: 10px;
    box-shadow: 0 12px 30px rgba(20,20,50,0.16); padding: 8px;
  }
  /* Narrow in-table pickers would clip their own option text, so the popover is
     allowed to grow past the cell it is anchored to. */
  .pcp-ss-pop { min-width: 240px; }
  .pcp-purpose-group, .pcp-ss-group {
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
    color: var(--text-mut); padding: 8px 8px 4px;
  }
  .pcp-purpose-opt, .pcp-ss-opt { font-size: 12.5px; padding: 7px 9px; border-radius: 7px; cursor: pointer; }
  .pcp-purpose-opt:hover, .pcp-ss-opt:hover { background: var(--red-bg); }
  .pcp-purpose-opt.active, .pcp-ss-opt.active { background: var(--brand); color: #fff; }
  .pcp-ss-opt-hint { font-size: 10.5px; color: var(--text-mut); }
  .pcp-ss-opt.active .pcp-ss-opt-hint { color: rgba(255,255,255,0.8); }

  /* Inline document previews (checker / approver read the receipt in place) */
  .pcp-doc-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
  .pcp-doc-tile { border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: #fff; }
  .pcp-doc-tile-head {
    display: flex; align-items: center; gap: 7px; padding: 7px 9px;
    border-bottom: 1px solid var(--line); background: #f8f9fc;
  }
  .pcp-doc-tile-name {
    font-size: 11.5px; font-weight: 600; min-width: 0; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pcp-doc-frame { background: #f4f6f9; display: block; }
  .pcp-doc-frame img { display: block; width: 100%; max-height: 260px; object-fit: contain; }
  .pcp-doc-frame iframe { display: block; width: 100%; height: 260px; border: none; }
  .pcp-doc-frame .pcp-doc-none { padding: 22px 14px; text-align: center; font-size: 11.5px; color: var(--text-mut); }

  /* ---- Notifications & role ---- */
  .pcp-notif-dot {
    position: absolute; top: 1px; right: 1px; min-width: 15px; height: 15px; padding: 0 3px;
    background: var(--brand); color: #fff; border-radius: 99px; font-size: 9px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; line-height: 1;
  }
  .pcp-notif-panel {
    position: absolute; right: 0; top: calc(100% + 8px); width: 340px; background: #fff;
    border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,0.18);
    z-index: 60; overflow: hidden;
  }
  .pcp-notif-head { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
  .pcp-notif-list { max-height: 400px; overflow-y: auto; }
  .pcp-notif-item { display: flex; gap: 10px; padding: 11px 16px; border-bottom: 1px solid #f0f1f4; cursor: pointer; }
  .pcp-notif-item:hover { background: #fafbfd; }
  .pcp-notif-item:last-child { border-bottom: none; }
  .pcp-notif-ic { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pcp-role-badge {
    display: flex; align-items: center; gap: 6px; padding: 7px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.06); border-radius: 8px; color: #cfd3e0; font-size: 11.5px; font-weight: 600;
  }
  .pcp-user-card { padding: 8px 10px; margin: 0 6px 8px 6px; background: rgba(255,255,255,0.06); border-radius: 8px; }
  .pcp-user-name { color: #fff; font-size: 12.5px; font-weight: 700; }
  .pcp-user-card .pcp-role-badge { margin: 4px 0 0 0; }
  .pcp-user-row {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.04); border-radius: 8px;
  }
  .pcp-user-email { flex: 1; min-width: 0; color: #9098b3; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-kpi-click { cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
  .pcp-kpi-click:hover { border-color: var(--brand); box-shadow: 0 4px 14px rgba(200,16,46,0.10); }
  .pcp-kpi-click.active { border-color: var(--brand); box-shadow: inset 0 -3px 0 var(--brand); background: #fff8f9; }

  /* ---- Login ---- */
  .pcp-login-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; min-height: 100vh; }
  .pcp-login-card {
    width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; box-shadow: 0 18px 50px rgba(15,18,30,0.12); overflow: hidden;
  }
  .pcp-login-head { background: var(--ink); color: #fff; padding: 22px 24px; }
  .pcp-login-head .pcp-brand-mark { margin-bottom: 12px; }
  .pcp-login-title { font-size: 16px; font-weight: 700; }
  .pcp-login-sub { font-size: 11.5px; color: #9098b3; margin-top: 3px; }
  .pcp-login-body { padding: 22px 24px; }
  .pcp-login-err { background: var(--red-bg); color: var(--brand); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-ok { background: var(--green-bg); color: var(--green); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-foot { font-size: 11px; color: var(--text-mut); text-align: center; margin-top: 14px; }

  /* ---- Report ---- */
  .pcp-report-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .pcp-report-head img { max-height: 46px; max-width: 130px; object-fit: contain; }
  .pcp-report-title { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; }
  .pcp-report-sub { font-size: 11.5px; color: var(--text-mut); }
  table.pcp-table tfoot td { padding: 9px 10px; border-top: 2px solid var(--line); font-weight: 800; background: #fafbfc; }

  @media (max-width: 980px) {
    .pcp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .pcp-grid-2, .pcp-grid-3 { grid-template-columns: 1fr; }
    .pcp-sidebar { width: 74px; }
    .pcp-brand-title, .pcp-brand-sub, .pcp-nav-item span, .pcp-logos-strip { display: none; }
  }

  /* ---- Report Center (on-screen professional preview) ---- */
  .pcp-rc-filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .pcp-rc-field label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-mut); margin-bottom: 4px; }
  .pcp-doc-scroll { overflow: auto; background: #eceef2; border: 1px solid var(--line); border-radius: 12px; padding: 22px; }
  .pcp-doc {
    background: #fff; margin: 0 auto; box-shadow: 0 6px 24px rgba(15,18,30,0.14);
    padding: 26px 30px; position: relative; font-family: Calibri, Arial, Helvetica, sans-serif; color: #1a1a1a;
  }
  .pcp-doc.portrait { max-width: 794px; }
  .pcp-doc.landscape { max-width: 1123px; }
  .pcp-doc-wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
  .pcp-doc-wm span { font-size: 120px; font-weight: 800; color: rgba(200,16,46,0.07); transform: rotate(-30deg); white-space: nowrap; }
  .pcp-doc-head { display: flex; align-items: center; gap: 14px; padding-bottom: 8px; border-bottom: 2.5px solid #111; position: relative; z-index: 1; }
  .pcp-doc-head img { height: 52px; max-width: 150px; object-fit: contain; }
  .pcp-doc-head-c { flex: 1; text-align: center; }
  .pcp-doc-company { font-size: 16px; font-weight: 800; letter-spacing: 0.3px; }
  .pcp-doc-portal { font-size: 11px; font-weight: 700; color: var(--brand); letter-spacing: 1px; }
  .pcp-doc-title { font-size: 13px; font-weight: 800; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .pcp-doc-ref { min-width: 130px; text-align: right; font-size: 8px; color: #555; line-height: 1.5; }
  .pcp-doc-ref b { color: #111; font-size: 9px; }
  .pcp-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 22px; padding: 9px 2px 4px; font-size: 10px; position: relative; z-index: 1; }
  .pcp-doc-meta b { display: inline-block; min-width: 96px; color: #333; }
  .pcp-doc-count { text-align: right; font-size: 10px; font-weight: 700; color: #1f2d3d; padding-bottom: 8px; }
  table.pcp-doc-table { width: 100%; border-collapse: collapse; position: relative; z-index: 1; }
  table.pcp-doc-table thead th { background: #1f2d3d; color: #fff; font-size: 9.5px; font-weight: 700; padding: 6px 7px; border: 1px solid #1f2d3d; }
  table.pcp-doc-table tbody td { padding: 5px 7px; border: 1px solid #d5d9e0; font-size: 9.5px; vertical-align: top; word-break: break-word; }
  table.pcp-doc-table tbody tr:nth-child(even) td { background: #f4f6f9; }
  .pcp-doc-table .a-right { text-align: right; } .pcp-doc-table .a-center { text-align: center; } .pcp-doc-table .a-left { text-align: left; }
  table.pcp-doc-table tr.grp td { background: #e8edf3; font-weight: 800; font-size: 10px; }
  table.pcp-doc-table tr.sub td { background: #eef1f5; font-weight: 800; }
  table.pcp-doc-table tr.tot td { background: #1f2d3d; color: #fff; font-weight: 800; font-size: 10.5px; border-color: #1f2d3d; }
  table.pcp-doc-table tr.nf td { text-align: center; font-style: italic; color: #666; letter-spacing: 2px; }
  .pcp-doc-foot { border-top: 1.5px solid #111; margin-top: 6px; padding-top: 5px; font-size: 8.5px; color: #444; display: flex; justify-content: space-between; position: relative; z-index: 1; }
  .pcp-doc-sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 34px; position: relative; z-index: 1; }
  .pcp-doc-sign .box { flex: 1; text-align: center; font-size: 9.5px; }
  .pcp-doc-sign .who { color: #333; margin-bottom: 30px; }
  .pcp-doc-sign .line { border-top: 1px solid #111; padding-top: 3px; font-weight: 700; }
  .pcp-doc-sign .role { font-size: 8.5px; color: #555; }

  @media (max-width: 980px) { .pcp-rc-filters { grid-template-columns: repeat(2, 1fr); } }

  /* ---- Clickable charts + drill-down ---- */
  .pcp-chart-click { cursor: pointer; }
  .pcp-chart-hint { font-size: 10.5px; color: var(--text-mut); margin-top: 8px; display: flex; align-items: center; gap: 5px; }
  .pcp-chart-hint svg { opacity: 0.7; }

  .pcp-drill-backdrop {
    position: fixed; inset: 0; background: rgba(15,18,30,0.5); z-index: 60;
    display: flex; justify-content: flex-end; animation: pcpDrillFade 0.18s ease;
  }
  .pcp-drill {
    width: min(1120px, 97vw); height: 100vh; background: var(--paper); overflow-y: auto;
    box-shadow: -14px 0 46px rgba(0,0,0,0.28); display: flex; flex-direction: column;
    animation: pcpDrillIn 0.24s cubic-bezier(.2,.7,.3,1);
  }
  .pcp-drill.closing { animation: pcpDrillOut 0.2s ease forwards; }
  .pcp-drill-backdrop.closing { animation: pcpDrillFadeOut 0.2s ease forwards; }
  @keyframes pcpDrillFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pcpDrillFadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes pcpDrillIn { from { transform: translateX(46px); opacity: 0.3; } to { transform: none; opacity: 1; } }
  @keyframes pcpDrillOut { from { transform: none; opacity: 1; } to { transform: translateX(46px); opacity: 0; } }

  .pcp-drill-head { position: sticky; top: 0; z-index: 3; background: #fff; border-bottom: 1px solid var(--line); padding: 14px 20px; }
  .pcp-breadcrumb { font-size: 11.5px; color: var(--text-mut); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .pcp-breadcrumb .crumb { display: inline-flex; align-items: center; gap: 6px; }
  .pcp-breadcrumb .crumb.link { color: var(--brand); cursor: pointer; font-weight: 600; }
  .pcp-breadcrumb b { color: var(--text); }
  .pcp-drill-title { font-size: 16.5px; font-weight: 700; margin-top: 5px; display: flex; align-items: center; gap: 9px; }
  .pcp-drill-title .pill { font-size: 11px; font-weight: 700; color: #fff; background: var(--brand); border-radius: 99px; padding: 2px 10px; }
  .pcp-drill-body { padding: 16px 20px 48px; }

  .pcp-drill-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  .pcp-drill-search { position: relative; flex: 1; min-width: 220px; }
  .pcp-drill-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-mut); }
  .pcp-drill-search input { width: 100%; padding: 8px 10px 8px 32px; border: 1px solid var(--line); border-radius: 7px; font-size: 12.5px; }
  .pcp-drill-filters { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
  .pcp-drill-filters .pcp-rc-field label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); margin-bottom: 3px; }
  @media (max-width: 980px) { .pcp-drill-filters { grid-template-columns: repeat(2, 1fr); } }

  .pcp-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
  .pcp-sortable:hover { color: var(--brand); }
  .pcp-sort-ind { font-size: 9px; opacity: 0.7; margin-left: 3px; }

  .pcp-detail-card { background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--brand); border-radius: 8px; padding: 14px 16px; margin: 2px 0 6px; }
  .pcp-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 20px; font-size: 12px; }
  .pcp-detail-grid .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); font-weight: 700; }
  @media (max-width: 760px) { .pcp-detail-grid { grid-template-columns: 1fr 1fr; } }
  .pcp-receipts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .pcp-receipt { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; text-decoration: none; color: var(--text); }
  .pcp-receipt img { width: 92px; height: 66px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
  .pcp-receipt .fileicon { width: 92px; height: 66px; border-radius: 6px; border: 1px solid var(--line); background: #f4f6f9; display: flex; align-items: center; justify-content: center; }
  .pcp-receipt span { font-size: 10px; color: var(--text-mut); max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-receipt-link { color: var(--brand); font-weight: 600; cursor: pointer; }

  .pcp-pager { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-top: 14px; font-size: 12px; color: var(--text-mut); }
  .pcp-drill-count { font-size: 12px; color: var(--text-mut); }

  /* ---- PCF Documents ---- */
  .pcp-dropzone { border: 2px dashed #c3c8d4; border-radius: 12px; padding: 26px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; background: #fafbfd; }
  .pcp-dropzone:hover { border-color: var(--brand); }
  .pcp-dropzone.over { border-color: var(--brand); background: var(--red-bg); }
  .pcp-progress { height: 8px; background: #eef0f3; border-radius: 99px; overflow: hidden; }
  .pcp-progress-bar { height: 100%; background: var(--brand); border-radius: 99px; transition: width 0.2s ease; }
  .pcp-hint { font-size: 12px; color: var(--text-mut); background: #f4f6f9; border-radius: 7px; padding: 8px 10px; }
  .pcp-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-mut); font-weight: 600; }
  .pcp-iconbtn { background: none; border: none; padding: 4px; margin: 0 1px; border-radius: 6px; cursor: pointer; color: var(--text-mut); vertical-align: middle; }
  .pcp-iconbtn:hover { background: #eef0f3; color: var(--text); }

  /* ---- Interactive department drill-down ---- */
  .pcp-mini-stat { background: #f4f6f9; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
  .pcp-mini-stat .lbl { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); }
  .pcp-mini-stat .val { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .pcp-filter-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; background: var(--red-bg); color: var(--brand); border: 1px solid #f0c9cf; border-radius: 99px; padding: 4px 6px 4px 12px; font-weight: 600; }
  .pcp-filter-chip button { display: inline-flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; border: none; border-radius: 99px; width: 18px; height: 18px; cursor: pointer; padding: 0; }

  /* ---- Print (management report) ---- */
  @media print {
    .pcp-sidebar, .pcp-topbar, .pcp-tabs, .pcp-no-print { display: none !important; }
    .pcp-root { display: block; }
    .pcp-content { padding: 0 !important; }
    .pcp-card { border: 1px solid #ccc; break-inside: avoid; }
    body, .pcp-root { background: #fff !important; }
    table.pcp-table thead th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/* Modules that get their OWN separate tab per plant (Manila / Warner / Disney /
   RG and Co.). Each plant + module pair is a distinct nav tab so a custodian
   only ever sees the tabs for the plant(s) they are allowed to access. */
const PLANT_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "requests", label: "Petty Cash Requests", icon: ClipboardList },
  { key: "disbursements", label: "Release Ledger", icon: Receipt },
  { key: "liquidation", label: "Liquidation", icon: FileSpreadsheet },
  { key: "reimbursement", label: "Reimbursement", icon: ArrowLeftRight },
  { key: "replenishment", label: "Replenishment", icon: RefreshCw },
  { key: "history", label: "Transaction History", icon: History },
  { key: "report", label: "Reports", icon: FileText },
];
const PLANT_MODULE_KEYS = PLANT_MODULES.map((m) => m.key);

/* System-wide modules that stay as a single shared tab (not per plant). */
const GLOBAL_MODULES = [
  { key: "documents", label: "PCF Documents", icon: FolderOpen },
  { key: "audit", label: "Audit Trail", icon: ShieldCheck },
  { key: "masterdata", label: "Funds & Master Data", icon: Database },
  { key: "users", label: "User Management", icon: UserCog },
  { key: "settings", label: "System Settings", icon: Settings },
];

/* Cross-plant approval workspace. Checking and approval is one person's queue
   across every company, so it is NOT a per-plant tab — see src/23-approvals.jsx. */
const APPROVAL_MODULES = [
  { key: "approvals", label: "Approval Module", icon: ClipboardCheck },
];

/* Consolidated monitoring modules that span every plant in one shared view.
   The Liquidation Aging report lives here so it always covers ALL plants. */
const MONITORING_MODULES = [
  { key: "aging", label: "Liquidation Aging", icon: Clock },
];

/* Encode / decode a plant-scoped tab key, e.g. "A1+::requests". */
const TAB_SEP = "::";
const plantTabKey = (plantCode, moduleKey) => plantCode + TAB_SEP + moduleKey;
const parseTab = (tab) => {
  const i = (tab || "").indexOf(TAB_SEP);
  if (i === -1) return { plant: null, module: tab };
  return { plant: tab.slice(0, i), module: tab.slice(i + TAB_SEP.length) };
};

function Sidebar({ tab, setTab, role, navGroups, userEmail, userName, onSignOut, onChangePassword }) {
  const groups = navGroups || [];
  return (
    <aside className="pcp-sidebar">
      <div className="pcp-brand-row">
        <div className="pcp-brand-mark"><Wallet size={18} /></div>
        <div>
          <div className="pcp-brand-title">Petty Cash System</div>
          <div className="pcp-brand-sub">Imprest Fund System</div>
        </div>
      </div>
      <nav className="pcp-nav">
        {groups.map((group) => (
          <div className="pcp-nav-group" key={group.key}>
            {group.label && <div className="pcp-nav-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.tabKey}
                  className={"pcp-nav-item" + (tab === item.tabKey ? " active" : "")}
                  onClick={() => setTab(item.tabKey)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="pcp-sidebar-foot">
        {(userName || role) && (
          <div className="pcp-user-card" title="Signed-in user">
            {userName && <div className="pcp-user-name">{userName}</div>}
            {role && <div className="pcp-role-badge" style={{ marginTop: 4 }}><UserCog size={13} /> <span>{ROLES[role] ? ROLES[role].label : role}</span></div>}
          </div>
        )}
        {userEmail && (
          <div className="pcp-user-row">
            <span className="pcp-user-email" title={userEmail}>{userEmail}</span>
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#cfd3e0" }} onClick={onSignOut} title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        )}
        {onChangePassword && (
          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#cfd3e0", width: "100%", justifyContent: "flex-start", marginTop: 2 }} onClick={onChangePassword} title="Change your password">
            <KeyRound size={13} /> Change Password
          </button>
        )}
        <div className="pcp-logos-strip">
          <img src={LOGO_A1} alt="A1+ Multinational Packaging, Inc" />
          <img src={LOGO_SPI} alt="Starkson Packaging, Inc." />
        </div>
        <div style={{ fontSize: 10.5, color: "#6b7290", padding: "2px 6px" }}>
          A1+ Multinational Packaging, Inc · Starkson Packaging, Inc.
        </div>
      </div>
    </aside>
  );
}

/* Shared UI context so every tab's TopBar can render the global notification
   bell and role switcher without threading props through each component. */
const AppUI = React.createContext(null);

const NOTIF_ICON = { clip: ClipboardList, check: Check, x: X, alert: AlertTriangle, sheet: FileSpreadsheet, refresh: RefreshCw };

function NotificationBell() {
  const ui = useContext(AppUI);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!ui) return null;
  const notes = ui.notifications || [];
  const count = notes.length;
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="pcp-btn pcp-btn-ghost" style={{ position: "relative", padding: "8px 10px" }} onClick={() => setOpen((o) => !o)} title="Notifications">
        <Bell size={16} />
        {count > 0 && <span className="pcp-notif-dot">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="pcp-notif-panel">
          <div className="pcp-notif-head">
            <strong>Notifications</strong>
            <span style={{ fontSize: 11, color: "var(--text-mut)" }}>{count} active</span>
          </div>
          <div className="pcp-notif-list">
            {notes.length ? notes.map((n) => {
              const Icon = NOTIF_ICON[n.icon] || Bell;
              const tint = n.type === "overdue" || n.type === "rejected" ? "var(--brand)"
                : n.type === "approved" || n.type === "replenished" ? "var(--green)"
                : n.type === "approval" ? "var(--amber)" : "var(--blue)";
              return (
                <div key={n.id} className="pcp-notif-item" onClick={() => { if (ui.onNotifClick) ui.onNotifClick(n); setOpen(false); }}>
                  <div className="pcp-notif-ic" style={{ background: tint + "18", color: tint }}><Icon size={14} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: "#9098b3" }}>{fmtDate(n.date)}</div>
                  </div>
                </div>
              );
            }) : <div className="pcp-empty" style={{ padding: 24 }}>You're all caught up</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ title, sub, right }) {
  return (
    <div className="pcp-topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="pcp-topbar-sub">{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {right}
        <NotificationBell />
      </div>
    </div>
  );
}

function Badge({ status }) {
  const map = {
    Pending: "amber", Approved: "blue", Rejected: "red", Disbursed: "green",
    Open: "blue", Closed: "gray",
    "Not Liquidated": "amber", "Partially Liquidated": "blue",
    "Fully Liquidated": "green", "Over-Liquidated": "red",
    Draft: "gray", Submitted: "amber", Verified: "blue", Completed: "green", Released: "green",
    "For Revision": "red", "Pending Approval": "amber", "Receipts Approved": "green", "No Receipts": "gray",
    /* Two-level liquidation approval stages (LIQ_STAGE in 02-helpers.jsx) */
    "For Custodian Review": "amber", "Needs Correction": "red", "Awaiting Settlement": "amber",
    "For Final Approval": "blue", "Fully Approved / Ready for Replenishment": "green",
    Replenished: "green", "Approved (before two-level review)": "gray",
    "FOR CUSTODIAN REVIEW": "amber", "FOR FINAL APPROVAL": "blue",
    /* Cash-settlement / final liquidation states.
       PARTIALLY SETTLED and OVER-SETTLED exist so a cash variance somebody has
       to chase is never shown as plain "NOT YET LIQUIDATED", and
       "LIQUIDATED (SHORT)" marks one closed over an approved, unrecovered
       balance so it never reads as a clean full settlement. */
    LIQUIDATED: "green", "NOT YET LIQUIDATED": "amber", "Under Review": "red",
    SETTLED: "green", UNSETTLED: "amber",
    "PARTIALLY SETTLED": "amber", "OVER-SETTLED": "red", "LIQUIDATED (SHORT)": "blue",
    /* Reimbursement workflow states (Section 14) */
    DRAFT: "gray", SUBMITTED: "amber", "FOR REVIEW": "amber", "FOR APPROVAL": "amber",
    APPROVED: "blue", "RETURNED FOR REVISION": "red", REJECTED: "red",
    "FOR LIQUIDATION": "blue", "LIQUIDATION COMPLETED": "blue", "FOR PAYMENT": "amber",
    "UNDER REVIEW": "amber",
    PAID: "green", COMPLETED: "green",
    "FULLY APPROVED / READY FOR REPLENISHMENT": "green", REPLENISHED: "green",
    /* Acumatica export states */
    "Not Yet Exported": "gray", "Ready for Acumatica": "amber", Exported: "blue",
    Posted: "green", "Posting Error": "red",
  };
  const cls = map[status] || "gray";
  return <span className={`pcp-badge pcp-badge-${cls}`}>{status}</span>;
}

/* ---------------------------------------------------------------------------
   Shared column sorting for the list tables.
   Every module's table behaves the way the Release Ledger established: click a
   header to sort by that column, click the same header again to flip the
   direction. Defined once here so the modules stay in step instead of each
   growing its own slightly different sort.
   --------------------------------------------------------------------------- */

/* Numbers compare numerically; everything else uses a numeric-aware collator so
   PCR-2026-0009 stays below PCR-2026-0010 even if the series ever outgrows its
   zero padding. Blanks sort last in ascending order rather than jumping to the
   top, since an empty approver or remark is not "before A". */
function sortCompare(a, b) {
  const aBlank = a === null || a === undefined || a === "" || a === "—";
  const bBlank = b === null || b === undefined || b === "" || b === "—";
  if (aBlank || bBlank) return aBlank && bBlank ? 0 : (aBlank ? 1 : -1);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/* `fields` maps a column key to the value that column sorts on. Rows are copied
   before sorting so the caller's array (often straight from state) is untouched. */
function useTableSort(defaultKey, defaultDir) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir || "asc");

  /* A new column starts ascending; re-clicking the active column flips it. */
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortRows = (rows, fields) => {
    const fn = fields && fields[sortKey];
    if (!fn) return rows;
    return rows.slice().sort((a, b) => {
      const cmp = sortCompare(fn(a), fn(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  return { sortKey, sortDir, toggleSort, sortRows };
}

/* Header cell for a sortable column. The arrow only shows on the active column,
   matching the Release Ledger. */
function SortTh({ field, sort, align, style, children }) {
  const active = sort.sortKey === field;
  return (
    <th
      className="pcp-sortable"
      style={{ ...(align ? { textAlign: align } : null), ...(style || null) }}
      onClick={() => sort.toggleSort(field)}
      title="Click to sort"
    >
      {children}{active ? <span className="pcp-sort-ind">{sort.sortDir === "asc" ? "▲" : "▼"}</span> : null}
    </th>
  );
}

/* Collapsible/accordion section used to keep secondary Liquidation detail
   tucked away so the working area stays uncrowded (Section 25). */
function Collapsible({ title, subtitle, defaultOpen, right, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="pcp-collapse">
      <div className="pcp-collapse-head" onClick={() => setOpen((o) => !o)}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ChevronRight size={15} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.12s" }} />
          {title}
          {subtitle && <span style={{ fontWeight: 500, fontSize: 11, color: "var(--text-mut)" }}>{subtitle}</span>}
        </span>
        {right && <span onClick={(e) => e.stopPropagation()}>{right}</span>}
      </div>
      {open && <div className="pcp-collapse-body">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SEARCHABLE DROPDOWN
   A drop-in replacement for a long <select>: same look, plus a search box over
   the option list so the master-data pickers (Plant / Branch, Department,
   Allowable Purpose, Expense Category, Tax Category) can be typed at instead of
   scrolled through.

   `options` accepts either a flat list of { value, label, hint } or a grouped
   list of { label, options: [...] }. The stored value is always one of the
   options — the search box only filters, it is never the value — so free text
   can never reach a record through one of these fields.
--------------------------------------------------------------------------- */
function SearchSelect({
  value, onChange, options, placeholder, searchPlaceholder, emptyOptionLabel,
  disabled, title, invalid, style, popStyle,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  /* Close on an outside click so an open list never sits over the next field. */
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  /* Normalize flat and grouped inputs to one grouped shape (a flat list becomes
     a single unlabelled group) so the render path below stays single. */
  const groups = useMemo(() => {
    const src = options || [];
    const isGrouped = !!(src.length && src[0] && Array.isArray(src[0].options));
    return isGrouped
      ? src.map((g) => ({ label: g.label, items: g.options || [] }))
      : [{ label: "", items: src }];
  }, [options]);

  const ql = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({
      label: g.label,
      items: g.items.filter((o) => !ql
        || String(o.label || "").toLowerCase().includes(ql)
        || String(o.value || "").toLowerCase().includes(ql)
        || String(o.hint || "").toLowerCase().includes(ql)),
    }))
    .filter((g) => g.items.length);
  const matchCount = shown.reduce((n, g) => n + g.items.length, 0);

  /* The label for the current value comes from the options, so a stored code
     always displays as its master-data name. A value no longer in the list (a
     category Accounting has since retired) still shows, unchanged. */
  const selected = groups.reduce(
    (found, g) => found || g.items.find((o) => o.value === value) || null, null);
  const shownLabel = selected ? selected.label : (value || "");

  const pick = (v) => { onChange(v); setOpen(false); setQ(""); };

  return (
    <div className="pcp-ss-wrap" ref={wrapRef} style={style}>
      <button
        type="button" disabled={disabled} title={title || shownLabel}
        className={"pcp-select pcp-ss-btn" + (shownLabel ? "" : " placeholder")}
        style={invalid ? { borderColor: "var(--brand)" } : undefined}
        onClick={() => { if (!disabled) { setOpen((o) => !o); setQ(""); } }}
        aria-haspopup="listbox" aria-expanded={open}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shownLabel || placeholder || "— Select —"}
        </span>
        <ChevronRight
          size={14}
          style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)", flexShrink: 0, opacity: 0.6, transition: "transform 0.12s" }}
        />
      </button>
      {open && (
        <div className="pcp-ss-pop" style={popStyle}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "#9098b3" }} />
            <input
              autoFocus className="pcp-input" style={{ paddingLeft: 27 }}
              placeholder={searchPlaceholder || "Search…"}
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setQ(""); }
                /* Enter picks the only remaining match — the quickest path for
                   someone who already knows the code they are after. */
                if (e.key === "Enter" && matchCount === 1) {
                  e.preventDefault();
                  pick(shown[0].items[0].value);
                }
              }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 6 }} role="listbox">
            {emptyOptionLabel && !ql && (
              <div
                role="option" aria-selected={!value}
                className={"pcp-ss-opt" + (!value ? " active" : "")}
                onClick={() => pick("")}
              >
                {emptyOptionLabel}
              </div>
            )}
            {matchCount ? shown.map((g, gi) => (
              <div key={g.label || gi}>
                {g.label && <div className="pcp-ss-group">{g.label}</div>}
                {g.items.map((o) => (
                  <div
                    key={o.value} role="option" aria-selected={o.value === value}
                    className={"pcp-ss-opt" + (o.value === value ? " active" : "")}
                    title={o.hint || o.label}
                    onClick={() => pick(o.value)}
                  >
                    {o.label}
                    {o.hint && <div className="pcp-ss-opt-hint">{o.hint}</div>}
                  </div>
                ))}
              </div>
            )) : (
              <div className="pcp-empty" style={{ padding: 12, fontSize: 12 }}>
                Nothing matches {JSON.stringify(q)}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   INLINE DOCUMENT PREVIEWS
   Checking and approving a claim means reading the receipt, so every uploaded
   file is rendered in place — images and PDFs inline, anything else as a
   labelled tile with Open / Download. Nobody has to click "View" file by file.
--------------------------------------------------------------------------- */
/* One tile. Its own component because useFileUrl is a hook and a hook cannot
   be called from inside a .map callback. */
function AttachmentTile({ att, renderFooter }) {
  const src = useFileUrl(att);
  const name = att.name || "document";
  const type = String(att.type || "");
  const ext = String(name).split(".").pop().toLowerCase();
  const isImage = type.startsWith("image") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
  const isPdf = type.includes("pdf") || ext === "pdf";
  /* Bytes exist but the signed URL has not come back yet — say "loading",
     never render a broken image or a dead download link. */
  const pending = !src && hasFileBytes(att);
  return (
    <div className="pcp-doc-tile">
      <div className="pcp-doc-tile-head">
        <Paperclip size={12} color="#2054a3" style={{ flexShrink: 0 }} />
        <span className="pcp-doc-tile-name" title={name}>{name}</span>
        {att.docType && <span className="pcp-badge pcp-badge-gray">{att.docType}</span>}
        {src && <a className="pcp-iconbtn" href={src} target="_blank" rel="noopener noreferrer" title="Open full size"><Search size={13} /></a>}
        {src && <a className="pcp-iconbtn" href={src} download={name} title="Download"><Download size={13} /></a>}
      </div>
      <div className="pcp-doc-frame">
        {isImage && src ? (
          <img src={src} alt={name} />
        ) : isPdf && src ? (
          <iframe title={name} src={src} />
        ) : (
          <div className="pcp-doc-none">
            {pending
              ? "Loading…"
              : `No in-browser preview for ${ext ? ext.toUpperCase() : "this"} files — use Open or Download.`}
          </div>
        )}
      </div>
      {renderFooter && renderFooter(att)}
    </div>
  );
}

function AttachmentGallery({ attachments, emptyLabel, renderFooter }) {
  const list = attachments || [];
  if (!list.length) {
    return <div style={{ fontSize: 12, color: "var(--text-mut)" }}>{emptyLabel || "No documents attached."}</div>;
  }
  return (
    <div className="pcp-doc-gallery">
      {list.map((a, i) => (
        <AttachmentTile key={a.id || (a.name || "document") + i} att={a} renderFooter={renderFooter} />
      ))}
    </div>
  );
}
