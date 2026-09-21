# Receipt storage migration — runbook

Getting uploaded receipts and PCF documents out of the transaction record: the
existing backlog into `pcp_files` by SQL, everything new into the
`pcf-receipts` Storage bucket.

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

## Why it was unsafe to fix any other way

`saveLiquidation` rebuilds each attachment from in-memory state and upserts the
whole record. So "just stop loading the bytes" would have meant the next save
wrote attachments with no `data` — and the upsert replaces the entire `data`
column. **The receipts would have been destroyed by the first person to edit a
liquidation.**

Bytes held outside the record cannot be erased by a record write. That is the
property being bought here, and it is worth more than the speed.

## Where files live: three places, on purpose

| | what | written by |
|---|---|---|
| `attachments[].data` / `dataUrl` | the original inline bytes | nothing any more — legacy |
| `pcp_files` | the 60 legacy files, moved out by SQL | the migration script, once |
| `pcf-receipts` bucket | **every new upload** | the app, from deploy onward |

`useFileUrl` in [src/02-helpers.jsx](src/02-helpers.jsx) resolves all three
(inline → path → fileId), so no record is ever stranded by where its bytes
happen to sit.

**Why the split.** The bucket is the better home — 100 GB included on Pro
against 8 GB of database, scans excluded from database backups, images served
over the CDN. A new upload is already on the user's machine, so sending it
there costs nothing extra; in fact less, since base64 inflates a file by ~33%
and the bucket takes raw bytes.

The 60 files already inside `pcp_records` are a different problem. Moving them
to the bucket means pulling them out of Postgres and pushing them back up.
Into `pcp_files` it is one `INSERT … SELECT` that never leaves the database
host, takes about a second, and cannot half-fail.

So: the backlog goes the cheap way, everything new goes the right way. The
accepted cost is that ~54 MB of old scans stay in the database and its backups
— finite, never grows, and it can be moved to the bucket later at leisure.

## Order of operations

Each step is safe to stop at. Nothing is destructive until step 7.

| # | Step | File | Reversible |
|---|---|---|---|
| 1 | Full backup | (below) | — |
| 2 | Create the table | `supabase-files-setup.sql` | yes |
| 3 | Create the bucket | `supabase-storage-setup.sql` | yes |
| 4 | Deploy the app | `index.html` + `src/` | yes |
| 5 | Migrate the backlog | `supabase-migrate-receipts-to-files.sql` | yes — additive only |
| 6 | **Verify receipts display** | the portal | — |
| 7 | Strip the inline copies | `supabase-strip-inline-receipts.sql` | backup table only |
| 8 | Flip `PCP_RECEIPTS_OFFLOADED` to `true` | `index.html` | yes |

Steps 2 and 3 are independent and both inert — nothing reads either until the
app is deployed in step 4.

### 1 · Full backup

```sql
create schema if not exists pcf_backup;
revoke all on schema pcf_backup from anon, authenticated;

create table pcf_backup.pcp_records_predeploy_20260921 as
  select * from public.pcp_records;

select count(*) from pcf_backup.pcp_records_predeploy_20260921;   -- expect 458
```

Do this outside working hours, and not during month-end close.

### 2 · Create the table

Run `supabase-files-setup.sql`. Creates `pcp_files` with authenticated-only
RLS — the same access model as `pcp_records`. Destination for the backlog
only; nothing reads it yet.

### 3 · Create the bucket

Run `supabase-storage-setup.sql`. Creates the **private** `pcf-receipts`
bucket and four authenticated-only policies.

**Gate:** the verify query must show `public = false`. If it shows `true`,
stop — every receipt would be readable by anyone holding a URL.

### 4 · Deploy the app

From this point **new** uploads go to the bucket and the record stores only a
`path`. Existing records still carry their bytes inline and keep working —
every viewer reads through `useFileUrl`, which resolves inline → path →
fileId.

Bump `PCP_SRC_VERSION` (already at `20260921g`).

### 5 · Migrate the backlog

Run `supabase-migrate-receipts-to-files.sql`. It copies each inline file into
`pcp_files` and tags the attachment with a `fileId`, **keeping the inline
bytes**. Every migrated record briefly holds both copies; that redundancy is
the safety net.

It runs inside Postgres, so it does not matter how slow anyone's connection is.
Still prefer a quiet window: it rewrites record rows, and an edit saved at the
same instant could be overwritten.

**Gate:** the script's final query must return an **empty** "not copied" list,
and `files_stored` must equal `attachments_tagged + documents_tagged`.
Expect **60** files (59 attachments + 1 document).

### 6 · Verify

Open a liquidation, a reimbursement and a PCF document. Confirm the receipt
displays, Zoom opens, Download saves the right file.

At this point receipts still render from their *inline* copies, so this does
not yet prove `pcp_files` is good. To test that path specifically, pick a
`fileId` and confirm the row has real content:

```sql
select id, length(data) as bytes, left(data, 40) as starts_with
  from public.pcp_files order by length(data) desc limit 5;
```

Each should start with `data:image/...;base64,` or `data:application/pdf...`
and be substantial. **Do not skip this** — it is the last point at which the
migration can be abandoned by just deleting the `fileId` tags.

### 7 · Strip the inline copies

Run `supabase-strip-inline-receipts.sql`. It backs up the affected rows to
`pcf_backup.pcp_records_preinline`, then removes `data`/`dataUrl` under **two**
conditions, both required:

1. the item carries a `fileId`, and
2. a row exists in `pcp_files` with that id **and non-empty bytes**.

The second condition is the important one. A `fileId` is only a claim; this
statement deletes the last other copy of a scanned official receipt, so the
claim is verified against the actual bytes first. Anything unverified is left
inline and reported in section 2 for you to investigate.

Read section 2's output **before** trusting the result. Then run
`vacuum (analyze) public.pcp_records;` — safe any time. The `full` form
reclaims more but locks the table, so save it for a quiet window.

### 8 · Flip the switch

Set `window.PCP_RECEIPTS_OFFLOADED = true` in `index.html`, bump
`PCP_SRC_VERSION`, redeploy. Every record is now small, so the loader collapses
back to a single request and the row-at-a-time streaming stops.

## Rolling back

- **Before step 7** — delete the `fileId` tags; the inline bytes are still
  there and the portal prefers them:
  ```sql
  begin;
  update public.pcp_records r
     set data = jsonb_set(r.data, '{attachments}',
           (select coalesce(jsonb_agg(
                     case when coalesce(a->>'data','') <> '' then a - 'fileId' else a end
                     order by ord), '[]'::jsonb)
              from jsonb_array_elements(r.data->'attachments') with ordinality t(a, ord)))
   where not r.deleted and jsonb_typeof(r.data->'attachments') = 'array';

  update public.pcp_records
     set data = data - 'fileId'
   where not deleted and coalesce(data->>'dataUrl','') <> '';
  commit;
  ```
  The `coalesce(a->>'data','') <> ''` guard matters: a receipt uploaded *after*
  the deploy exists only in `pcp_files`, and stripping its `fileId` would
  orphan it.

- **After step 7** — restore from the backup table:
  ```sql
  update public.pcp_records r set data = b.data
    from pcf_backup.pcp_records_preinline b
   where r.id = b.id;
  ```

## Known follow-up: orphaned files

Removing an attachment from a liquidation, or deleting a liquidation, does
**not** delete its row from `pcp_files`. That is deliberate — deleting on
removal risks destroying a file that a still-unsaved edit would have kept.
Orphans cost storage and break nothing. The query to find them is at the bottom
of `supabase-files-setup.sql`.
