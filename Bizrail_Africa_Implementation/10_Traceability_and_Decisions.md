> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Research and SRS traceability

Version 2.0 supersedes all earlier FR/AT mappings. F01–F30 and Q01–Q08 are the current acceptance baseline.

| Research MVP capability | SRS v2 | Phase |
| --- | --- | --- |
| Sales quotations receipts | F11,F15 | 03 |
| Smart Invoice invoicing | F16–F18 | 04 |
| Purchases expenses | F12 | 03 |
| Inventory stock alerts | F13–F14 | 03 |
| Cash bank mobile reconciliation | F19–F23 | 04–05 |
| Customer supplier ledger | F09,F22 | 02,05 |
| Cash-flow dashboard | F25 | 05 |
| P&L downloadable records | F24–F25 | 05 |
| Offline-first PWA | F02–F04 | 01 |
| Roles audit | F06–F10 | 02 |
| Accountant portal | F26 | 06 |
| Financing readiness | F27–F28 | 06 |

## Decisions

- [ ] **D01 Smart Invoice route, current contract and approvals:** Compliance/integrations; before fiscal build/live pilot. Obtain tax codes, numbering, correction, stock/purchase messaging and offline rules from approved route.
- [ ] **D02 Accounting policy:** Accountant/product; before core posting. Ratify chart, weighted-average policy, tax eligibility, rounding and reporting periods.
- [ ] **D03 Pilot statement formats:** Integrations/finance; before reconciliation. Secure one bank and one mobile-money format; define independent evidence and reference uniqueness.
- [ ] **D04 Privacy hosting retention and consent:** Legal/security; before live pilot. Ratify hosting region, retention and profile-sharing purposes. Planning defaults are not legal conclusions.
- [ ] **D05 Device and offline controls:** Security/product; before PWA qualification. Ratify 24-hour lease, supported browsers, recovery and conflict workflows.
- [ ] **D06 Pilot/accountant partners:** Product; before beta. Recruit accountant partners and merchant cohorts; collect time-to-reconcile and record-quality baseline.

## Revision record

The original research governs product scope. V1 concentrated on distributor collections and omitted required SME workflows; v2 restores all twelve capabilities and moves payment initiation/links to release two. The original suggested NestJS/React/PostgreSQL stack is restored as a proposal. Ubuntu Hetzner and private filesystem/SSH backups replace the suggested cloud object-storage deployment. Prior v1 FR numbers and test references must not be reused as current acceptance criteria.

## Interface verification

- [ ] REST/OpenAPI contracts include tenant authority, version checks, exact money and structured errors.
- [ ] Sync supports idempotent push, resumable pull and per-event conflicts without data loss.
- [ ] Fiscal adapter contract has approved tax/numbering/correction/offline rules and recovery examples.
- [ ] Bank/mobile import contracts distinguish evidence from already-posted money.

Owner: TBD | Decision/PR links: —