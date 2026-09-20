> **Current execution scope — 2026-09-20:** Local Phase 1 implementation is complete with user-authorised development accounting rules. Native PostgreSQL replaces Docker. Production hosting remains deferred. See [acceptance evidence and external gates](../docs/phase-1-acceptance.md). Built/Verified checks below refer to this local development scope; physical-device qualification and the full production/SRS exit gate remain open.

# Phase 01 — Foundation and offline ledger

Version 2.0 | Research MVP baseline | Status: Local implementation complete; external gates open | Owner: TBD

Progress 2026-09-20: 45 automated tests and built-app Chromium offline/retry/review acceptance pass. See [implementation evidence](../docs/phase-1-acceptance.md).

Dependency: None; start here. Smart Invoice discovery and accountant recruitment start immediately.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. Remaining open checkboxes identify external or unqualified acceptance gates.

## F01 — Business and ledger foundation

- [x] **Built:** The system shall support separate Zambian business tenants, ZMW, one branch/stock location per business in MVP, UTC storage and Africa/Lusaka display. It shall maintain a chart of accounts and immutable balanced double-entry journals linked to source documents.
- [x] **Verified:** Unbalanced entries fail atomically; each source event posts once; every journal and subledger belongs to one tenant.

Owner: TBD | PR/commit: — | Evidence: [local acceptance](../docs/phase-1-acceptance.md) | Scope: development rules; Chromium offline tests. Physical-device installation/flight-mode qualification remains open for F02.

## F02 — Offline capture

- [x] **Built:** The installed PWA shall cache authorised catalogues and support local sales, quotations, cash receipts, purchases and expenses after initial online enrolment. IndexedDB shall hold durable device events with unique IDs, schema version and local sequence. Local stock and ledger projections shall update immediately and show unsynchronised status.
- [ ] **Verified:** In airplane mode record ten sales and two expenses, reload the PWA and retain them with correct provisional totals. External payment and fiscal confirmation remain unavailable offline.

Owner: TBD | PR/commit: — | Evidence: [local acceptance](../docs/phase-1-acceptance.md) | Scope: development rules; Chromium offline tests. Physical-device installation/flight-mode qualification remains open for F02.

## F03 — Synchronisation

- [x] **Built:** The server shall validate tenant, actor, device, dependencies and operation ID on sync; atomically post each accepted event and its outbox entries. Sync shall return per-event accepted, rejected or conflict results and a resumable server cursor. Retries shall never duplicate sales, stock, journals or tax submissions.
- [x] **Verified:** Disconnect after server commit but before acknowledgement, retry ten times and obtain one financial effect. Out-of-order dependencies wait; one rejected event does not discard unrelated work.

Owner: TBD | PR/commit: — | Evidence: [local acceptance](../docs/phase-1-acceptance.md) | Scope: development rules; Chromium offline tests. Physical-device installation/flight-mode qualification remains open for F02.

## F04 — Offline conflict and security policy

- [x] **Built:** Enrolment shall issue a configurable offline lease, proposed maximum 24 hours. No offline role changes, journals, fiscal approval or external transfers are allowed. Revoked/expired actors shall have pending events quarantined for authorised review on reconnect. Concurrent document edits use version checks; financial events never use last-write-wins.
- [x] **Verified:** Revoked-device upload cannot post automatically. Preserve its unaccepted events for review. Display last sync, lease expiry, conflicts and storage warnings; explain that unsynced device loss is unrecoverable without a local copy.

Owner: TBD | PR/commit: — | Evidence: [local acceptance](../docs/phase-1-acceptance.md) | Scope: development rules; Chromium offline tests. Physical-device installation/flight-mode qualification remains open for F02.

## F05 — Infrastructure baseline

- [ ] **Built:** Deploy on Ubuntu Hetzner hosts with PostgreSQL, durable database outbox, Redis delivery/cache, private filesystem documents and encrypted SSH backups. Use a modular monolith; the proposed research stack is NestJS and React/Next.js PWA with IndexedDB. Exact versions require implementation review.
- [ ] **Verified:** Rebuild staging from the repository and configuration; Redis loss does not lose accepted business events; no AWS, S3 or S3-compatible dependency is required.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —
