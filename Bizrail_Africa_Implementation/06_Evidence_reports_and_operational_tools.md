> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 06 — Accountant access and financing readiness

Version 2.0 | Research MVP baseline | Status: Not started | Owner: TBD

Dependency: Prior phase domain contracts ready; implement against those interfaces. Fiscal access discovery runs from Phase 01.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. All checkboxes intentionally remain open.

## F26 — Accountant portal

- [ ] **Built:** Allow an accountant to accept invitations from multiple businesses, switch explicitly between isolated workspaces, review journals, exceptions, reconciliations and tax states, and export working records. Each business grants read or posting/proposal permissions and can revoke access.
- [ ] **Verified:** Accountant can support two businesses without mixing reports/cache/search. Revocation stops online access within 60 seconds; an accountant cannot approve their own proposed adjustment.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F27 — Financing readiness profile

- [ ] **Built:** Generate a merchant-visible profile of trading history, sales, expenses, cash-flow trend, receivables/payables, reconciliation coverage, fiscal status and data completeness. Include reporting dates, evidence sources and limitations. No credit score, loan decision or funding guarantee is implied.
- [ ] **Verified:** Profile figures reconcile to source reports. Missing history, cash-only assertions and provisional valuations reduce displayed completeness rather than inventing verified turnover.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F28 — Permissioned profile export

- [ ] **Built:** Allow owner-authorised download of a dated readiness profile and explicit, purpose-specific sharing records identifying recipient and version. External lender APIs and automated finance offers are deferred.
- [ ] **Verified:** No silent lender sharing. Record consent withdrawal and stop future access; explain that already-downloaded copies cannot be remotely recalled.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F29 — Private evidence and exports

- [ ] **Built:** Store PDF/JPEG/PNG evidence, invoice PDFs and accountant exports privately on Hetzner filesystem, with malware quarantine, 10 MB/file, ten attachments/record, hashes and versions. Downloads require resource authority and short-lived access of at most five minutes.
- [ ] **Verified:** Direct web paths, cross-tenant tokens, spoofed types and quarantined files fail. Accepted documents survive redeployment and are included in restore testing.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F30 — Notifications and support

- [ ] **Built:** Queue email invitations, report/fiscal exceptions and opt-in reminders with deduplication and 1/5/30-minute retries. Support access requires a time-limited tenant grant and audit. Failed jobs replay using original IDs.
- [ ] **Verified:** Email failure does not roll back business records; replay has no second journal/fiscal effect. Support cannot fabricate fiscal acceptance or reconciled funds.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —