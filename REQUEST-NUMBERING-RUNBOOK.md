# Request Numbering — Recovery and Per-Plant Series

Two jobs, in this order:

1. **Recover** the deleted requests, and prove every issued number is accounted for.
2. **Switch** the request series from one portal-wide run to one run per plant.

## Why the numbers looked wrong

`PCR-2026-####` is a **single series shared by all four plants**. The next number is
generated from every request in the portal (`19-app.jsx`, `nextRequestNo`), but each
plant's screen only lists its own family (`19-app.jsx`, `scopedRequests`). So a number
claimed by Warner, Disney or RG is consumed from the series and never appears in the
Manila list. That is the cause of almost every gap.

The rest are deleted requests. `nextSeriesNo` (`02-helpers.jsx`) deliberately derives the
next number from the **highest number already used**, never from the record count, so a
deleted request leaves a permanent hole. Counting records would re-issue a number the
moment one was deleted.

## Order matters

**Restore before renumbering.** Renumbering is a one-time pass. Anything restored
afterwards keeps its old-format number and sits outside its plant's sequence.

---

# Phase A — Recovery

All of this runs in the Supabase SQL editor, using
`supabase-recover-deleted-requests.sql`. Sections 1 to 4b are read-only.

### Step 1 — Take a backup

Supabase Dashboard → Database → Backups. Confirm a recent daily backup exists
(7-day retention on Pro). Phase A only flips a boolean, but Phase B rewrites data.

### Step 2 — Run Section 1 (Census)

Every request number ever issued, live or deleted, with the plant that owns it.
Export this. It is the evidence for the whole exercise.

### Step 3 — Run Section 2 (Reconciliation)

`plant / live / deleted / total_ever_issued`.

- The `live` figure for a plant is what that plant sees on screen.
- Every other row is a number that plant will never show.
- `total_ever_issued` summed across plants must equal the highest number issued.

This is what proves the gaps are other plants, not lost data.

### Step 4 — Run Section 3 (Hard-delete check)

Walks the full `0001..highest` range and reports any number with **no row at all**,
not even a tombstone.

- **Empty result → nothing is lost.** Every number is recoverable or already live.
- **Rows returned →** those were removed outside the app (direct SQL, or before
  tombstoning existed). They cannot be recovered from `pcp_records` and need a
  Supabase backup restore. Stop and deal with these first.

### Step 5 — Run Sections 4 and 4b

Section 4 is the deleted list with a `verdict` column. Section 4b shows the same rows
with each linked voucher's real state, in two wide columns so the request number is
not truncated by the results grid.

Read `verdict` and `voucher_state` together:

| What you see | What it means | Action |
|---|---|---|
| `MUST RESTORE - live voucher is orphaned` | Cash was released; the voucher is live but its request is deleted | **Restore. Not optional.** The ledger is inconsistent until you do. |
| `no voucher ever issued` | No cash was ever released against it | Judgement call |
| `voucher ... (DELETED TOO)` | Request and voucher were both deleted, in the correct order | Judgement call — but treat the pair as one unit |

### Step 6 — Decide, and write the decision down

For each deleted request, decide with the plant's custodian whether it belongs back on
the books. Some deletions were intentional — duplicates, cancelled requests, encoding
errors — and restoring one puts it back in the plant's list, dashboard and reports.

Restoring a request never moves cash by itself. Fund balance is derived from
disbursements and replenishments, never from requests (`02-helpers.jsx`, `fundStats`:
`beginning - liquidated - outstanding + replenished`).

Two things to record before moving on:

- Any request deleted while its status was **Disbursed** deserves a written
  explanation, even when the deletion was done correctly. Auditors ask about these.
  The `Deleted` entries in the Audit trail show who and when.
- If the request's employee is also the plant's **custodian**, note that too.

### Step 7 — Restore the requests, and any paired voucher

**The Supabase SQL editor does not hold a transaction open between separate Run
clicks.** The connection returns to the pool and anything uncommitted is rolled back.
A `begin;` in one Run followed by `commit;` in the next Run discards the change —
and the result grid still shows `deleted = false`, so it looks like it worked.

Decide first, using Sections 4 and 4b. Then edit Section 5 and run it as **one block**;
it carries its own `commit;`.

Section 5 restores the request and its voucher together, request first, so the ledger
never holds a live voucher whose request is still deleted. If the request's status is
`Disbursed` and its voucher was deleted too, they must come back as a pair.

To undo a restore, run Section 5b — same statements reversed, voucher first.

### Step 9 — Run Section 6

Sweeps every live voucher in the ledger, not only the ones you touched, and reports any
whose request is missing or still deleted. **An empty result means the ledger is
consistent.**

### Step 10 — Everyone reloads the portal

The app keeps no local copy of the data, so a page reload is the whole deployment.
Confirm the restored requests appear in their plant's list.

---

# Phase B — Per-plant series

### Step 11 — Decision taken: renumber

Every plant restarts at `0001` in date order, fully contiguous. The old number is
preserved in a `legacyRequestNo` field on each record, so paperwork already issued
stays traceable to the new number.

### Step 12 — Code change (4 files) — DONE

| File | Change |
|---|---|
| `05-master-data.jsx` | Add `requestNoPrefix(branchCode)` after `PLANT_FAMILIES`: `A1+`→`PCR-M-2026-`, `WARNER`→`PCR-W-2026-`, `ST`→`PCR-D-2026-`, `RG`→`PCR-RG-2026-`. Resolves through `plantOfBranch()` so Hasbro, D6 and the rest inherit their plant's prefix. Lives here, not in `02-helpers.jsx`, because `02` loads first and cannot see `plantOfBranch` at top level. |
| `02-helpers.jsx` | Remove `REQUEST_NO_PREFIX`. `nextSeriesNo` itself is unchanged — it already filters `existing` by the prefix it is given. |
| `19-app.jsx` | Turn `nextRequestNo` from a string into `nextRequestNoFor(branchCode)`. The plant is chosen **inside the form** and can change while it is open, so the number has to be derived per plant. Still checked against the **full** request list, so two plants cannot collide. Same in `addRequest`, from `form.branchCode`. |
| `09-requests.jsx` | Displayed Request No. follows the selected plant, and updates when the plant changes — unless Accounting has typed an override, which is never overwritten. Update the placeholder and the local fallback. |

Nothing in disbursements, liquidation, reports or the Acumatica export needs to change:
`requestNo` is display-only, and the real link is `requestId`.

### Step 13 — Deploy the code

Deploy before renumbering. Deploying alone is always safe: new requests start at
`PCR-M-2026-0001` and the old `PCR-2026-####` records are left alone.

### Step 14 — Renumber

Script: `supabase-renumber-requests-per-plant.sql`. Run in a quiet window and tell
users not to create requests until it is done. Sections in order:

1. **Backup** — a verbatim copy of every request row into a `pcp_backup` schema, which
   is not reachable through the REST API.
2. **Build the mapping** — old → new for every live request, per plant, in date order.
   This table is what gets applied, so the preview cannot disagree with the update.
3. **Preview and safety checks** — counts per plant, the full old → new list to export,
   plus collision, uniqueness and coverage checks. **All three must return 0 rows
   before you proceed.**
4. **Apply** — one block, own `commit;`.
5. **Verify** — per-plant contiguity, no duplicate numbers anywhere, every live voucher
   still resolves to its request, and the old → new mapping for your paper trail.
6. **Undo** — commented out. Restores every request row verbatim from the backup.

Tombstones keep their original `PCR-2026-####` numbers: the audit trail keeps the
number each record was deleted under, and the live lists stay contiguous. **This is why
recovery comes first** — a request restored after this runs sits outside its plant's
sequence and has to be renumbered by hand.

### Step 15 — Verify

1. Each plant tab: numbers run `0001` upward with no gaps (Option 2).
2. Create a test request in Manila and one in Warner — correct prefix, correct next
   number in each.
3. Change the plant while the form is open — the number follows.
4. Dashboard, Transaction History and Reports still match request to voucher.
5. Integrity report shows no duplicate request numbers
   (`02-helpers.jsx`, `duplicateRequestNos`).

---

# Phase C — Every module per plant; numbers issued once, never reused

This phase fixes the count-based voucher number that used to be listed here as a known
issue, and the same bug in the reimbursement number.

### The rule

**Once a series number has been issued it is never issued to another transaction.** That
holds after a delete, rejection, edit or resubmission, and when a record moves to another
plant or module. It also holds when two people save at the same instant. A deleted
number leaves a permanent gap. **Nothing is ever renumbered to close a gap.**

| Module | Format | Notes |
|---|---|---|
| Petty Cash Request | `PCR-M-2026-0001` | RG & Co is now `RGC` (was `RG`) |
| Release Ledger | `PCV-M-2026-0001` | **Takes its request's number** (`PCR-M-2026-0007` → `PCV-M-2026-0007`) |
| Liquidation | — | Filed under its voucher's number; has none of its own |
| Reimbursement | `RMB-M-2026-0001` | Was `REIM-2026-000001`, one series for all plants |
| Replenishment | `RPL-M-2026-0001` | Was `PCRP-2026-0001`, one series for all plants |

Plant letters: Manila `M`, Disney `D`, Warner `W`, RG & Co `RGC`. Each module counts separately
per plant and per year. The year is the year the number is **issued**.

### How it is enforced (`supabase-series-guard.sql`)

- **`pcp_series_counters`**: one counter per series, only ever incremented, inside the database.
  Simultaneous saves queue on the counter row and get consecutive, different numbers.
- **`pcp_series_registry`**: every number ever issued or used, with the record it belongs to.
  The number is the primary key, so a duplicate cannot exist. The table is append-only
  (a trigger refuses updates and deletes), so a deleted transaction's number stays retired.
  One registry covers all modules.
- **`pcp_issue_series_no` / `pcp_claim_series_no`**: the only way the app gets a number. The app
  **refuses to save** when the database cannot issue one; it never invents a number.
  Single-user local mode, which has no database, is the one exception.
- **`pcp_series_guard` trigger** on `pcp_records` refuses any write, from the app, the API or SQL,
  that would put a registered number on a different record. If it refuses a row, the
  portal saves the rest of that batch and alerts the user.

### Behaviour in the app

- Forms show **"Assigned when saved"**; the number appears once the record is saved.
- **Delete** (only `superuser@a1plus.com`, all five modules): shows the confirmation *"Are you sure
  you want to delete this transaction? This action cannot be undone."* and requires a reason.
  The number is retired and nothing else is renumbered. Number, plant, reason, user and time
  go to the Audit Trail and onto the deleted row (`deletedNo`, `deletedPlant`, `deleteReason`,
  `deletedBy`, `deletedAt`).
- **Re-release after a voucher delete**: the request keeps its number, but the old voucher
  number is retired, so the new voucher is `PCV-M-2026-0007-1`, still visibly tied to its request.
- **Plant change** on an unreleased request, reimbursement or replenishment: it gets a new number
  in the new plant's series, and the old one is retired. A released request cannot change plant.
- **No manual numbers**: nobody, Accounting and SuperAdmin included, can type or change a Request
  or Reimbursement No. (since Sep 2026).
- A renumbered record shows its previous number as "was …".
- A liquidation or reimbursement already claimed by a replenishment cannot be deleted.

### Steps, in this order

1. **`supabase-series-guard.sql` PART A**, **before deploying**. It creates the counters,
   registry and functions, registers every existing number, and starts each counter after
   the highest number used. The new app cannot save anything until this has run.
2. **Deploy** the app; everyone reloads (Ctrl+F5).
3. **`supabase-renumber-series-per-plant.sql`**, in a quiet window with everyone out of the
   portal. It renames RG → RGC, gives vouchers their request's number, and moves
   reimbursements and replenishments onto per-plant series. Nothing is compacted or reused,
   and every new number is claimed in the registry. Check 3c must be empty.
4. **`supabase-series-guard.sql` PART B**: switches on the enforcing trigger. It refuses to switch
   on while two live records share a number.
5. **`supabase-delete-gate.sql`**: only the superuser can delete through the API.
