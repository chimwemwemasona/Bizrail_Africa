> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 02 — Access and business onboarding

Version 2.0 | Research MVP baseline | Status: Not started | Owner: TBD

Dependency: Prior phase domain contracts ready; implement against those interfaces. Fiscal access discovery runs from Phase 01.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. All checkboxes intentionally remain open.

## F06 — Roles and isolation

- [ ] **Built:** The platform shall support owner, sales/cashier, stock/purchasing, bookkeeper, approving manager, invited accountant and restricted platform support. Permissions shall be enforced for every API, job, file, device cache and report. Separate users shall propose and approve sensitive corrections.
- [ ] **Verified:** Cross-tenant guessed IDs, exports, files and accountant business switching expose no unauthorised data. A multi-role user cannot approve their own correction.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F07 — Authentication and devices

- [ ] **Built:** Online staff sessions shall require verified contact and MFA for privileged users, idle expiry of 30 minutes and absolute expiry of 12 hours. Disablement shall revoke online sessions within 60 seconds. Device enrolment, recovery and offline grants shall be audited.
- [ ] **Verified:** Login/recovery avoid enumeration; five failed attempts in 15 minutes throttle. Expired offline leases prevent further capture until online verification. Cached data is cleared on normal logout only after pending-work handling.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F08 — Business configuration

- [ ] **Built:** Capture business identity, tax registration context, reporting period, payment accounts, products and opening balances. Only authorised users shall configure approved tax mappings. Opening stock, receivables, payables and cash balances require a balanced import and review.
- [ ] **Verified:** Opening trial balance balances and stock valuation agrees with inventory control account. Invalid imports preview row errors and do not silently commit.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F09 — Customer and supplier records

- [ ] **Built:** Maintain customers, suppliers, contact details, terms and tenant-local references; allow up to 1,000 CSV rows with duplicate suggestions and preview. Support walk-in cash customers where the fiscal mapping permits.
- [ ] **Verified:** Repeat import creates no duplicates; one contact can act as both customer and supplier without netting balances automatically. Statements expose only authorised business records.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F10 — Audit privacy and retention

- [ ] **Built:** Record actor/device, server and device time, source, reason and before/after metadata for material actions. Journals and audit entries shall be append-only to application roles. Maintain purpose-specific consent and configurable retention/legal holds.
- [ ] **Verified:** No OTP/secret is logged; optional sharing can be withdrawn; financial records follow the approved retention policy. Production retention and hosting decisions are signed before pilot.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —