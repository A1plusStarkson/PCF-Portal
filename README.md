# Petty Cash Fund (PCF) Portal

A web-based **Petty Cash Management System** for tracking petty cash funds across
multiple companies, plants, and branches. It handles the full petty cash
lifecycle — requests, disbursements, liquidation, reimbursement, replenishment,
aging, approvals and management reporting — with role-based access and a shared
cloud database.

It is a **single-page React app with no build step**, deployed as static files to
GitHub Pages, with **Supabase** as the single source of truth for data and login.

> **Live site:** <https://a1plusstarkson.github.io/PCF-Portal/>
> Published from `main` by GitHub Actions, HTTPS enforced.

---

## Purpose

The portal replaces spreadsheet-based petty cash tracking with a single,
auditable app that lets custodians, accounting, and finance:

- **Request** petty cash and track approvals.
- **Disburse** funds and maintain a release ledger.
- **Liquidate** expenses against issued funds, receipt by receipt.
- **Reimburse** employees for expenses they paid out of pocket (policy AF P16).
- **Replenish** funds back to their float amount.
- **Approve** liquidations and reimbursements from one cross-plant queue.
- **Monitor aging** of unliquidated balances against a 5-day deadline.
- **Generate print-ready management reports** and export to Excel/CSV.
- **Export** to an Acumatica "Purchase Orders Template".
- **Store PCF documents** in a categorized repository with version history.
- **Audit** every action via a full audit trail.

Each user only sees the plants they are authorized for, so custodians see their
own funds while Accounting/Finance see everything.

---

## Modules

| Module | Scope | What it does |
|--------|-------|--------------|
| **Dashboard** | per plant + consolidated | KPI cards, fund monitoring, charts, drill-down into any module. |
| **Petty Cash Requests** | per plant | Raise and approve requests; auto-numbered `PCR-YYYY-NNNN`. |
| **Release Ledger** | per plant | Records each cash release (voucher) against an approved request. |
| **Liquidation** | per plant | Per-receipt amounts, duplicate detection, reconciliation against the released amount, and the Cash Settlement step (refund / reimbursement / exact). |
| **Reimbursement** | per plant | Employee out-of-pocket claims under policy AF P16 — validation engine, approval, liquidation and payment stages. |
| **Replenishment** | per plant | Tops the fund back up to its float. |
| **Transaction History** | per plant | One chronological view of every record. |
| **Reports** | per plant | The Report Center — 15 print/PDF report types plus Excel/CSV builders. |
| **Approval Module** | all plants | One queue for everything awaiting a decision: petty cash liquidations and employee reimbursements. |
| **Liquidation Aging** | all plants | Aging engine with buckets, editable balances and exports. |
| **PCF Documents** | system-wide | Categorized document repository — upload, preview, version history, archive. |
| **Audit Trail** | system-wide | Immutable log of every action, tagged with the signed-in user. |
| **Funds & Master Data** | system-wide | Plants, custodians, beginning balances, sub-accounts, tax and expense categories. |
| **User Management** | system-wide | Read-only roster of accounts, roles and plant access. |
| **System Settings** | system-wide | Environment, storage, and the Data Integrity & Reconciliation panel. |

The sidebar groups these as **Overview** (consolidated dashboard, when the user
has more than one plant), then **one group per plant**, then **Approvals**,
**Monitoring** and **Administration**.

---

## Tech Stack

- **React 18** (in-browser, via esm.sh) — no bundler, no `npm install`.
- **Babel Standalone** for in-browser transpilation.
- **Recharts** for charts.
- **SheetJS (xlsx)** for Excel/CSV export.
- **lucide-react** for icons.
- **Supabase** for the shared database, authentication and live sync.
- **GitHub Pages** for hosting.

---

## How It Works

There is no build step. The app runs directly in the browser:

1. `index.html` loads Babel Standalone and an importmap (react, react-dom,
   recharts, xlsx, lucide-react).
2. A small inline loader fetches the ordered fragments listed in
   `window.PCP_SRC_FILES`, concatenates them, transpiles once with Babel, and
   runs the result as one ES module.

The app in [`src/`](src/) is split into ordered fragments that all share one
scope — see [src/README.md](src/README.md) for the full file map and
troubleshooting guide. **The order of `PCP_SRC_FILES` matters** and must not be
rearranged; later fragments depend on earlier ones.

---

## Data Storage & Login

**Supabase is the single source of truth.** Every record lives in one row of
`pcp_records`, and the portal keeps no copy of its own — no browser cache of the
data, no rolling snapshots. That is deliberate: while it kept its own copies, a
stale device could re-seed the shared database and resurrect deleted records, and
two accounts could see different data (see [TECH_DEBT.md](TECH_DEBT.md) item 2).

| Table | Purpose |
|-------|---------|
| `pcp_records` | One row per record (`id`, `collection`, `data` jsonb, `deleted`, `updated_at`). This is what the app actually runs on. |
| `pcp_state` | Legacy whole-state blob, kept **only** to migrate a project whose `pcp_records` is still empty. |

If `pcp_records` is missing, the portal shows a **"Database setup incomplete"**
banner — run the setup SQL below.

Writes are queued and flushed on an 800 ms debounce, with a `keepalive` REST
flush on `pagehide` / tab-hide so the last edit is not lost when a tab closes.

### Live sync

Live updates use **Supabase Realtime** and **fail soft** — without it the portal
simply converges on page load, as it always did. Realtime needs two things in the
project:

1. the `realtime` schema present (repeated
   `42P01 relation "realtime.subscription" does not exist` in the Postgres logs
   means it is not — ask Supabase support to re-run the realtime migrations), and
2. `pcp_records` added to the `supabase_realtime` publication
   (Table Editor → `pcp_records` → enable Realtime).

Check `window.PCP_LIVE_SYNC` in the browser console to see which mode is active.

### Backups

Backups are **Supabase's own**: a daily backup with 7-day retention on the Pro
plan. Restore from **Supabase dashboard → Database → Backups**. Point-in-time
recovery (PITR) is a paid add-on, worth enabling if a finer recovery point is
ever needed. Because the portal keeps no local snapshots, a mistaken deletion has
to be reported the same day it happens.

### Setting up a Supabase project from scratch

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase **SQL editor**, run [`supabase-setup.sql`](supabase-setup.sql).
   It is idempotent and safe to re-run: it creates `pcp_state` and `pcp_records`,
   their indexes, and authenticated-only Row Level Security policies, then prints
   a verification query.
3. In **Authentication → Providers**, turn **off** "Allow new users to sign up",
   then add each user under **Authentication → Users → Add user** (email +
   password). Use the same emails listed in `window.PCP_USERS`.
4. In **Project Settings → API Keys**, copy the Project URL and the
   **publishable key** (`sb_publishable_…`) into `window.PCP_SUPABASE_URL` and
   `window.PCP_SUPABASE_PUBLISHABLE_KEY` in `index.html`. (Projects created
   before the new key format show an `anon public` JWT instead — it goes in the
   same place.)
5. Enable Realtime on `pcp_records` (see above).

The publishable/anon key is safe to commit because it is protected by Row Level
Security. Leaving the keys blank drops the app into **local mode**
(`localStorage`, no login) — useful offline, not for production.

### Passwords

There is **no self-service password reset**, by deliberate choice: the accounts
are standalone identifiers rather than real mailboxes, and no SMTP is configured,
so a reset email could never be delivered. The login screen therefore points
users at the administrator instead of offering a button that cannot work.

- **A user forgot their password** — an admin sets a new one in **Supabase
  dashboard → Authentication → Users**, then passes it on. No email involved.
- **A user wants to change their own** — sidebar → **Change password** (minimum
  8 characters, hashed server-side by Supabase).
- **Adding a new account** — **Authentication → Users → Add user**, and **tick
  "Auto Confirm User"**. Without it Supabase waits on a confirmation email that
  can never arrive, and the person can never sign in. Remember to add them to
  `window.PCP_USERS` in `index.html` too, or they sign in with no plant access.

`PCP_AUTH.resetPassword` is left in place in `index.html`, so restoring the
self-service flow is a small change to
[src/20-auth-gate.jsx](src/20-auth-gate.jsx) once real mail delivery exists. That
would also need **Authentication → URL Configuration** to list the deployed site
URL under Site URL and Redirect URLs.

---

## Access Control

Two independent layers: **role** (which modules you see) and **plant scope**
(which records you see). Both are configured in `index.html`.

### Roles

| Role (`window.PCP_USERS`) | Label | Modules |
|---|---|---|
| `SuperAdmin` | System Administrator | Everything. The **only** role that can delete records. |
| `Accounting` | Accounting Department | Everything. The **only** role that can override a Request No. |
| `Finance` | Finance Department | Everything except User Management and System Settings. |
| `Custodian` | Custodian | Dashboard, Requests, Release Ledger, Liquidation, Reimbursement, Replenishment, History, Reports, Approval Module, Aging, Documents. |
| `Requestor` | PCF Requestor | Requests, Release Ledger (view-only), Liquidation, Reimbursement, History. No approve/reject/release rights, no dashboard. |

Petty cash liquidations are approved at **two levels** (constants in
[src/11-liquidation.jsx](src/11-liquidation.jsx), status engine in
[src/02-helpers.jsx](src/02-helpers.jsx)):

1. **Custodian review** — any `LIQUIDATION_CHECKER_ROLES` account (Custodian,
   Accounting, Finance, SuperAdmin), within its plant scope: decides each
   receipt, approves the liquidation, records the cash settlement.
2. **Final approval** — `LIQUIDATION_FINAL_APPROVER_EMAILS` (Grace Gan and the System Superuser, who have identical access) only.
   Their queue holds only custodian-approved, cash-settled liquidations; their
   approval makes them `LIQUIDATED` and *Ready for Replenishment*, and locks them.
   A final approver is never also a checker — so in practice the checkers are the
   Custodian, Accounting and Finance accounts.

A replenishment claims the approved liquidations it covers (`liquidationIds`),
so none is replenished twice. Liquidations completed before this workflow
(no `workflow` flag) keep their status and are not offered for replenishment.

Accounts in `window.PCP_ADMIN_EMAILS`, plus the `Accounting` and `SuperAdmin`
roles, can **view as** any other role — an honest preview: the permission flags
check both the assigned role *and* the role being viewed, so previewing grants
nothing.

> ⚠️ Role restrictions are enforced in the client. RLS on `pcp_records` only
> checks *authenticated*, so a signed-in user could bypass them by calling the
> Supabase API directly. See [TECH_DEBT.md](TECH_DEBT.md) for what a hard
> boundary would require.

### Plants and branches

A **plant** is a site that holds a fund; the branches under it draw on that same
fund. Access is granted per branch code and **widens to the whole plant family**,
so a grant can never cover part of a plant:

| Plant (fund holder) | Family | Company | Custodian | Beginning balance |
|---|---|---|---|---|
| **Manila** (`A1+`) | A1+, EURASIA, HASBRO, SITIO, MATTEL, PERULANDIA | A1+ Multinational Packaging, Inc | Maureen Felix | ₱600,000 |
| **Warner** (`WARNER`) | WARNER | A1+ Multinational Packaging, Inc | Angelita Bayani | ₱150,000 |
| **Disney** (`ST`) | ST, D1, D2, D3, D5, D6, D7, D8, D9 | Starkson Packaging, Inc. | Pura Barloso | ₱700,000 |
| **RG and Co.** (`RG`) | RG | RG & Co. Property Management Corporation | Pura Barloso | ₱300,000 |

`plants: "ALL"` resolves to **every branch in the master**, not just the four
fund-holding codes — otherwise management would be blind to records filed against
a sub-branch. Keep the groups in `index.html` in sync with `PLANT_FAMILIES` in
[src/05-master-data.jsx](src/05-master-data.jsx).

---

## Running Locally

No build required. Serve the folder with any static web server:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

Then open `http://localhost:8000`.

> Opening `index.html` directly via `file://` will fail — the loader uses
> `fetch()`. Use a local static server.

---

## Deployment

The portal is live at <https://a1plusstarkson.github.io/PCF-Portal/>.

The repo deploys to **GitHub Pages** automatically. The workflow
[`.github/workflows/static.yml`](.github/workflows/static.yml) publishes the
**entire repository** on every push to `main`, and can also be run manually from
the Actions tab. The repository's **Settings → Pages → Source** is set to
**GitHub Actions** (leave it there — switching it to a branch source breaks this
workflow), and HTTPS is enforced.

Because the whole repo is published, everything committed here is publicly
readable — keep secrets out of it. The publishable Supabase key is the only key
that belongs in `index.html`.

Files that matter at runtime:

- `index.html` — the loader and all configuration.
- `src/` — every fragment listed in `PCP_SRC_FILES`.
- `SPI PAPER LOGO.png`, `A1 PAPER LOGO.png`, `HAMFI LOGO.png` — the report header
  reads these by filename. RG & Co. falls back to a built-in SVG.

### Making a change

1. Edit the relevant `src/*.jsx` file.
2. **Bump `window.PCP_SRC_VERSION`** in `index.html` (e.g. `20260918b` →
   `20260918c`). This busts the browser cache — skipping it is the usual reason
   a change does not show up.
3. Commit and push to `main`; the workflow deploys it.
4. Hard-refresh (**Ctrl + F5**) to confirm.

---

## Project Structure

```
index.html                   # Loader, importmap, Supabase + access config
src/                         # App source, ordered fragments (see src/README.md)
supabase-setup.sql           # One-time project setup (idempotent)
supabase-wipe-data-only.sql  # Clears transaction data, keeps the schema
.github/workflows/static.yml # GitHub Pages deployment
*.png                        # Report logos, read by filename
USER_GUIDE.md                # Plain-language guide for end users
TECH_DEBT.md                 # Known limitations and planned upgrades
PettyCashPortal.jsx          # Original monolithic version (kept as a backup)
tools/build_ppt.py           # Generates the presentation deck
```

## Further Reading

- [src/README.md](src/README.md) — source map, change workflow, troubleshooting.
- [USER_GUIDE.md](USER_GUIDE.md) — plain-language guide for end users.
- [TECH_DEBT.md](TECH_DEBT.md) — known limitations (file storage, document
  numbering, API-level role isolation).
