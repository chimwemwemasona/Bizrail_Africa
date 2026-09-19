> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 03 — Sales purchasing and inventory

Version 2.0 | Research MVP baseline | Status: Not started | Owner: TBD

Dependency: Prior phase domain contracts ready; implement against those interfaces. Fiscal access discovery runs from Phase 01.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. All checkboxes intentionally remain open.

## F11 — Sales quotations and invoices

- [ ] **Built:** Support quotations with expiry and conversion into a sale, cash or credit sales, item/service lines, discounts, invoice snapshots and printable receipts. Use exact decimal arithmetic and versioned tax rules. Issued documents are corrected through linked returns/credit notes, never silent edits.
- [ ] **Verified:** 3 × ZMW 10.10 plus ZMW 9.70 totals ZMW 40.00 without tax. Quote conversion and repeated sale submission create one sale. Fiscal-pending receipts cannot claim tax acceptance.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F12 — Purchases and expenses

- [ ] **Built:** Record supplier bills, direct purchases, goods receipts, operating expenses, due dates, payment source, tax treatment and supporting documents. Match a bill to an existing goods receipt rather than adding stock twice. Supplier purchase-order workflows remain release two.
- [ ] **Verified:** Credit purchase increases stock and payable once; service expense affects expense rather than stock; later supplier payment clears payable without recording a second expense.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F13 — Stock movements and costing

- [ ] **Built:** Maintain SKU, unit, opening quantity, append-only receipts/issues/returns/adjustments, weighted-average costing and configurable low-stock alerts. Services have no stock. Adjustments require reason and review. Manufacturing BOM/WIP and multi-location transfers are deferred.
- [ ] **Verified:** Receive 10 units at 20 then 10 at 30: 20 units average 25. Sell four: stock 16, cost of sales 100, inventory value 400, before tax and other costs.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F14 — Concurrent offline stock

- [ ] **Built:** Local stock is provisional. Authoritative costing uses server acceptance order with event times retained. If offline sales exceed stock, preserve the factual sale and quantity movement in a visible negative-stock exception; mark valuation/P&L provisional until reviewed receipt/cost correction. Never silently discard the sale.
- [ ] **Verified:** Two offline devices sell the last unit: both source records survive, an oversell case appears, and final valuation is withheld until a reviewed correction. Retrying sync changes neither quantity twice.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F15 — Returns and cancellations

- [ ] **Built:** Link sale returns to original quantities and original cost, prevent excess returns, and record stock recovery separately from cash refund evidence. Purchase returns reduce stock and supplier balance using reviewed posting rules. Apply fiscal credit-note requirements through the adapter.
- [ ] **Verified:** A returned unit reverses its original cost once; a refund record does not itself execute a transfer. Duplicate return requests cannot restore stock or cash twice.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —