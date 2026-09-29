/* ============================= STYLES ============================= */

const CSS = `
  /* Soft Green theme — sage (brand, navigation), mint (highlights), very
     light green (page), white (cards), dark green-charcoal (text). Red is
     kept ONLY as --danger: errors, required marks, delete, overdue. */
  :root {
    --ink: #2c4a3c;
    --ink-2: #355a47;
    --paper: #f2f7f3;
    --card: #ffffff;
    --line: #dce7df;
    --line-soft: #e9f1eb;
    --text: #1e2b24;
    --text-mut: #62736a;
    --brand: #4e7d63;
    --brand-dark: #3d654f;
    --brand-soft: #eaf4ee;
    --mint: #a7d7bd;
    --mint-bg: #e3f4ea;
    --danger: #c0392b;
    --danger-dark: #962d22;
    --amber: #a86b06;
    --amber-bg: #fdf3dc;
    --green: #237a45;
    --green-bg: #e3f3e8;
    --red-bg: #fbeaea;
    --blue-bg: #e8f0fa;
    --blue: #2f64a6;
    --orange: #c2560c;
    --orange-bg: #fdeee2;
    --purple: #6a4fb8;
    --purple-bg: #f0ecfa;
    --shadow-sm: 0 1px 2px rgba(30,43,36,0.05), 0 1px 3px rgba(30,43,36,0.04);
    --shadow-md: 0 6px 18px rgba(30,43,36,0.08);
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
    background: linear-gradient(180deg, var(--ink) 0%, var(--ink-2) 100%);
    color: #d9e8df;
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
    background: linear-gradient(135deg, #7fb89a, var(--brand));
    display: flex; align-items: center; justify-content: center;
    color: white; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  }
  .pcp-brand-title { font-weight: 700; font-size: 14.5px; color: #fff; letter-spacing: 0.2px; }
  .pcp-brand-sub { font-size: 10.5px; color: #a9c2b3; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; }

  .pcp-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .pcp-nav::-webkit-scrollbar { width: 6px; }
  .pcp-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
  .pcp-nav-group-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    color: #9fbcab; padding: 12px 8px 4px 8px; margin-top: 2px;
  }
  .pcp-nav-group:first-child .pcp-nav-group-label { margin-top: 0; }
  .pcp-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 11px 8px 14px; border-radius: 8px; cursor: pointer;
    color: #d2e3d9; font-size: 12.5px; font-weight: 500;
    transition: background 0.12s, color 0.12s;
    border: none; background: transparent; text-align: left; width: 100%;
  }
  .pcp-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .pcp-nav-item.active { background: var(--mint-bg); color: var(--ink); font-weight: 700; box-shadow: inset 3px 0 0 var(--brand); }
  .pcp-nav-item svg { flex-shrink: 0; }

  .pcp-sidebar-foot {
    margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);
  }
  /* Company logos in the sidebar: true colours on a soft light plate (the
     logos are black/red, which a dark sidebar would swallow). */
  .pcp-logos-strip { margin: 8px 2px 6px; padding: 9px 12px; background: #f4faf6; border-radius: 10px; }

  /* <BrandLogos>: the A1+ badge and the Starkson wordmark side by side, sized
     by visual weight (the badge is near-square, the wordmark ~6:1), split by a
     hairline. Transparent PNGs, never stretched: height set, width auto. */
  .pcp-brand-logos { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .pcp-brand-logos img { display: block; width: auto; max-width: 100%; object-fit: contain; }
  .pcp-brand-logos .bl-a1 { height: 44px; }
  .pcp-brand-logos .bl-spi { height: 27px; }
  .pcp-brand-logos .bl-sep { width: 1px; align-self: stretch; margin: 4px 0; background: #d6d9e3; flex-shrink: 0; }
  .pcp-brand-logos.compact { gap: 10px; }
  .pcp-brand-logos.compact .bl-a1 { height: 32px; }
  .pcp-brand-logos.compact .bl-spi { height: 19px; }

  /* ---- Main ---- */
  .pcp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .pcp-topbar {
    background: var(--card); border-bottom: 1px solid var(--line); box-shadow: 0 1px 0 var(--line-soft);
    padding: 14px 26px; display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 5;
  }
  .pcp-topbar h1 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .pcp-topbar-sub { font-size: 12px; color: var(--text-mut); margin-top: 2px; }
  .pcp-content { padding: 22px 26px 60px 26px; }

  .pcp-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 9px; border: 1px solid var(--line);
    background: var(--dm-surface, #fff); color: var(--text); font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; white-space: nowrap; box-shadow: var(--shadow-sm);
  }
  .pcp-btn:hover { border-color: var(--mint); background: var(--mint-bg); color: var(--brand-dark); }
  .pcp-btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; box-shadow: 0 2px 6px rgba(78,125,99,0.25); }
  .pcp-btn-primary:hover { background: var(--brand-dark); border-color: var(--brand-dark); color: #fff; }
  .pcp-btn-ghost { border-color: transparent; background: transparent; box-shadow: none; }
  .pcp-btn-ghost:hover { background: var(--paper); }
  .pcp-btn-sm { padding: 5px 10px; font-size: 11.5px; }
  .pcp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pcp-btn-danger { color: var(--danger); }
  .pcp-btn-danger:hover { background: var(--red-bg); border-color: #f1c4c0; }

  .pcp-card {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-sm);
  }
  .pcp-card-pad { padding: 18px 20px; }

  .pcp-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
  .pcp-kpi {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 16px 18px; position: relative; overflow: hidden; box-shadow: var(--shadow-sm);
  }
  .pcp-kpi::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--mint); opacity: 0.9; }
  .pcp-kpi-label { font-size: 11px; color: var(--text-mut); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .pcp-kpi-value { font-size: 22px; font-weight: 800; color: var(--text); margin-top: 6px; letter-spacing: -0.3px; }
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
    color: var(--brand-dark); font-weight: 700; padding: 10px 12px; border-bottom: 1px solid var(--line);
    background: #eaf4ee; white-space: nowrap; position: sticky; top: 0; z-index: 1;
  }
  table.pcp-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--line-soft); vertical-align: middle; }
  table.pcp-table tbody tr:nth-child(even) td { background: #f9fcfa; }
  table.pcp-table tbody tr:hover td { background: var(--brand-soft); }
  table.pcp-table tbody tr:last-child td { border-bottom: none; }
  .pcp-table-wrap { overflow-x: auto; border-radius: 12px; }

  .pcp-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px;
    font-size: 10.5px; font-weight: 700; white-space: nowrap; letter-spacing: 0.2px;
  }
  .pcp-badge-green { background: var(--green-bg); color: var(--green); }
  .pcp-badge-amber { background: var(--amber-bg); color: var(--amber); }
  .pcp-badge-red { background: var(--red-bg); color: var(--danger); }
  .pcp-badge-blue { background: var(--blue-bg); color: var(--blue); }
  .pcp-badge-orange { background: var(--orange-bg); color: var(--orange); }
  .pcp-badge-purple { background: var(--purple-bg); color: var(--purple); }
  .pcp-badge-mint { background: var(--mint-bg); color: var(--brand-dark); }
  .pcp-badge-gray { background: #e9f1eb; color: var(--text-mut); }

  .pcp-input, .pcp-select, textarea.pcp-input {
    width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px;
    font-size: 12.5px; background: var(--dm-input, #fff); color: var(--text); font-family: inherit;
  }
  .pcp-input:focus, .pcp-select:focus, textarea.pcp-input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(78,125,99,0.15); }
  .pcp-field { margin-bottom: 12px; }
  .pcp-field label { display: block; font-size: 11.5px; font-weight: 600; color: var(--text); margin-bottom: 5px; }
  .pcp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .pcp-modal-backdrop {
    position: fixed; inset: 0; background: rgba(15,18,30,0.55); display: flex;
    align-items: flex-start; justify-content: center; z-index: 50; padding: 40px 20px; overflow-y: auto;
  }
  .pcp-modal {
    background: var(--dm-surface, #fff); border-radius: 14px; width: 100%; max-width: 620px;
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
    /* Drag handle for moving the pop-up (installModalDrag in 02-helpers). */
    cursor: move; touch-action: none;
  }
  .pcp-modal-head :is(button, a, input, select, textarea) { cursor: pointer; }
  .pcp-modal-head :is(input, textarea) { cursor: text; }
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
  /* A table row that opens its record when clicked. */
  tr.pcp-row-click { cursor: pointer; }
  tr.pcp-row-click:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
  .pcp-flow-click { cursor: pointer; transition: background 0.12s; }
  .pcp-flow-click:hover { background: rgba(255,255,255,0.08); }
  .pcp-flow-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #8fa397; font-weight: 700; }
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
  .pcp-voucher-card.active { border-color: var(--brand); background: var(--brand-soft); }

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
  .pcp-stl-banner.tone-red   { background: var(--red-bg);   border-color: #f0bcbc; border-left-color: var(--danger); }
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
    padding: 3px 9px; border-radius: 99px; background: var(--dm-surface, #fff); border: 1px solid var(--line); color: var(--text-mut); white-space: nowrap;
  }
  .pcp-stl-due.soon { color: var(--amber); border-color: #efd49a; }
  .pcp-stl-due.overdue { color: #fff; background: var(--danger); border-color: var(--danger); }
  .pcp-stl-entry { font-size: 11.5px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 4px 0; border-bottom: 1px dashed #e9f1eb; }
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
  .pcp-ss-btn:disabled { background: #f1f7f3; color: var(--text-mut); cursor: not-allowed; }
  .pcp-purpose-pop, .pcp-ss-pop {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 60;
    background: var(--dm-surface, #fff); border: 1px solid var(--line); border-radius: 10px;
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
  /* Keyboard-highlighted row of the Expense autocomplete. */
  .pcp-ss-opt.hover { background: var(--red-bg); }
  /* Liquidation expense lines: "Best match" in the suggestion list and the
     "Auto" tag on a category the system filled in from the description. */
  .pcp-exp-best {
    margin-left: 6px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
    padding: 1px 6px; border-radius: 999px; background: var(--brand); color: #fff; vertical-align: 1px;
  }
  .pcp-ss-opt.active .pcp-exp-best { background: #fff; color: var(--brand); }
  .pcp-exp-auto {
    position: absolute; top: -7px; right: 8px; pointer-events: none;
    font-size: 9px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    padding: 0 6px; line-height: 14px; border-radius: 999px; background: var(--brand); color: #fff;
  }

  /* Inline document previews (checker / approver read the receipt in place) */
  .pcp-doc-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
  .pcp-doc-tile { border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: var(--dm-surface, #fff); }
  .pcp-doc-tile-head {
    display: flex; align-items: center; gap: 7px; padding: 7px 9px;
    border-bottom: 1px solid var(--line); background: #f8f9fc;
  }
  .pcp-doc-tile-name {
    font-size: 11.5px; font-weight: 600; min-width: 0; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pcp-doc-frame { background: #f1f7f3; display: block; }
  .pcp-doc-frame img { display: block; width: 100%; max-height: 260px; object-fit: contain; }
  .pcp-doc-frame iframe { display: block; width: 100%; height: 260px; border: none; }
  .pcp-doc-frame a { display: block; cursor: zoom-in; }
  .pcp-doc-gallery-lg { grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 14px; }
  .pcp-doc-gallery-lg .pcp-doc-frame img { max-height: 640px; }
  .pcp-doc-gallery-lg .pcp-doc-frame iframe { height: 640px; }
  /* Extra large (Approval Module): one or two documents per row, near
     full-height, for checking before approval. */
  .pcp-doc-gallery-xl { grid-template-columns: repeat(auto-fit, minmax(min(560px, 100%), 1fr)); gap: 16px; }
  .pcp-doc-gallery-xl .pcp-doc-frame img { max-height: max(520px, 78vh); }
  .pcp-doc-gallery-xl .pcp-doc-frame iframe { height: max(520px, 78vh); }
  /* Zoomed image: scrolls inside a fixed-height frame; aspect ratio kept. */
  .pcp-doc-frame.zoomed { overflow: auto; height: 640px; }
  .pcp-doc-gallery-xl .pcp-doc-frame.zoomed { height: max(520px, 78vh); }
  .pcp-doc-frame.zoomed img { max-height: none; margin: 0 auto; }
  .pcp-doc-zoombar { display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; }
  .pcp-doc-zoombar button { border: 1px solid var(--line); background: var(--dm-surface, #fff); border-radius: 6px; height: 24px; min-width: 24px; padding: 0 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 600; color: var(--text); }
  .pcp-doc-zoombar button:hover { border-color: var(--brand); color: var(--brand); }
  .pcp-doc-zoombar button:disabled { opacity: 0.4; cursor: default; }
  .pcp-doc-zoomval { font-size: 10.5px; color: var(--text-mut); min-width: 34px; text-align: center; }
  .pcp-doc-frame .pcp-doc-none { padding: 22px 14px; text-align: center; font-size: 11.5px; color: var(--text-mut); }

  /* ---- Notifications & role ---- */
  .pcp-notif-dot {
    position: absolute; top: 1px; right: 1px; min-width: 15px; height: 15px; padding: 0 3px;
    background: var(--brand); color: #fff; border-radius: 99px; font-size: 9px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; line-height: 1;
  }
  .pcp-notif-panel {
    position: absolute; right: 0; top: calc(100% + 8px); width: 340px; background: var(--dm-surface, #fff);
    border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,0.18);
    z-index: 60; overflow: hidden;
  }
  .pcp-notif-head { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
  .pcp-notif-list { max-height: 400px; overflow-y: auto; }
  .pcp-notif-item { display: flex; gap: 10px; padding: 11px 16px; border-bottom: 1px solid #f0f1f4; cursor: pointer; }
  .pcp-notif-item:hover { background: #f7fbf8; }
  .pcp-notif-item:last-child { border-bottom: none; }
  .pcp-notif-ic { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  /* Requestor liquidation reminders: a large bell with its count beside it. */
  .pcp-reminder-bell {
    display: flex; align-items: center; gap: 8px; padding: 8px 14px 8px 12px; background: var(--dm-surface, #fff);
    border: 2px solid; border-radius: 12px; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .pcp-reminder-bell:hover { background: #f7fbf8; }
  .pcp-reminder-count {
    min-width: 26px; height: 26px; padding: 0 7px; border-radius: 99px; color: #fff;
    font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center;
  }
  .pcp-reminder-panel { width: min(640px, calc(100vw - 32px)); }
  .pcp-reminder-list { max-height: 420px; overflow: auto; }
  .pcp-reminder-pill { display: inline-block; padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .pcp-role-badge {
    display: flex; align-items: center; gap: 6px; padding: 7px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.06); border-radius: 8px; color: #d9e8df; font-size: 11.5px; font-weight: 600;
  }
  .pcp-user-card { padding: 8px 10px; margin: 0 6px 8px 6px; background: rgba(255,255,255,0.06); border-radius: 8px; }
  .pcp-user-name { color: #fff; font-size: 12.5px; font-weight: 700; }
  .pcp-user-card .pcp-role-badge { margin: 4px 0 0 0; }
  .pcp-user-row {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 10px; margin: 0 6px 10px 6px;
    background: rgba(255,255,255,0.04); border-radius: 8px;
  }
  .pcp-theme-toggle { display: flex; gap: 2px; margin: 6px 6px 4px; padding: 2px; border-radius: 8px; background: rgba(255,255,255,0.06); }
  .pcp-theme-toggle button {
    flex: 1; display: flex; align-items: center; justify-content: center; height: 24px; min-width: 20px;
    border: none; border-radius: 6px; background: transparent; color: #a9c2b3; cursor: pointer;
  }
  .pcp-theme-toggle button:hover { color: #fff; background: rgba(255,255,255,0.08); }
  .pcp-theme-toggle button.on { background: rgba(255,255,255,0.16); color: #fff; }
  .pcp-user-email { flex: 1; min-width: 0; color: #8fa397; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-kpi-click { cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
  .pcp-kpi-click:hover { border-color: var(--brand); box-shadow: 0 4px 14px rgba(78,125,99,0.10); }
  .pcp-kpi-click.active { border-color: var(--brand); box-shadow: inset 0 -3px 0 var(--brand); background: var(--brand-soft); }

  /* ---- Login ---- */
  .pcp-login-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; min-height: 100vh; }
  .pcp-login-card {
    width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; box-shadow: 0 18px 50px rgba(15,18,30,0.12); overflow: hidden;
  }
  .pcp-login-head { background: var(--ink); color: #fff; padding: 22px 24px; }
  .pcp-login-head .pcp-brand-mark { margin-bottom: 12px; }
  .pcp-login-title { font-size: 16px; font-weight: 700; }
  .pcp-login-sub { font-size: 11.5px; color: #8fa397; margin-top: 3px; }
  .pcp-login-body { padding: 22px 24px; }
  .pcp-login-err { background: var(--red-bg); color: var(--danger); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-ok { background: var(--green-bg); color: var(--green); font-size: 12px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pcp-login-foot { font-size: 11px; color: var(--text-mut); text-align: center; margin-top: 14px; }

  /* Sign-in page: brand panel + form, stacked on narrow screens. */
  /* ---- Liquidation alarm bell (25-liq-alarms.jsx) ---- */
  .pcp-alarm-bell.ringing svg { animation: pcp-bell-ring 2.4s ease-in-out infinite; transform-origin: 50% 8%; }
  .pcp-alarm-bell.critical { animation: pcp-bell-pulse 1.6s ease-out infinite; }
  @keyframes pcp-bell-ring { 0%, 55%, 100% { transform: rotate(0); } 5% { transform: rotate(16deg); } 12% { transform: rotate(-14deg); } 19% { transform: rotate(11deg); } 26% { transform: rotate(-8deg); } 33% { transform: rotate(5deg); } 40% { transform: rotate(-3deg); } }
  @keyframes pcp-bell-pulse { 0% { box-shadow: 0 0 0 0 rgba(192,57,43,0.45); } 100% { box-shadow: 0 0 0 12px rgba(192,57,43,0); } }
  @media (prefers-reduced-motion: reduce) { .pcp-alarm-bell.ringing svg, .pcp-alarm-bell.critical { animation: none; } }
  .pcp-alarm-panel { width: min(640px, 94vw); }
  .pcp-alarm-tabs { display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 1px solid var(--line); }
  .pcp-alarm-tabs button { border: none; background: none; padding: 7px 10px; font: inherit; font-size: 12px; font-weight: 600; color: var(--text-mut); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .pcp-alarm-tabs button.active { color: var(--brand); border-bottom-color: var(--brand); }
  .pcp-alarm-body { max-height: min(62vh, 560px); overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
  .pcp-alarm-card { border: 1px solid; border-left-width: 4px; border-radius: 10px; padding: 10px 12px; }
  .pcp-alarm-card.read { opacity: 0.85; }
  .pcp-alarm-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.2px; }
  .pcp-alarm-new { color: #fff; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 99px; letter-spacing: 0.6px; }
  .pcp-alarm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 6px 14px; margin-top: 8px; }
  .pcp-alarm-grid div { display: flex; flex-direction: column; min-width: 0; }
  .pcp-alarm-grid span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-mut); }
  .pcp-alarm-grid b { font-size: 12.5px; overflow-wrap: anywhere; }
  .pcp-alarm-note { margin-top: 8px; font-size: 11.5px; line-height: 1.5; color: var(--danger-dark); background: rgba(192,57,43,0.06); border-radius: 6px; padding: 7px 9px; }
  .pcp-alarm-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 9px; font-size: 10.5px; color: var(--text-mut); }
  .pcp-alarm-desktop { display: flex; gap: 8px; align-items: center; font-size: 11.5px; color: var(--text-mut); padding: 9px 12px; border-top: 1px solid var(--line); cursor: pointer; }
  .pcp-row-focus td { background: #fff4d6 !important; transition: background 0.4s; }

  .pcp-login-split { flex: 1; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); min-height: 100vh; }
  .pcp-login-brand {
    position: relative; overflow: hidden; color: #fff; padding: 40px 48px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
    background: radial-gradient(circle at 85% 15%, rgba(167,215,189,0.35), transparent 55%),
                radial-gradient(circle at 10% 95%, rgba(127,184,154,0.30), transparent 50%),
                linear-gradient(160deg, #2c4a3c 0%, #3d654f 100%);
  }
  .pcp-login-brand-top { display: flex; align-items: center; gap: 12px; }
  .pcp-login-logo-tile { width: 52px; height: 52px; flex-shrink: 0; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.25); }
  .pcp-login-logo-tile img { max-width: 38px; max-height: 44px; object-fit: contain; }
  .pcp-login-card-logo { display: block; height: 48px; width: auto; margin-bottom: 14px; }
  .pcp-login-brand-name { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; }
  .pcp-login-brand-sub { font-size: 11.5px; color: #c5dacd; margin-top: 2px; }
  .pcp-login-brand-mid { max-width: 460px; }
  .pcp-login-hero { font-size: clamp(26px, 3.2vw, 38px); line-height: 1.15; font-weight: 800; letter-spacing: -0.6px; margin: 0 0 14px; }
  .pcp-login-lead { font-size: 14px; line-height: 1.6; color: #dbe9e0; margin: 0 0 22px; }
  .pcp-login-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .pcp-login-features li { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #eef6f1; }
  .pcp-login-features svg { color: var(--mint); flex-shrink: 0; }
  .pcp-login-pane { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 32px 24px; background: var(--paper); }
  .pcp-login-split .pcp-login-card { max-width: 400px; border-radius: 16px; box-shadow: 0 24px 60px rgba(15,18,30,0.10); }
  .pcp-login-card-head { padding: 28px 28px 0; }
  .pcp-login-split .pcp-login-title { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.3px; color: var(--text); }
  .pcp-login-split .pcp-login-sub { font-size: 12.5px; color: var(--text-mut); margin-top: 6px; }
  .pcp-login-split .pcp-login-body { padding: 22px 28px 26px; }
  .pcp-login-input { position: relative; display: flex; align-items: center; }
  .pcp-login-input > svg { position: absolute; left: 11px; color: #8fa397; pointer-events: none; }
  .pcp-login-input > svg { left: 13px; }
  .pcp-login-input .pcp-input { padding-left: 40px; height: 48px; font-size: 14.5px; border-radius: 10px; }
  .pcp-login-input .pcp-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(78,125,99,0.12); outline: none; }
  .pcp-login-input.invalid .pcp-input { border-color: var(--danger); background: #fff8f7; }
  .pcp-login-split .pcp-field label { font-size: 12.5px; font-weight: 600; color: var(--text); }
  .pcp-login-field-err { font-size: 12px; color: var(--danger); margin-top: 5px; }
  .pcp-login-caps { font-size: 12px; color: #92600a; margin-top: 5px; }
  .pcp-login-eye { position: absolute; right: 6px; border: none; background: none; color: #8fa397; cursor: pointer; padding: 8px; border-radius: 8px; display: flex; }
  .pcp-login-eye:hover, .pcp-login-eye:focus-visible { color: var(--brand); background: var(--brand-soft); outline: none; }
  .pcp-login-input:has(.pcp-login-eye) .pcp-input { padding-right: 44px; }
  .pcp-login-submit {
    width: 100%; justify-content: center; height: 48px; font-size: 15px; font-weight: 700; margin-top: 8px; border-radius: 10px;
    box-shadow: 0 8px 20px rgba(78,125,99,0.25); transition: transform 0.08s, box-shadow 0.15s, background 0.15s;
  }
  .pcp-login-submit:hover:not(:disabled) { box-shadow: 0 10px 24px rgba(78,125,99,0.35); transform: translateY(-1px); }
  .pcp-login-submit:active:not(:disabled) { transform: translateY(0); box-shadow: 0 4px 12px rgba(78,125,99,0.25); }
  .pcp-login-submit:disabled { opacity: 0.85; cursor: progress; }
  .pcp-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.45); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: pcp-spin 0.7s linear infinite; }
  @keyframes pcp-spin { to { transform: rotate(360deg); } }
  .pcp-login-alert { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; line-height: 1.45; padding: 11px 13px; border: 1px solid #f1c4c0; }
  .pcp-login-alert svg { flex-shrink: 0; margin-top: 1px; }
  .pcp-login-alert b { display: block; margin-bottom: 2px; }
  .pcp-login-help { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; padding: 10px 12px; border-radius: 8px; background: #f1f7f3; font-size: 11.5px; line-height: 1.5; color: var(--text-mut); }
  .pcp-login-help svg { flex-shrink: 0; margin-top: 2px; }
  .pcp-login-copy { font-size: 11px; color: var(--text-mut); text-align: center; }
  /* ---- Login ₱ visual (PesoVisual in 20-auth-gate.jsx) ---- */
  .pcp-peso-scene { position: relative; height: 200px; max-width: 420px; margin-top: 4px; }
  .pcp-peso-glow { position: absolute; left: 30%; top: 20%; width: 60%; height: 70%; border-radius: 50%; background: radial-gradient(circle, rgba(245,196,81,0.28), transparent 70%); filter: blur(6px); }
  .pcp-peso-bills { position: absolute; left: 10px; top: 36px; width: 230px; height: 118px; }
  .pcp-peso-bill {
    position: absolute; inset: 0; border-radius: 10px; overflow: hidden;
    background: linear-gradient(135deg, #f7ecd0 0%, #e9d6a4 55%, #d9bf7e 100%);
    border: 2px solid rgba(146,96,10,0.55); box-shadow: 0 12px 26px rgba(0,0,0,0.35), inset 0 0 0 5px rgba(255,255,255,0.35);
    animation: pcp-bill-float 6s ease-in-out infinite;
  }
  .pcp-peso-bill.b3 { transform: translate(34px, -26px) rotate(8deg); opacity: 0.55; animation-delay: -2s; }
  .pcp-peso-bill.b2 { transform: translate(17px, -13px) rotate(4deg); opacity: 0.8; animation-delay: -1s; background: linear-gradient(135deg, #f3e3c0, #e2c98f 60%, #cfae67); }
  .pcp-peso-bill.b1 { transform: rotate(-2deg); }
  .pcp-peso-bill-val { position: absolute; font-weight: 800; color: #6b4a07; letter-spacing: -0.3px; }
  .pcp-peso-bill-val.tl { left: 12px; top: 8px; font-size: 15px; }
  .pcp-peso-bill-val.br { right: 12px; bottom: 7px; font-size: 13px; opacity: 0.75; }
  .pcp-peso-bill-seal {
    position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #6b4a07;
    border: 2px solid rgba(107,74,7,0.45); background: radial-gradient(circle, rgba(255,255,255,0.6), rgba(255,255,255,0.1));
  }
  .pcp-peso-bill-lines { position: absolute; left: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
  .pcp-peso-bill-lines i { display: block; height: 3px; width: 46px; border-radius: 2px; background: rgba(107,74,7,0.3); }
  .pcp-peso-bill-lines i:nth-child(2) { width: 34px; }
  .pcp-peso-bill-lines i:nth-child(3) { width: 40px; }
  @keyframes pcp-bill-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -7px; } }

  .pcp-peso-coin {
    position: absolute; width: 38px; height: 38px; border-radius: 50%; opacity: 0;
    background: radial-gradient(circle at 35% 30%, #fff3c4 0%, #f5c451 35%, #c98f12 75%, #9c6b06 100%);
    box-shadow: 0 6px 14px rgba(0,0,0,0.35), inset 0 0 0 3px rgba(255,240,190,0.55);
    display: flex; align-items: center; justify-content: center;
    animation: pcp-coin-rise 7s ease-in-out infinite;
  }
  .pcp-peso-coin span { font-size: 19px; font-weight: 800; color: #7a4f02; animation: pcp-coin-turn 3.5s ease-in-out infinite; display: block; }
  .pcp-peso-coin.c1 { left: 262px; bottom: 6px; animation-delay: 0s; }
  .pcp-peso-coin.c2 { left: 310px; bottom: 30px; width: 30px; height: 30px; animation-delay: -1.4s; }
  .pcp-peso-coin.c2 span { font-size: 15px; }
  .pcp-peso-coin.c3 { left: 356px; bottom: 0; animation-delay: -2.8s; }
  .pcp-peso-coin.c4 { left: 290px; bottom: 60px; width: 26px; height: 26px; animation-delay: -4.2s; }
  .pcp-peso-coin.c4 span { font-size: 13px; }
  .pcp-peso-coin.c5 { left: 222px; bottom: -4px; width: 32px; height: 32px; animation-delay: -5.6s; }
  .pcp-peso-coin.c5 span { font-size: 16px; }
  @keyframes pcp-coin-rise {
    0% { opacity: 0; transform: translateY(18px) scale(0.9); }
    15% { opacity: 0.95; }
    70% { opacity: 0.9; }
    100% { opacity: 0; transform: translateY(-120px) scale(1); }
  }
  @keyframes pcp-coin-turn { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.35); } }
  @media (prefers-reduced-motion: reduce) {
    .pcp-peso-bill, .pcp-peso-coin span { animation: none; }
    .pcp-peso-coin { animation: none; opacity: 0.9; }
  }

  @media (max-width: 860px) {
    .pcp-login-split { grid-template-columns: minmax(0, 1fr); }
    .pcp-peso-scene { transform: scale(0.7); transform-origin: left top; margin-bottom: -60px; }
    .pcp-login-brand { padding: 24px 22px; gap: 16px; }
    .pcp-login-hero { font-size: 22px; margin-bottom: 8px; }
    .pcp-login-lead { margin-bottom: 0; font-size: 13px; }
    .pcp-login-features { display: none; }
  }
  @media (max-width: 480px) {
    .pcp-login-card-head { padding: 22px 20px 0; }
    .pcp-login-split .pcp-login-body { padding: 18px 20px 22px; }
  }

  /* ---- Report ---- */
  .pcp-report-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .pcp-report-head img { max-height: 46px; max-width: 130px; object-fit: contain; }
  .pcp-report-head .pcp-brand-logos img { max-height: none; max-width: 100%; }
  .pcp-report-title { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; }
  .pcp-report-sub { font-size: 11.5px; color: var(--text-mut); }
  table.pcp-table tfoot td { padding: 9px 10px; border-top: 2px solid var(--line); font-weight: 800; background: #eef6f1; }

  @media (max-width: 980px) {
    .pcp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .pcp-grid-2, .pcp-grid-3 { grid-template-columns: 1fr; }
    .pcp-sidebar { width: 74px; }
    .pcp-brand-title, .pcp-brand-sub, .pcp-nav-item span, .pcp-logos-strip { display: none; }
  }

  /* ---- Report Center (on-screen professional preview) ---- */
  .pcp-rc-filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .pcp-rc-field label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-mut); margin-bottom: 4px; }
  .pcp-doc-scroll { overflow: auto; background: #e9f1eb; border: 1px solid var(--line); border-radius: 12px; padding: 22px; }
  .pcp-doc {
    background: #fff; margin: 0 auto; box-shadow: 0 6px 24px rgba(15,18,30,0.14);
    padding: 26px 30px; position: relative; font-family: Calibri, Arial, Helvetica, sans-serif; color: #1a1a1a;
  }
  .pcp-doc.portrait { max-width: 794px; }
  .pcp-doc.landscape { max-width: 1123px; }
  .pcp-doc-wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
  .pcp-doc-wm span { font-size: 120px; font-weight: 800; color: rgba(78,125,99,0.07); transform: rotate(-30deg); white-space: nowrap; }
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
  table.pcp-doc-table tbody tr:nth-child(even) td { background: #f1f7f3; }
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

  .pcp-drill-head { position: sticky; top: 0; z-index: 3; background: var(--dm-surface, #fff); border-bottom: 1px solid var(--line); padding: 14px 20px; }
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

  .pcp-detail-card { background: var(--dm-surface, #fff); border: 1px solid var(--line); border-left: 3px solid var(--brand); border-radius: 8px; padding: 14px 16px; margin: 2px 0 6px; }
  .pcp-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 20px; font-size: 12px; }
  .pcp-detail-grid .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); font-weight: 700; }
  @media (max-width: 760px) { .pcp-detail-grid { grid-template-columns: 1fr 1fr; } }
  .pcp-receipts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .pcp-receipt { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; text-decoration: none; color: var(--text); }
  .pcp-receipt img { width: 92px; height: 66px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
  .pcp-receipt .fileicon { width: 92px; height: 66px; border-radius: 6px; border: 1px solid var(--line); background: #f1f7f3; display: flex; align-items: center; justify-content: center; }
  .pcp-receipt span { font-size: 10px; color: var(--text-mut); max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcp-receipt-link { color: var(--brand); font-weight: 600; cursor: pointer; }

  .pcp-pager { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-top: 14px; font-size: 12px; color: var(--text-mut); }
  .pcp-drill-count { font-size: 12px; color: var(--text-mut); }

  /* ---- PCF Documents ---- */
  .pcp-dropzone { border: 2px dashed #b9cfc1; border-radius: 12px; padding: 26px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; background: #f7fbf8; }
  .pcp-dropzone:hover { border-color: var(--brand); }
  .pcp-dropzone.over { border-color: var(--brand); background: var(--brand-soft); }
  .pcp-progress { height: 8px; background: #e9f1eb; border-radius: 99px; overflow: hidden; }
  .pcp-progress-bar { height: 100%; background: var(--brand); border-radius: 99px; transition: width 0.2s ease; }
  .pcp-hint { font-size: 12px; color: var(--text-mut); background: #f1f7f3; border-radius: 7px; padding: 8px 10px; }
  .pcp-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-mut); font-weight: 600; }
  .pcp-iconbtn { background: none; border: none; padding: 4px; margin: 0 1px; border-radius: 6px; cursor: pointer; color: var(--text-mut); vertical-align: middle; }
  .pcp-iconbtn:hover { background: #e9f1eb; color: var(--text); }

  /* ---- Interactive department drill-down ---- */
  .pcp-mini-stat { background: #f1f7f3; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
  .pcp-mini-stat .lbl { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-mut); }
  .pcp-mini-stat .val { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .pcp-filter-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; background: var(--brand-soft); color: var(--brand-dark); border: 1px solid #cfe5d7; border-radius: 99px; padding: 4px 6px 4px 12px; font-weight: 600; }
  .pcp-filter-chip button { display: inline-flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; border: none; border-radius: 99px; width: 18px; height: 18px; cursor: pointer; padding: 0; }

  /* ---- All portal text in bold (owner's instruction, Sep 2026) ----
     !important so it also wins over the inline fontWeight on individual
     elements. Headings stay one step heavier so titles still stand out. The
     on-screen report preview (.pcp-doc) keeps its document typography, so it
     still matches the printed report. */
  .pcp-root, .pcp-root *:not(.pcp-doc):not(.pcp-doc *),
  .pcp-root input::placeholder, .pcp-root textarea::placeholder { font-weight: 700 !important; }
  .pcp-root :is(h1, h2, h3, h4):not(.pcp-doc):not(.pcp-doc *) { font-weight: 800 !important; }
  .pcp-root .pcp-doc { font-weight: 400; }
  /* Approval Module (Grace Gan's decision screen): larger, higher-contrast
     text. The whole page body is scaled 10% (most sizes here are fixed px, so
     a base font-size alone would not reach them), and the grey secondary text
     is darkened. Pop-ups sit outside .pcp-content, so they are not scaled and
     still fit the window. Dark mode's lighter grey is set further down. */
  .pcp-approval-page { --text-mut: #3a4a41; }
  .pcp-approval-page > .pcp-content { zoom: 1.1; }

  /* ---- Print (management report) ---- */
  @media print {
    .pcp-sidebar, .pcp-topbar, .pcp-tabs, .pcp-no-print { display: none !important; }
    .pcp-root { display: block; }
    .pcp-content { padding: 0 !important; }
    .pcp-card { border: 1px solid #ccc; break-inside: avoid; }
    body, .pcp-root { background: #fff !important; }
    table.pcp-table thead th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ---- Dark mode ----
     Switched by data-theme="dark" on <html> (set in index.html, toggled by
     <ThemeToggle>). Screen only: printing always uses the light theme above,
     and the report preview (.pcp-doc) stays a white sheet of paper because it
     shows what will print. Mostly re-points the variables at the top of this
     file; the rest overrides the light colours written directly into rules.
     Components with an inline light colour use var(--dm-..., <light colour>),
     so light mode keeps its exact colour and only dark mode defines --dm-*. */
  @media screen {
    :root[data-theme="dark"] {
      color-scheme: dark;
      --ink: #14211a;
      --ink-2: #1a2b22;
      --paper: #0f1713;
      --card: #17221c;
      --line: #2a3a31;
      --line-soft: #213029;
      --text: #e3ece6;
      --text-mut: #9bb0a3;
      --brand: #4f8a6b;
      --brand-dark: #9fd0b4;
      --brand-soft: #1f3329;
      --mint: #4f8a6b;
      --mint-bg: #223d30;
      --danger: #e5645a;
      --danger-dark: #f29a91;
      --amber: #e0a43a;
      --amber-bg: #372c14;
      --green: #62c68b;
      --green-bg: #173424;
      --red-bg: #3a1f1d;
      --blue-bg: #182a40;
      --blue: #82b2ec;
      --orange: #f0975c;
      --orange-bg: #3b2617;
      --purple: #b7a1f2;
      --purple-bg: #29233f;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.35);
      --shadow-md: 0 6px 18px rgba(0,0,0,0.45);
      --dm-surface: #17221c;
      --dm-input: #111a15;
      --dm-subtle: #131d18;
      --dm-ok-bg: #173424; --dm-ok-line: #2c5a3e; --dm-ok-text: #62c68b;
      --dm-bad-bg: #3a1f1d; --dm-bad-line: #6b3530; --dm-bad-text: #f29a91;
      --dm-alarm-read: #17221c;
      --dm-alarm-due1: #3b2617; --dm-alarm-due0: #3f2415; --dm-alarm-overdue: #3a1f1d;
    }
    [data-theme="dark"] .pcp-approval-page { --text-mut: #c6d6cc; }
    [data-theme="dark"] .pcp-nav-item.active { background: var(--mint-bg); color: #e3f4ea; }

    /* Surfaces that were a fixed pale tint. (The plain-white ones — buttons,
       modals, pop-overs, inputs — read var(--dm-surface / --dm-input, #fff)
       in their own rule, so hover and ghost variants keep working.) */
    [data-theme="dark"] .pcp-drill-search input { background: var(--dm-input); color: var(--text); }
    [data-theme="dark"] .pcp-btn-primary:hover { background: #5f9c7c; border-color: #5f9c7c; color: #fff; }
    [data-theme="dark"] .pcp-btn-danger:hover { border-color: var(--dm-bad-line); }
    [data-theme="dark"] table.pcp-table thead th { background: #1d2d25; }
    [data-theme="dark"] table.pcp-table tbody tr:nth-child(even) td { background: #1a2620; }
    [data-theme="dark"] table.pcp-table tbody tr:hover td { background: var(--brand-soft); }
    [data-theme="dark"] table.pcp-table tfoot td { background: #1d2d25; }
    [data-theme="dark"] table.pcp-table tbody tr.pcp-rr-row.on { background: #33201f; }
    [data-theme="dark"] .pcp-row-focus td { background: #3d3414 !important; }
    [data-theme="dark"] .pcp-badge-gray { background: #24332b; }
    [data-theme="dark"] .pcp-collapse-head:hover { background: #1d2d25; }
    [data-theme="dark"] .pcp-ss-btn:disabled { background: #1a2620; }
    [data-theme="dark"] .pcp-doc-tile-head { background: #1a2620; }
    [data-theme="dark"] .pcp-doc-frame { background: #0c120f; }
    [data-theme="dark"] .pcp-notif-item { border-bottom-color: var(--line-soft); }
    [data-theme="dark"] .pcp-notif-item:hover, [data-theme="dark"] .pcp-reminder-bell:hover { background: #1d2d25; }
    [data-theme="dark"] .pcp-stl-banner.tone-amber,
    [data-theme="dark"] .pcp-stl-banner.tone-blue,
    [data-theme="dark"] .pcp-stl-banner.tone-green,
    [data-theme="dark"] .pcp-stl-banner.tone-red { border-color: var(--line); }
    [data-theme="dark"] .pcp-stl-banner.tone-amber { border-left-color: var(--amber); }
    [data-theme="dark"] .pcp-stl-banner.tone-blue { border-left-color: var(--blue); }
    [data-theme="dark"] .pcp-stl-banner.tone-green { border-left-color: var(--green); }
    [data-theme="dark"] .pcp-stl-banner.tone-red { border-left-color: var(--danger); }
    [data-theme="dark"] .pcp-stl-due.soon { border-color: #5a4520; }
    [data-theme="dark"] .pcp-stl-entry { border-bottom-color: var(--line); }
    [data-theme="dark"] .pcp-login-input.invalid .pcp-input { background: #2a1917; }
    [data-theme="dark"] .pcp-login-alert { border-color: var(--dm-bad-line); }
    [data-theme="dark"] .pcp-login-help,
    [data-theme="dark"] .pcp-hint,
    [data-theme="dark"] .pcp-mini-stat,
    [data-theme="dark"] .pcp-receipt .fileicon { background: #1a2620; }
    [data-theme="dark"] .pcp-login-caps { color: var(--amber); }
    /* The logos are black and red; give them the same light plate the sidebar uses. */
    [data-theme="dark"] .pcp-login-pane .pcp-brand-logos { background: #f4faf6; padding: 8px 16px; border-radius: 10px; }
    [data-theme="dark"] .pcp-dropzone { background: #131d18; border-color: #35503f; }
    [data-theme="dark"] .pcp-progress { background: #24332b; }
    [data-theme="dark"] .pcp-iconbtn:hover { background: #24332b; }
    [data-theme="dark"] .pcp-filter-chip { border-color: #35503f; }
    [data-theme="dark"] .pcp-alarm-note { background: rgba(229,100,90,0.12); }
    [data-theme="dark"] .pcp-home-due.orange { background: var(--orange-bg); color: var(--orange); }
    [data-theme="dark"] .pcp-home-due.yellow { color: var(--amber); }
    [data-theme="dark"] ::-webkit-scrollbar-thumb { background: #3a4a41; }
    /* The report preview is a sheet of paper: dark desk, white page. */
    [data-theme="dark"] .pcp-doc-scroll { background: #0c120f; }

    /* Charts (recharts): grid lines, axis text, tooltip, legend. */
    [data-theme="dark"] .recharts-cartesian-grid line { stroke: #2a3a31; }
    [data-theme="dark"] .recharts-cartesian-axis-tick-value { fill: #9bb0a3; }
    [data-theme="dark"] .recharts-default-tooltip {
      background: var(--card) !important; border-color: var(--line) !important; color: var(--text);
    }
    [data-theme="dark"] .recharts-legend-item-text { color: var(--text) !important; }
    [data-theme="dark"] .recharts-pie-label-text { fill: var(--text); }
    [data-theme="dark"] .recharts-tooltip-cursor { fill: rgba(255,255,255,0.05); }
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

/* The two company logos, consistently sized and spaced (see .pcp-brand-logos).
   For light backgrounds; on a dark one, wrap it in a light plate. */
function BrandLogos({ compact }) {
  return (
    <div className={"pcp-brand-logos" + (compact ? " compact" : "")}>
      <img className="bl-a1" src={LOGO_A1_T} alt="A1+ Multinational Packaging, Inc" />
      <span className="bl-sep" aria-hidden="true" />
      <img className="bl-spi" src={LOGO_SPI_T} alt="Starkson Packaging, Inc." />
    </div>
  );
}

/* Light / Dark / System switch for the sidebar. The preference is per browser
   (window.PCP_THEME in index.html owns storage and applies it to <html>). */
const THEME_OPTIONS = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "Match my computer", icon: Monitor },
];
function ThemeToggle() {
  const api = window.PCP_THEME;
  const [theme, setTheme] = useState(() => (api ? api.get() : "light"));
  useEffect(() => {
    const on = () => setTheme(api ? api.get() : "light");
    window.addEventListener("pcp-theme", on);
    return () => window.removeEventListener("pcp-theme", on);
  }, []);
  if (!api) return null;
  return (
    <div className="pcp-theme-toggle" role="radiogroup" aria-label="Display theme">
      {THEME_OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={theme === o.key}
            className={theme === o.key ? "on" : ""} title={o.label} onClick={() => api.set(o.key)}>
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}

function Sidebar({ tab, setTab, role, navGroups, userEmail, userName, onSignOut, onChangePassword, onManageMfa }) {
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
            <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#d9e8df" }} onClick={onSignOut} title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        )}
        {onChangePassword && (
          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#d9e8df", width: "100%", justifyContent: "flex-start", marginTop: 2 }} onClick={onChangePassword} title="Change your password">
            <KeyRound size={13} /> Change Password
          </button>
        )}
        {onManageMfa && (
          <button className="pcp-btn pcp-btn-sm pcp-btn-ghost" style={{ color: "#d9e8df", width: "100%", justifyContent: "flex-start", marginTop: 2 }} onClick={onManageMfa} title="Add or remove authenticator devices">
            <ShieldCheck size={13} /> Authenticator Devices
          </button>
        )}
        <ThemeToggle />
        <div className="pcp-logos-strip">
          <BrandLogos compact />
        </div>
        <div style={{ fontSize: 10.5, color: "#9fbcab", padding: "2px 6px" }}>
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
              const tint = n.type === "overdue" || n.type === "rejected" ? "var(--danger)"
                : n.type === "approved" || n.type === "replenished" ? "var(--green)"
                : n.type === "approval" ? "var(--amber)" : "var(--blue)";
              return (
                <div key={n.id} className="pcp-notif-item" onClick={() => { if (ui.onNotifClick) ui.onNotifClick(n); setOpen(false); }}>
                  <div className="pcp-notif-ic" style={{ background: tint + "18", color: tint }}><Icon size={14} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: "#8fa397" }}>{fmtDate(n.date)}</div>
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
        <LiquidationReminderBell />
        <LiquidationAlarmBell />
        <NotificationBell />
      </div>
    </div>
  );
}

/* The number a record carried before it was last renumbered — a plant move,
   Accounting's override, or the per-plant migration (the old number stays
   retired; it is never issued again) — shown
   under the current one so paper already issued under the old number can be
   matched to the record on sight. Falls back to the pre-per-plant request
   number. Renders nothing for a record that was never renumbered. */
function PrevNo({ rec, legacy }) {
  const h = (rec && rec.numberHistory) || [];
  const last = h.length ? h[h.length - 1] : null;
  const prev = last ? last.from : legacy;
  if (!prev) return null;
  const why = last ? [last.reason, last.user, last.ts && fmtDate(last.ts.slice(0, 10))].filter(Boolean).join(" · ") : "before the series became per-plant";
  return (
    <div style={{ fontSize: 10.5, color: "var(--text-mut)", marginTop: 1 }} title={`Previously numbered ${prev}${why ? ` — ${why}` : ""}`}>
      was {prev}
    </div>
  );
}

function Badge({ status }) {
  const map = {
    Pending: "amber", Approved: "green", Rejected: "red", Disbursed: "green", Overdue: "red", "For Review": "amber",
    Open: "blue", Closed: "gray",
    "Not Liquidated": "orange", "Partially Liquidated": "blue",
    "Fully Liquidated": "green", "Over-Liquidated": "red",
    Draft: "gray", Submitted: "amber", Verified: "blue", Completed: "green", Released: "green",
    "For Revision": "red", "Pending Approval": "amber", "Receipts Approved": "green", "No Receipts": "gray",
    /* Two-level liquidation approval stages (LIQ_STAGE in 02-helpers.jsx) */
    "For Custodian Review": "amber", "Needs Correction": "red", "Awaiting Settlement": "amber",
    "For Final Approval": "blue", "Fully Approved / Ready for Replenishment": "purple",
    Replenished: "green", "Approved (before two-level review)": "gray", Reverted: "gray",
    "FOR CUSTODIAN REVIEW": "amber", "FOR FINAL APPROVAL": "blue",
    /* Accounting review, between the custodian and the final approver */
    "For Accounting Check": "blue", "FOR ACCOUNTING CHECK": "blue", YES: "green",
    /* Cash-settlement / final liquidation states.
       PARTIALLY SETTLED and OVER-SETTLED exist so a cash variance somebody has
       to chase is never shown as plain "NOT YET LIQUIDATED", and
       "LIQUIDATED (SHORT)" marks one closed over an approved, unrecovered
       balance so it never reads as a clean full settlement. */
    LIQUIDATED: "green", "NOT YET LIQUIDATED": "orange", "Under Review": "red",
    SETTLED: "green", UNSETTLED: "amber",
    "PARTIALLY SETTLED": "amber", "OVER-SETTLED": "red", "LIQUIDATED (SHORT)": "blue",
    /* Reimbursement workflow states (Section 14) */
    DRAFT: "gray", SUBMITTED: "amber", "FOR REVIEW": "amber", "FOR APPROVAL": "amber",
    APPROVED: "green", "RETURNED FOR REVISION": "red", REJECTED: "red",
    /* Reverted by the custodian — back with the requestor (liquidation and
       reimbursement alike). */
    "FOR SUBMISSION": "orange",
    "FOR LIQUIDATION": "orange", "LIQUIDATION COMPLETED": "blue", "FOR PAYMENT": "amber",
    "UNDER REVIEW": "amber",
    PAID: "green", COMPLETED: "green",
    "FULLY APPROVED / READY FOR REPLENISHMENT": "purple", REPLENISHED: "green",
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
        style={invalid ? { borderColor: "var(--danger)" } : undefined}
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
            <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "#8fa397" }} />
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
/* Zoom steps for large previews; 100 = fit to the frame. Display only. */
const DOC_ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300];

function AttachmentTile({ att, renderFooter, large }) {
  const src = useFileUrl(att);
  const [zoom, setZoom] = useState(100);
  const zi = DOC_ZOOM_STEPS.indexOf(zoom);
  const stepZoom = (d) => setZoom(DOC_ZOOM_STEPS[Math.min(DOC_ZOOM_STEPS.length - 1, Math.max(0, zi + d))]);
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
        {large && src && (isImage || isPdf) && (
          <span className="pcp-doc-zoombar" aria-label="Zoom">
            <button type="button" onClick={() => stepZoom(-1)} disabled={zi <= 0} title="Zoom out"><ZoomOut size={12} /></button>
            <span className="pcp-doc-zoomval">{zoom === 100 ? "Fit" : zoom + "%"}</span>
            <button type="button" onClick={() => stepZoom(1)} disabled={zi >= DOC_ZOOM_STEPS.length - 1} title="Zoom in"><ZoomIn size={12} /></button>
            {zoom !== 100 && <button type="button" onClick={() => setZoom(100)} title="Fit to frame">Fit</button>}
          </span>
        )}
        {src && <a className="pcp-iconbtn" href={src} target="_blank" rel="noopener noreferrer" title="Open full size"><Search size={13} /></a>}
        {src && <a className="pcp-iconbtn" href={src} download={name} title="Download"><Download size={13} /></a>}
      </div>
      <div className={"pcp-doc-frame" + (large && isImage && zoom !== 100 ? " zoomed" : "")}>
        {isImage && src ? (
          zoom === 100
            ? <a href={src} target="_blank" rel="noopener noreferrer" title="Click to open full size"><img src={src} alt={name} /></a>
            : <img src={src} alt={name} style={{ width: zoom + "%" }} />
        ) : isPdf && src ? (
          /* The PDF viewer reads the zoom from the URL fragment; the key
             reloads it when the zoom changes. Its own toolbar also zooms. */
          <iframe
            key={large ? zoom : "pdf"} title={name}
            src={large && !src.includes("#") ? src + (zoom === 100 ? "#view=FitH" : "#zoom=" + zoom) : src}
          />
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

/* `large`: bigger tiles and previews (Reimbursement module), so receipts can
   be read without opening each one. Click an image to open it full size. */
/* large="xl": larger still — the Approval Module, where documents are checked
   before approval. Large tiles get zoom in / out / fit controls. */
function AttachmentGallery({ attachments, emptyLabel, renderFooter, large }) {
  const list = attachments || [];
  if (!list.length) {
    return <div style={{ fontSize: 12, color: "var(--text-mut)" }}>{emptyLabel || "No documents attached."}</div>;
  }
  return (
    <div className={"pcp-doc-gallery" + (large ? " pcp-doc-gallery-lg" : "") + (large === "xl" ? " pcp-doc-gallery-xl" : "")}>
      {list.map((a, i) => (
        <AttachmentTile key={a.id || (a.name || "document") + i} att={a} renderFooter={renderFooter} large={large} />
      ))}
    </div>
  );
}
