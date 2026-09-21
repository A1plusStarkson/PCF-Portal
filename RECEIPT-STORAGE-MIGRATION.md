# Receipt storage migration — runbook

Moving uploaded receipts and PCF documents out of the transaction record and
into a Supabase Storage bucket.

## Why

Receipts were stored as base64 data URLs **inside** the record
(`pcp_records.data -> attachments[].data`, and `dataUrl` for PCF documents).
Measured on production:

| collection | rows | payload |
|---|---|---|
| liquidations | 10 | 38 MB |
| reimbursements | 14 | 12 MB |
| documents | 1 | 3.96 MB |
| auditLog | 382 | 71 kB |
| requests | 31 | 9.5 kB |
| disbursements | 16 | 5 kB |
| funds | 4 | 520 B |

The portal loads every record on sign-in, in one request. That request carried
~54 MB, timed out, and the loader returned an empty array — which the app could
not tell apart from an empty database. **Every user saw a fully working,
completely blank portal** while 31 requests sat safely in `pcp_records`.

Ten liquidations did that. It was going to get worse every month.

## The second reason: it was unsafe to fix any other way

`saveLiquidation` rebuilds each attachment from in-memory state and upserts the
whole record. So "just stop loading the bytes" would have meant the next save
wrote attachments with no `data` — and the upsert replaces the entire `data`
column. **The receipts would have been destroyed by the first person to edit a
liquidation.**

Bytes held outside the record cannot be erased by a record write. That is the
property being bought here, and it is worth more than the speed.

## Order of operations

Each step is safe to stop at. Nothing is destructive until step 6.

| # | Step | Where | Reversible |
|---|---|---|---|
| 1 | Deploy the loader stopgap | `index.html`, `src/19-app.jsx` | yes |
| 2 | Create the bucket | `supabase-storage-setup.sql` | yes |
| 3 | Deploy the app changes | whole `src/` + `index.html` | yes |
| 4 | Migrate existing files | `tools/migrate-receipts.html` | yes — additive only |
| 5 | **Verify receipts display** | the portal | — |
| 6 | Strip the inline copies | `supabase-strip-inline-receipts.sql` | backup table only |
| 7 | Flip `PCP_RECEIPTS_IN_BUCKET` to `true` | `index.html` | yes |

### 1 · Deploy the stopgap

Gets users working again immediately, before any of the rest exists. Splits the
load so the 86 kB people actually need arrives in one fast request and the
receipt payloads stream in behind it. Also stops a failed read from being
mistaken for an empty database — which was what turned a slow connection into a
blank portal.

### 2 · Create the bucket

Run `supabase-storage-setup.sql` in the Supabase SQL editor. Creates the
**private** `pcf-receipts` bucket and four policies limiting it to signed-in
users — the same access model as `pcp_records`.

### 3 · Deploy the app changes

From this point **new** uploads go straight to the bucket; the record stores
only `{ id, name, size, type, path }`. Existing records still carry their bytes
inline and keep working — every viewer reads through `useFileUrl`, which
prefers inline bytes and falls back to a signed bucket URL.

Remember to bump `PCP_SRC_VERSION`.

### 4 · Migrate existing files

Open `tools/migrate-receipts.html`, sign in as an admin, **Scan**, then
**Run migration**. It uploads each inline file to the bucket and adds a `path`
to the record, **keeping the inline bytes**. Every migrated record briefly
holds both copies; that redundancy is the safety net.

Run it in a quiet window — it rewrites record rows, and an edit saved at the
same instant could be overwritten.

If it reports failures, re-run it. Do not proceed until it reports zero.

### 5 · Verify

Open a liquidation, a reimbursement and a PCF document. Confirm the receipt
displays, Zoom opens, and Download saves the right file. **Do not skip this** —
it is the last point at which the migration can be abandoned by simply ignoring
the `path` fields.

### 6 · Strip the inline copies

Run `supabase-strip-inline-receipts.sql`. It backs up the affected rows to
`pcf_backup.pcp_records_preinline`, then removes `data`/`dataUrl` under **two**
conditions, both required:

1. the attachment carries a `path`, and
2. an object actually exists at that path — checked against `storage.objects`.

The second condition is the important one. A `path` is only a claim that the
upload happened; this statement deletes the last other copy of a scanned
official receipt, so the claim is verified against the bucket before anything
is removed. Anything unverified is left inline and reported by section 2 for
you to investigate.

Then run the commented-out `vacuum (analyze, full) public.pcp_records;` on its
own to actually reclaim the disk.

### 7 · Flip the switch

Set `window.PCP_RECEIPTS_IN_BUCKET = true` in `index.html` and redeploy. Every
record is now small, so the loader collapses back to a single request and the
row-at-a-time receipt streaming stops.

## Rolling back

- **Before step 6** — ignore the `path` fields; the inline bytes are still
  there and the portal prefers them. Optionally delete the bucket objects.
- **After step 6** — restore from the backup table:
  ```sql
  update public.pcp_records r
     set data = b.data
    from pcf_backup.pcp_records_preinline b
   where r.id = b.id;
  ```

## Known follow-up: orphaned objects

Removing an attachment from a liquidation, or deleting a liquidation, does
**not** delete its object from the bucket. That is deliberate — deleting on
removal risks destroying a file that a still-unsaved edit would have kept.
Orphans cost a little storage and break nothing.

To find them, list the bucket and compare against every `path` in use:

```sql
select a->>'path' as path
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments', '[]'::jsonb)) a
 where not r.deleted and a ? 'path'
union
select data->>'path' from public.pcp_records
 where not deleted and data ? 'path';
```

Anything in the bucket and not in that list is safe to delete.
