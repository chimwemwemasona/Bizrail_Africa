> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 01 — Foundation and offline ledger

Version 2.0 | Research MVP baseline | Status: In progress (local foundation) | Owner: TBD

Progress 2026-09-13: ledger schema/posting/outbox and durable offline queue implemented as an initial increment. Twenty tests, workspace type checks and production builds passed. Full F01–F05 acceptance remains open; see [implementation evidence and remaining work](../docs/phase-1-progress.md).

Dependency: None; start here. Smart Invoice discovery and accountant recruitment start immediately.

These files supersede v1. Filenames are retained for existing links; the phase title and v2 requirements define current scope. Tick Built after implementation and Verified only with acceptance evidence. All checkboxes intentionally remain open.

## F01 — Business and ledger foundation

- [ ] **Built:** The system shall support separate Zambian business tenants, ZMW, one branch/stock location per business in MVP, UTC storage and Africa/Lusaka display. It shall maintain a chart of accounts and immutable balanced double-entry journals linked to source documents.
- [ ] **Verified:** Unbalanced entries fail atomically; each source event posts once; every journal and subledger belongs to one tenant.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F02 — Offline capture

- [ ] **Built:** The installed PWA shall cache authorised catalogues and support local sales, quotations, cash receipts, purchases and expenses after initial online enrolment. IndexedDB shall hold durable device events with unique IDs, schema version and local sequence. Local stock and ledger projections shall update immediately and show unsynchronised status.
- [ ] **Verified:** In airplane mode record ten sales and two expenses, reload the PWA and retain them with correct provisional totals. External payment and fiscal confirmation remain unavailable offline.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F03 — Synchronisation

- [ ] **Built:** The server shall validate tenant, actor, device, dependencies and operation ID on sync; atomically post each accepted event and its outbox entries. Sync shall return per-event accepted, rejected or conflict results and a resumable server cursor. Retries shall never duplicate sales, stock, journals or tax submissions.
- [ ] **Verified:** Disconnect after server commit but before acknowledgement, retry ten times and obtain one financial effect. Out-of-order dependencies wait; one rejected event does not discard unrelated work.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F04 — Offline conflict and security policy

- [ ] **Built:** Enrolment shall issue a configurable offline lease, proposed maximum 24 hours. No offline role changes, journals, fiscal approval or external transfers are allowed. Revoked/expired actors shall have pending events quarantined for authorised review on reconnect. Concurrent document edits use version checks; financial events never use last-write-wins.
- [ ] **Verified:** Revoked-device upload cannot post automatically. Preserve its unaccepted events for review. Display last sync, lease expiry, conflicts and storage warnings; explain that unsynced device loss is unrecoverable without a local copy.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## F05 — Infrastructure baseline

- [ ] **Built:** Deploy on Ubuntu Hetzner hosts with PostgreSQL, durable database outbox, Redis delivery/cache, private filesystem documents and encrypted SSH backups. Use a modular monolith; the proposed research stack is NestJS and React/Next.js PWA with IndexedDB. Exact versions require implementation review.
- [ ] **Verified:** Rebuild staging from the repository and configuration; Redis loss does not lose accepted business events; no AWS, S3 or S3-compatible dependency is required.

Owner: TBD | PR/commit: — | Evidence: — | Blocker: —

## Exit gate

- [ ] Every requirement above is built, reviewed and verified against SRS v2.0.
- [ ] Cross-module posting, sync, access and failure cases pass; evidence is linked.
- [ ] Open external dependencies are assigned and no blocked capability is marked complete.

Reviewer: TBD | Completion date: —
