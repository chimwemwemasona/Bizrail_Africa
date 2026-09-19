> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 05 — Reconciliation accounting and reports

Version 2.0 | Research MVP baseline | Status: Not started | Owner: TBD

Dependency: Prior phase domain contracts ready; implement against those interfaces. Fiscal access discovery runs from Phase 01.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. All checkboxes intentionally remain open.

## F21 — Cash bank and mobile money reconciliation

- [ ] **Built:** Maintain separate cash, bank and mobile-money accounts; compare cashbook activity with cash counts or independent statements. Auto-match only unique account/reference/currency/direction/amount evidence; support reviewed split or grouped matching and unmatched queues.
- [ ] **Verified:** Cash count variance is explicit. Two equal-amount receipts without references do not auto-match. A bank transfer between owned accounts is not revenue or an expense.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F22 — Receivables and payables

- [ ] **Built:** Provide customer/supplier subledgers, partial allocations, advances, aging and statements. Lock balances on approval; net allocations cannot exceed eligible value. Unallocated receipts/payments remain separately visible.
- [ ] **Verified:** A 100 invoice paid 30 then 70 closes its receivable. Supplier bill payment clears payable. Reversal of 20 reopens the original balance and retains all history.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F23 — Corrections and fee reconciliation

- [ ] **Built:** Require separate maker/approver for manual matching adjustments, journal corrections and write-offs, with evidence and compensation records. Distinguish merchant-reported receipts from externally reconciled funds. Track gross, fees and net independently.
- [ ] **Verified:** 100 gross less 2 fee expects 98; actual 97 raises a 1 variance without changing invoice value. Concurrent approvals cannot consume the same available amount twice.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F24 — Core accounting and period control

- [ ] **Built:** Use accrual double-entry accounting with perpetual inventory, an accountant-approved posting map, trial balance and period lock. Reopening requires approved reason; late synced items for locked periods await reviewed posting into an allowed period with original dates retained.
- [ ] **Verified:** Sales, cost of sales, purchases, expenses, tax, returns and settlements balance. No silent backdating into locked periods or duplicate revenue from imported deposits.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F25 — Owner financial reports

- [ ] **Built:** Provide actual cash inflows/outflows and balances, basic P&L, receivable/payable aging, stock valuation and downloadable CSV/PDF records filtered by period. Show data freshness, unsynced-device caveats, unreconciled value and provisional costing.
- [ ] **Verified:** Reports reconcile to the trial balance and subledgers at the same snapshot. Loan proceeds/capital are not sales; inventory purchases are not immediately expensed as cost of sales. Export protects against formula injection.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —