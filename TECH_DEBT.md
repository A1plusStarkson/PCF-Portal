# Tech Debt / Known Limitations

Pragmatic notes on things that work today but should be addressed before the
app scales (more users, heavier concurrent editing, or larger file volume).
Ordered by priority.

## 1. Move uploaded files out of the state blob into Supabase Storage
**Now:** Receipts, PCF documents, and reimbursement attachments are read with
`readAsDataURL` and stored as base64 strings *inside* the single app-state JSON
blob (see `src/18b-pcf-documents.jsx`, `src/11-liquidation.jsx`,
`src/22-reimbursement.jsx`).
**Problem:** Base64 inflates files ~33%, every save re-uploads the entire blob,
and it all counts against the Supabase free-tier 500 MB limit.
**Fix:** Upload files to Supabase Storage buckets and keep only a URL/reference
in the state.

## 2. ~~Split the single state blob into per-record tables~~ — DONE
`pcp_records` is now the single source of truth: one row per record, and the
portal keeps no copy of its own. The whole-state blob, the browser cache of the
data and the rolling snapshot/auto-restore system are all gone.

They were not merely redundant, they were actively harmful:
- the blob's union merge kept the **superset** of the server's copy and any
  blob a browser uploaded, so one stale tab re-seeded deleted records for
  everybody;
- the auto-restore refilled the database from a browser's own snapshot whenever
  the live state loaded empty, which made a deliberate wipe impossible to
  complete;
- three stores meant three answers, which is why two accounts could look at the
  same database and see different data.

Backups are now Supabase's own (daily, 7-day retention on Pro; PITR is a paid
add-on). Live sync is Supabase Realtime, failing soft to the previous
converge-on-page-load behaviour.

**Remaining cleanup:** `mergeStateValues`, `stripPayloadsJSON`, the snapshot
pruning inside `storage.set`, and `MERGE_COLLECTIONS` in `index.html` are now
dead. `loadLegacyBlob` (`src/02-helpers.jsx`) and the `pcp_state` read are kept
for one purpose only — migrating a project whose `pcp_records` is empty. Once
no such project exists, delete both and drop the `pcp_state` table.

### Related: PCF Requestor role is enforced at the CLIENT layer only
The `Requestor` role (see `ROLES` in `src/05-master-data.jsx`, flags in
`src/19-app.jsx`) enforces its permissions in the app UI/logic:
- Petty Cash Requests — full access (no approve/reject/release)
- Release Ledger — view-only (`canEdit` gate in `src/10-disbursements.jsx`)
- Liquidation — full access except approve/reject (`isLiquidationApprover`)
- Per-entity data isolation via existing plant scoping (`allowedPlants`)

Because RLS on `pcp_state` only checks *authenticated* (not role/plant), a
signed-in Requestor could still bypass these limits by calling the Supabase API
directly. **True database/API-level role + entity isolation depends on this
per-record-table refactor** (or an Edge Function that validates every write).
Until then, the Requestor restrictions are UX/workflow controls, not a hard
security boundary.


### Related: document numbers are unique per client, not per database
`nextSeriesNo()` in `src/02-helpers.jsx` derives the next number from the
highest one already in use and steps past anything taken, so a single client
can no longer hand out a duplicate (the old `list.length + 1` pattern did, as
soon as a record was deleted). Request No. uses it; **the remaining series still
use `list.length + 1`** and carry the old flaw:
- `nextVoucherNo` — `src/19-app.jsx`
- `nextReimbNo` — `src/19-app.jsx`, `src/22-reimbursement.jsx`
- replenishment `nextNo` — `src/15-replenishment.jsx`

Switching them over is a one-line change each (`nextSeriesNo(prefix, list)`).

Separately, uniqueness is still only as good as the data the client has loaded:
two people creating a request at the same moment on different machines can both
be handed the same number. `computeIntegrityReport()` surfaces that after the
fact (System Settings → Data Integrity → "Duplicate request numbers"). A real
fix needs a database sequence or a unique index, which depends on the
per-record-table refactor above.

## 3. Automated Supabase backups + audit-log integrity
**Now:** Backups rely on the in-app snapshot mechanism
(`src/02-helpers.jsx`), and the audit log lives in the same mutable blob a
SuperAdmin could overwrite.
**Fix:** Schedule regular Supabase database exports, and consider storing the
audit trail in an append-only table.

---

_Current verdict: acceptable for a ~10-user internal tool. These are upgrades
for scale/robustness, not blockers._
