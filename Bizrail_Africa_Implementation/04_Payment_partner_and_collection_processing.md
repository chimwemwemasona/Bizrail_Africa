> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 04 — Smart Invoice and financial evidence adapters

Version 2.0 | Research MVP baseline | Status: Not started | Owner: TBD

Dependency: Prior phase domain contracts ready; implement against those interfaces. Fiscal access discovery runs from Phase 01.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. All checkboxes intentionally remain open.

## F16 — Zambia compliance adapter

- [ ] **Built:** Provide a country adapter for Smart Invoice using an approved integration route. Configure taxpayer identity, item/tax codes, numbering and required sales, purchase or stock messages under the agreed ZRA contract. Record request hashes and authoritative responses.
- [ ] **Verified:** Contract tests and required onboarding/approval evidence pass for the pilot taxpayer before live release. Generic PDFs and tax arithmetic alone do not satisfy this requirement.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F17 — Fiscal lifecycle and recovery

- [ ] **Built:** Maintain fiscal states not_required, queued, submitting, accepted, rejected and unknown separately from sale/payment states. Persist submission intent before sending; after timeout query/recover by original reference where supported, or escalate without blind resubmission.
- [ ] **Verified:** Lost response followed by retry cannot produce a second fiscal invoice. A rejected submission remains visible with reason and a traceable correction; only accepted evidence renders authoritative fiscal fields.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F18 — Offline fiscal handling

- [ ] **Built:** Offline commercial records shall be labelled pending fiscal validation. The adapter policy shall determine which actions may complete locally and which require connectivity; it shall follow the confirmed integration rules, not assume a grace period. Queue required fiscal work durably on sync.
- [ ] **Verified:** Airplane-mode sale updates provisional stock/ledger and later submits once. UI never calls an unvalidated receipt a compliant Smart Invoice. If required rules block final issuance, show the pending document and recovery action.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F19 — Bank and mobile money evidence

- [ ] **Built:** Import independent bank and mobile-money transaction statements through versioned adapters, with account, reference, direction, amount, fee, currency and time mappings. Provide at least one bank and one mobile-money format for the pilot; direct read APIs are optional when access exists.
- [ ] **Verified:** Replay a 10,000-row/10 MB statement and create no duplicate evidence. Same reference in different accounts remains distinguishable; unsupported formats fail with preview errors.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F20 — Authenticated external events

- [ ] **Built:** Where providers support callbacks/enquiries, authenticate and durably accept events before ACK; deduplicate message identity separately from financial transaction identity. Provider credentials and card/PIN data shall not enter merchant clients.
- [ ] **Verified:** Forged callback changes no ledger. Duplicate, late and reversal events process once; unknown outcomes create review. Hosted payment links and new payment initiation are release two, not MVP gates.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —