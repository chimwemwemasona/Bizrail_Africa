> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Phase 07 — Hardening recovery and release qualification

Version 2.0 | Depends on Phases 01–06 | Status: Not started

## Q01 — Integrity

- [ ] **Implemented:** Zero duplicate journal, stock, allocation or fiscal effects under replay, concurrent processing and crash recovery; accepted server events survive worker/Redis failure.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q02 — Offline usability

- [ ] **Implemented:** After enrolment, capture and reload offline sales/expenses in the supported PWA browsers. Test 1,000 pending device events and interrupted/repeated sync without loss; blocked/conflicting events remain inspectable.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q03 — Performance

- [ ] **Implemented:** Proposed qualification workload: 100 concurrent users and 100k business documents, 20 requests/s for 30 minutes; p95 reads ≤2s and writes ≤3s excluding external latency. Sync 1,000 ordinary events within 5 minutes on a controlled 5 Mbps connection excluding fiscal-provider processing.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q04 — Recovery

- [ ] **Implemented:** Server-accepted database and document RPO ≤15 minutes and end-to-end RTO ≤4 hours, demonstrated on fresh Ubuntu hosts. Unsynced device data is outside server RPO and must be clearly indicated.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q05 — Security

- [ ] **Implemented:** Tenant/device isolation, privileged MFA, encryption in transit/at rest, restricted secrets and audited access. No unresolved critical/high security finding at launch. IndexedDB is not assumed secure against XSS; apply CSP, dependency review and minimal cached personal data.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q06 — Accessibility and connectivity

- [ ] **Implemented:** Core flows work at 360px, with keyboard navigation and labelled states. At least four of five representative users complete sale/expense/report tasks unaided. Initial core page target ≤1 MB excluding optional attachments.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q07 — Availability and monitoring

- [ ] **Implemented:** Target 99.5% monthly core availability including maintenance; measure provider outages separately. Alert within five minutes for integrity errors, sustained sync/fiscal failures, queue age >5 minutes and backup lag threatening RPO.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

## Q08 — Maintainability

- [ ] **Implemented:** Version API, event schemas, adapters and migrations. Maintain separate sandbox/staging/production data and secrets. Test old queued PWA events against a new server deployment; incompatible clients preserve data and request upgrade without clearing unsynced work.
- [ ] **Verified:** Attach measured results, build/environment and reviewer acceptance.

Owner: TBD | Evidence: — | Blocker: —

- [ ] **A01 (F01,F06–F10):** Two tenants and an accountant cannot access each other without grants; revoke online and offline devices and verify quarantine.
- [ ] **A02 (F02–F04):** Record offline sales/expenses, restart browser, sync out of order and lose ACKs; obtain one server effect per event and visible conflicts.
- [ ] **A03 (F11–F15):** Quote → sale → receipt; purchase → stock → sale cost → return. Weighted-average example and bills paid later produce correct stock and ledger.
- [ ] **A04 (F14,F24):** Oversell on two offline devices; retain both sales with costing exception. Sync into a locked period and require reviewed resolution.
- [ ] **A05 (F16–F18):** Smart Invoice acceptance, rejection, offline queue and lost response recover with correct references and no false fiscal receipt.
- [ ] **A06 (F19–F23):** Import bank and mobile money evidence twice; reconcile cash count, split payment, fee mismatch, transfer and reversal without duplicate revenue.
- [ ] **A07 (F24–F25):** Compare P&L, cash movement, trial balance, stock and customer/supplier statements at one snapshot; verify locked-period controls.
- [ ] **A08 (F26–F28):** Accountant works across invited businesses; readiness profile ties to ledger and consent governs export/sharing.
- [ ] **A09 (F29–F30):** Reject malicious/unauthorised files; survive notification outage and replay with no duplicate financial effect.
- [ ] **A10 (Q01–Q08):** Pass documented load, offline-device, accessibility, security, deployment compatibility and fresh-host restore exercises.

- [ ] All F01–F30 and Q01–Q08 pass; current fiscal approvals and accountant posting review are recorded.
- [ ] Fresh-host restore includes database, accepted files, keys and partner/fiscal uncertainty recovery.
- [ ] PWA upgrade preserves queued events and financial database rollback is not used to undo a code deployment.