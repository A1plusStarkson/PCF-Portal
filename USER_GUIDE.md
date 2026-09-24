# Petty Cash Portal — Easy User Guide

Welcome! This guide is for **everyone**, even if you have never used the app
before. It explains, in plain words, how to log in and how to do your job.

Take your time. You can't "break" anything — every action is saved, and the
administrator can recover data if needed.

---

## What is this app for?

It keeps track of **petty cash** (the small pool of company money used for
day-to-day expenses). It follows the money through four simple stages:

1. Someone **asks** for cash.
2. The cash is **given out**.
3. Receipts are **turned in** to show how it was spent.
4. The fund is **topped back up** so it's ready for next time.

Here is the whole journey in one picture:

```mermaid
flowchart LR
    A["1. Request<br/>Ask for cash"] --> B["2. Release<br/>Cash is given out"]
    B --> C["3. Liquidation<br/>Turn in receipts"]
    C --> D["4. Replenishment<br/>Top the fund back up"]
```

> **Reimbursement** is a separate thing: it's for paying an employee **back**
> for money they already spent from their own pocket. It has its own tab and its
> own rules — see Step 6.

---

## Words you'll see (mini dictionary)

| Word | What it really means |
|------|----------------------|
| **Petty cash** | A small amount of company money for everyday expenses. |
| **Request** | Asking for petty cash before you get it. |
| **Release / Disbursement** | The moment the cash is actually handed out. |
| **Release Ledger** | The list that records every cash release. |
| **Liquidation** | Turning in receipts to prove how the cash was spent. |
| **Receipt / Official Receipt (OR)** | The proof of purchase you attach. |
| **Cash Settlement** | The last step of a liquidation: return the leftover cash, or get paid back if you overspent. |
| **Replenishment** | Refilling the fund back to its normal amount. |
| **Reimbursement** | Paying an employee back for expenses they paid themselves. |
| **Plant** | A site that holds a petty cash fund (Manila, Warner, Disney, RG and Co.). |
| **Branch** | A location inside a plant that spends from the plant's fund (Hasbro, Disney 5, …). |
| **Custodian** | The person who takes care of the cash for a plant. |
| **Aging** | A report that shows advances not liquidated on time. |
| **Dashboard** | The home screen with balances and alerts. |

---

## Step 1 — Log in

1. Open the portal in **Google Chrome** or **Microsoft Edge**:
   **<https://a1plusstarkson.github.io/PCF-Portal/>** — bookmark it.
2. Type your **email** and **password**.
3. Click **Sign In**.

You will only see the buttons and plants that belong to your job — that's normal.

**Forgot your password?** Ask **Grace Gan** to reset it for you — there is no
self-service reset, because the portal cannot send you an email. She sets a new
one straight away and passes it to you. Once you're in, change it to something
only you know using **Change password** at the bottom of the left menu (at least
8 characters).

**To leave**, click **Sign out** at the bottom of the left menu. Give it a second
before closing the tab so your last edit finishes saving.

```mermaid
flowchart TD
    S([Open the portal link]) --> L[Type email and password]
    L --> C{Correct?}
    C -- Yes --> H[You're in! You see your menu]
    C -- No --> F[Ask Grace Gan to reset your password]
    F --> L
```

---

## Step 2 — Find your name and role

Every person has an account. Find yourself in this list to know what you can do
and which plants you'll see.

| Your email | Your name | Your role | Plants you see |
|------------|-----------|-----------|----------------|
| `a1plusadmin@a1plus.com` | Grace Gan | System Administrator (the boss account) | All |
| `superuser@a1plus.com` | System Superuser | System Administrator — same access as Grace Gan, plus custodian review | All |
| `accounting@a1plus.com` | Accounting Department | Accounting (full access) | All |
| `finance@a1plus.com` | Finance Department | Finance | All |
| `puradr@a1plus.com` | Pura Barloso | Custodian | Disney + RG and Co. |
| `lita@a1plus.com` | Angelita Bayani | Custodian | Warner |
| `mauwi@a1plus.com` | Maureen Felix | Custodian | Manila |
| `pcfrequestordisney@a1plus.com` | PCF Requestor – Disney | Requestor | Disney |
| `pcfrequestormanila@a1plus.com` | PCF Requestor – Manila | Requestor | Manila |
| `pcfrequestorrgandco@a1plus.com` | PCF Requestor – RG and Co. | Requestor | RG and Co. |

### What "a plant" includes

A plant is the site that **holds the cash**. The branches under it all spend
from that same fund, so being given a plant always gives you the whole family:

| Plant | Branches it covers | Company |
|-------|--------------------|---------|
| **Manila** | A1+, Eurasia, Hasbro, Sitio, Mattel, Perulandia | A1+ Multinational Packaging, Inc |
| **Warner** | Warner | A1+ Multinational Packaging, Inc |
| **Disney** | Starkson (ST), Disney 1, 2, 3, 5, 6, 7, 8, 9 | Starkson Packaging, Inc. |
| **RG and Co.** | RG | RG & Co. Property Management Corporation |

So the **Disney requestor covers all of Starkson Packaging, Inc.**, and the
**Manila requestor covers the A1+ Multinational Packaging branches** under
Manila. Warner keeps its own fund and its own custodian, so it is not part of
the Manila requestor's plant.

Everyone sees the **same four plants** in the sidebar — you just see only the
ones you're assigned. Inside a plant, the row of tabs above the table lets you
narrow to a single branch (for example Disney 5).

> ⭐ This is also why a request filed against a branch like Hasbro or Disney 5
> appears on Accounting's and Finance's dashboard. Before, those records were
> visible only to the person who filed them and their custodian.

---

## Step 3 — Getting around the menu

The left menu is grouped, top to bottom:

| Group | What's inside |
|-------|---------------|
| **Overview** | **Consolidated Dashboard** — every plant you can see, in one view. (Only appears if you have more than one plant.) |
| **One group per plant** (Manila, Warner, Disney, RG and Co.) | That plant's own Dashboard, Petty Cash Requests, Release Ledger, Liquidation, Reimbursement, Replenishment, Transaction History and Reports. |
| **Approvals** | **Approval Module** — one queue covering *all* plants, for everything waiting on a decision. |
| **Monitoring** | **Liquidation Aging** — overdue advances across *all* plants. |
| **Administration** | PCF Documents, Audit Trail, Funds & Master Data, User Management, System Settings. |

Each plant has its **own** set of tabs, so you always know which plant you are
working in — the plant name appears in the page title.

### Sorting any list

Every list in the portal sorts the same way. **Click a column heading** to sort
by it; **click the same heading again** to flip between smallest-first and
largest-first. A small arrow shows which column is doing the sorting:

| Arrow | Meaning |
|-------|---------|
| ▼ | Largest / newest first (for example PCR-2026-0036 at the top) |
| ▲ | Smallest / oldest first (PCR-2026-0001 at the top) |

A few things worth knowing:

- Number columns sort as **numbers**, so 9 comes before 10 — not after it.
- Sorting is applied to whatever your filters and search have already narrowed
  down, and it never changes the data — only the order you see it in.
- It resets when you leave the page. Nobody else's screen is affected.
- Lists that open in a deliberate order (Aging Detail opens worst-overdue
  first; the funds and user lists keep their set-up order) stay that way until
  you click a heading yourself.

This works on Petty Cash Requests, Release Ledger, Replenishment,
Reimbursement, the Approval Module, Transaction History, Liquidation Aging,
Funds & Master Data and User Management — on **every plant**.

---

## Step 4 — What can I do? (simple version)

Think of the roles like this:

- **Requestor** = *"I fill in the forms."* You prepare requests, liquidations and
  reimbursements, but you don't hand out cash or approve anything.
- **Custodian** = *"I hold the cash for my plant."* You approve requests, release
  cash, **check and approve liquidations** (first level), settle the cash, and
  refill the fund.
- **Finance** = *"I oversee all plants"* — same as a custodian but for every
  plant, plus master data and the audit trail.
- **Accounting** = *"I run the system"* — everything Finance can do, plus User
  Management and System Settings.
- **System Administrator (Grace Gan or the System Superuser)** = *"I have the final say"* — gives the
  **final approval** on every liquidation, and is the only one who can delete data.

Here's the same thing as a checklist:

| Can you… | Requestor | Custodian | Finance | Accounting | Administrator |
|----------|:---------:|:---------:|:-------:|:----------:|:-------------:|
| Create a request | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve a request | ❌ | ✅ | ✅ | ✅ | ✅ |
| Release cash | ❌ (view only) | ✅ | ✅ | ✅ | ✅ |
| Prepare a liquidation | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Check receipts & approve a liquidation** (level 1) | ❌ | ✅ | ✅ | ✅ | ❌ |
| Record the cash settlement | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Final approval of a liquidation** (level 2) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Do a reimbursement | ✅ | ✅ | ✅ | ✅ | ✅ |
| Replenish the fund | ❌ | ✅ | ✅ | ✅ | ✅ |
| See reports & aging | ❌ | ✅ | ✅ | ✅ | ✅ |
| Use the Approval Module | ❌ | ✅ | ✅ | ✅ | ✅ |
| See PCF Documents | ❌ | ✅ | ✅ | ✅ | ✅ |
| See the Audit Trail | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit master data | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage users/settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Edit a Request No.** | ❌ | ❌ | ❌ | ✅ | ❌ |
| Delete a record | ❌ | ❌ | ❌ | ❌ | ✅ *(Grace Gan / Superuser)* |

> ⭐ **Important:** Every liquidation is approved **twice**: first by the
> **custodian** (who checks every receipt and the amounts), then by **Grace Gan or the System Superuser**
> (final approval). They only see a liquidation once the custodian has
> approved it **and** the cash difference has been settled. Only after her final
> approval does it read **LIQUIDATED** and become **Ready for Replenishment**.

> Grace Gan, the Superuser and Accounting can also **view the portal as another role** to check
> what that person sees. It's a preview only — it grants no extra powers.

---

## Step 5 — How to do your job

Pick the section that matches your role.

### 👩‍💻 If you are a Requestor
You prepare paperwork. You cannot approve or hand out cash.

1. Click **Petty Cash Requests** → **New Request**.
2. Fill in: who it's for, the department, the reason, the amount, and the
   approver. Click **Submit**.
3. Later, when the cash is released, open **Liquidation** to record how it was
   spent and **attach the receipts** (one amount per receipt).
4. **Submit** the liquidation. The custodian then checks it, and Grace Gan (or the Superuser) gives
   the final approval. If anything is wrong it comes back to you as
   **Rejected** with the reason — correct it and resubmit.
5. Use **Transaction History** anytime to check the status of your submissions.

```mermaid
flowchart TD
    A[New Request] --> B[Wait for approval]
    B --> C[Cash is released to you]
    C --> D[Open Liquidation, attach receipts & submit]
    D --> E{Custodian checks}
    E -- Problem --> R[Rejected — correct & resubmit]
    R --> D
    E -- Approved --> S[Cash difference settled]
    S --> G{Grace Gan / Superuser final approval}
    G -- Problem --> R
    G -- Approved --> L[LIQUIDATED ✅ Ready for Replenishment]
```

### 💰 If you are a Custodian
You take care of the cash for your plant, and you are the **first level of
liquidation approval**.

1. Start at the **Dashboard** to see balances and anything that needs attention.
2. In **Petty Cash Requests**, review and **approve** (or reject) requests.
3. In **Release Ledger**, **release the cash** for approved requests. An
   employee may get a new advance even while an earlier one is not yet
   liquidated — the release window lists those earlier advances for reference
   only, and the Audit Trail notes them.
4. When a liquidation is submitted, open the **Approval Module** (it opens on
   *For Custodian Review*). Check every receipt and its amount, approve or reject
   each one, then click **Custodian Approve**. If something is wrong, **Reject
   Liquidation** with a reason so the requestor can fix it.
5. In **Liquidation**, record the **cash settlement** — the refund returned to
   you, or the extra you paid the requestor. Once the cash is settled the
   liquidation goes to Grace Gan or the Superuser for final approval.
6. When the final approval is given it, it appears under **Ready for Replenishment**
   in **Replenishment** — click **Replenish** to **refill the fund**.
7. Check **Liquidation Aging** to spot advances that are overdue.

### 🧾 If you are Finance
Same as a Custodian, but for **all plants** — plus the **Approval Module**, the
**Audit Trail**, and **Funds & Master Data** (plants, custodians, chart of
accounts). You don't manage user accounts.

You also record the payment to the employee on a fully approved reimbursement,
and carry any reimbursement approved before the two-level review through its
old stages: **Mark Liquidation Completed → Move to Payment → Record Payment →
Mark Completed**.

### 🗂️ If you are Accounting
You can do everything Finance can, **plus User Management and System Settings**.
You see all plants.

You are also the **only** role that can type over a **Request No.**

The number is always filled in for you (`PCR-2026-0001`, `PCR-2026-0002`, …) and
for every other role it is greyed out. The portal takes the highest number
already in use and adds one, so deleting a request never causes the next one to
repeat a number that already exists.

In **Petty Cash Requests → New Request**, or behind the ✏️ **Edit** button, that
box is yours to change — useful when the number must match a pre-printed form or
a wrong one was keyed in. Two rules still apply:

- it cannot be left blank, and
- it cannot duplicate a number another request already uses — including one in a
  plant you don't normally see, and regardless of upper/lower case.

The portal tells you which rule you hit and keeps **Save** disabled until it is
fixed. Every change is written to the **Audit Trail** as *"Request No. Changed"*,
showing the old and the new number. A released (Disbursed) request has no Edit
button, so its number stays fixed.

### 👑 If you are the System Administrator (Grace Gan and the System Superuser)
You have full control and are the **only** person who can:

- **Give final approval to a liquidation** (or reject it). Your Approval Module
  shows **only** liquidations a custodian has already approved and whose cash
  is settled — it opens on *For Final Approval*. Your approval makes the
  liquidation **LIQUIDATED — Fully Approved / Ready for Replenishment**, and
  locks it.
- **Delete** a record.

You do not check receipts yourself — that is the custodian's level, so the two
approvals always come from two different people.
- Ask for lost data to be **restored from the Supabase daily backup**. The
  portal keeps no snapshots of its own — recovery is done in the Supabase
  dashboard, so report a mistake the same day it happens.

---

## Step 6 — Liquidation, step by step

Liquidation is where receipts meet the cash that was released.

1. Open **Liquidation** for your plant. Pick the tab for **Petty Cash Advance**
   or **Employee Reimbursement**.
2. Choose the voucher you are liquidating.
3. **Attach each supporting document** and type **that document's own amount**.
   Totals are always added up from the individual receipts, so every receipt
   stays independently checkable.
   - If the portal spots a possible **duplicate** (same receipt number, same file
     name, or same amount *and* identical file size) it warns you before you go on.
4. Encode the **expense lines** (these are what get exported to Acumatica). If
   the lines don't match the approved receipts, the portal says so — reconcile
   them before submitting.
   - **Total Expense Amount** sits directly under the Amount column and adds
     itself up as you type, so you can check it against the cash released
     without a calculator. This appears on every plant.
   - Note that **Total Receipt Amount** (up in Cash Settlement) is a *different*
     figure: it counts only supporting documents the custodian has already
     approved. It stays ₱0.00 until the receipts are approved, even when your
     expense lines are complete. That is normal, not a fault.
5. **Submit.** The amounts lock, and the liquidation reads **FOR CUSTODIAN REVIEW**.
6. The **custodian** approves each receipt and then the liquidation. Changing a
   receipt's amount afterwards sends that receipt back to *Pending* and cancels
   the custodian's approval, so what gets approved is always what was checked.
7. **Reconciliation & Cash Settlement** tells you where the cash stands, and the
   custodian records it:
   - **Exact Amount** — receipts match the cash exactly. Nothing to settle.
   - **Excess / Refund** — cash is left over. Return it; the custodian records it.
   - **Reimbursement Due** — you spent more than was released. The custodian pays
     you the difference (this one gets a review before it closes).
8. Once the custodian has approved it and the cash is settled, it reads **FOR
   FINAL APPROVAL** and goes to **Grace Gan or the System Superuser**. That approval makes it
   **LIQUIDATED** — *Fully Approved / Ready for Replenishment* — and locks it.

If a receipt is rejected, the custodian rejects the liquidation back to you — you
upload a corrected document and resubmit, and the review starts again. Grace Gan or the Superuser
can also reject at final approval. A rejection always carries an official reason
(missing receipt, unreadable receipt, incorrect amount, non-allowable expense,
and so on) plus any comment the approver typed.

---

## Step 7 — Reimbursement (money you already spent)

Use this when an employee paid out of their own pocket. There is **no** petty
cash request and **no** advance — the expense already happened.

The form has five steps: **Expense Info → Expense Lines → Documents → Review →
Submit**.

Company policy (AF P16) is built into the form:

| Rule | What it means for you |
|------|-----------------------|
| Submit within **5 working days** of the expense | Later than that and the portal flags it for review. |
| Approvals run on the **15th and the 30th** | The form shows you the scheduled approval date. |
| **Original OR / Sales Invoice required** | No receipt, no reimbursement. |
| **Max 2 MB** per supporting document | Scan or photograph at a smaller size if needed. |
| **No duplicates** | An exact duplicate claim is blocked. |
| **Not reimbursable** | Personal expenses · expenses without an official receipt · expenses without proper approval · fines and penalties · entertainment that wasn't pre-approved. |

It then goes through the **same two-level approval as a liquidation**:
**Submitted → For Final Approval (after the custodian approves) → Fully
Approved / Ready for Replenishment (after Grace Gan or the Superuser approves)**.
It then appears in the **Replenishment** module, next to the ready liquidations,
and reads *Replenished* once a replenishment includes it. Finance can record
the payment to the employee on a fully approved reimbursement.

The custodian (while it is under review) or Grace Gan / the Superuser (at final
approval) can also **Return for Revision** or **Reject** — a comment is required
for both. Every step is stamped with who did it and when, in the
reimbursement's history and the Audit Trail.

Reimbursements approved before the two-level review keep the old chain (For
Liquidation → Liquidation Completed → For Payment → Paid → Completed) until they
finish.

> 🔒 **You can never approve your own reimbursement.** The portal blocks it.

---

## Step 8 — The Approval Module

Custodians, Finance, Accounting Grace Gan and the Superuser each get an **Approval Module**
covering every plant they can see, so nothing gets missed in a tab nobody opened.
It holds two queues:

- **Petty Cash Advance** liquidations — the expense lines, the cash settlement
  and every supporting document shown inline.
- **Employee Reimbursements** — the full request with its documents and history.

What you see depends on your level:

| You are | Your queue opens on | You can |
|---------|--------------------|---------|
| Custodian / Finance / Accounting / System Superuser | *For Custodian Review* | Approve or reject each receipt, **Custodian Approve**, reject the liquidation, reopen it · for reimbursements: review every document, **Custodian Approve**, return or reject |
| Grace Gan / System Superuser | *For Final Approval* — **only** custodian-approved, cash-settled liquidations and custodian-approved reimbursements | **Final Approve** or reject |

The System Superuser works at **both** levels: custodian review and final
approval. The portal never lets anyone give the final approval to something they
approved as custodian. If the Superuser does the custodian review, Grace Gan
gives the final approval (and the other way round). Grace Gan does final
approval only.

The Superuser's Approval Module shows **everything Grace Gan's does**: the same
transactions, receipts, amounts, custodian approvals, comments and dates. It
opens the same way, on *For Final Approval* with the same counters at the top.
To do custodian review, pick *For Custodian Review* in the status filter.

Each row shows its stage: *For Custodian Review*, *Needs Correction*, *Awaiting
Settlement*, *For Final Approval*, *Fully Approved / Ready for Replenishment*,
*Replenished*, or *Rejected*. Liquidations finished before the two-level review
existed show as *Approved (before two-level review)*.

```mermaid
flowchart LR
    S[Requestor submits] --> C{Custodian checks receipts}
    C -- Problem --> X[Rejected with a reason ↩️]
    C -- Approved --> T[Cash settled]
    T --> G{Grace Gan / Superuser final approval}
    G -- Problem --> X
    G -- Approved --> R[LIQUIDATED ✅ Ready for Replenishment]
    R --> P[Replenishment]
    X --> S
```

---

## Step 9 — Liquidation Aging (who's overdue)

Advances are due **5 calendar days** after the cash is released. The Aging report
sorts everything into four buckets:

| Bucket | Days since release |
|--------|--------------------|
| **Not Yet Due** | 0–4 days |
| **Due Today** | exactly 5 days |
| **Overdue** | 6–10 days |
| **Critically Overdue** | more than 10 days |

Anything fully settled shows as **Completed**. You can filter by plant, bucket
and date, print the report, or export it to Excel. Your dashboard also warns you
the day before something is due, on the day, and every day after.

---

## Step 10 — Reports & documents

**Reports** (per plant) prints or exports 15 report types:

Petty Cash Ledger · Cash Disbursement Report · Liquidation Report ·
Replenishment Report · Outstanding Liquidation Report · Expense Summary ·
Expense by Category · Expense by Account · Monthly Summary · Dashboard Summary ·
Audit Trail Report · Transaction History · Cash Position Report · Beginning
Balance Report · Fund Movement Report.

Reports open in a new window for printing/PDF — **allow pop-ups** for the site.
Each report carries its company's logo and signatories automatically.

**PCF Documents** (Administration) is the shared filing cabinet. Drag and drop
PDF, Word, Excel, CSV, image or ZIP files; sort them into categories (PCF
Memorandum, Request Forms, Liquidation Forms, Official Receipts, Company
Policies, Audit Documents, …); preview, rename, star, replace (the old version is
kept), archive or restore. Every document gets a reference number
(`PCFDOC-2026-00001`) and its own activity log, and is filed under
*Company / Plant / Year / Month / Transaction No.*

---

## Working at the same time as others

- There is **one shared database** behind the app. Everybody is looking at the
  same records — the portal shows you the plants your account is allowed to see,
  so two people with different access see different lists of the *same* data.
- Many people can use the app **at the same time**. The app saves each record on
  its own, so your work won't erase someone else's.
- Changes from other people usually appear on your screen **automatically**. If
  live updates are unavailable, everything still lines up the moment you reload
  the page.
- Just avoid **two people editing the exact same record at the same second** — if
  that happens, the last save wins for that one item.
- After you save, wait a second or two before closing the tab so it can finish
  saving to the shared database.

---

## If something goes wrong

| What you see | What to do |
|--------------|-----------|
| Can't log in | Double-check the email/password. Ask Grace Gan for a reset — there is no self-service reset. |
| A button or tab is missing | It's simply not part of your role — that's normal. |
| The numbers look old | Refresh the page: press **Ctrl + F5**. |
| Someone else's new entry isn't showing | Refresh (**Ctrl + F5**). If it keeps happening, tell the administrator — live sync may be off. |
| "Database setup incomplete" banner | The database is missing a table. Tell the administrator. |
| "Cloud database not configured" | The app lost its connection — tell the administrator. |
| Reports won't print | Allow pop-ups for the site; the report opens in a new window. |
| A receipt won't upload | Check the file size (reimbursement documents are capped at 2 MB) and the file type. |
| I deleted something by mistake | Tell Grace Gan straight away. Restores come from the Supabase daily backup (7 days), so the sooner the better. |

---

## Quick reminders

- ✅ You only see what your role and your plants need.
- ✅ Attach clear receipts and type each receipt's own amount; blurry ones may be
  rejected.
- ✅ Liquidate within **5 days** of receiving cash.
- ✅ Submit reimbursements within **5 working days**, with the original OR.
- ✅ Custodians check and approve liquidations; only **Grace Gan and the System Superuser** give the final approval and can delete records.
- ✅ Refresh (**Ctrl + F5**) if something looks out of date.

---

*Need the technical setup (for IT)? See [README.md](README.md).*
