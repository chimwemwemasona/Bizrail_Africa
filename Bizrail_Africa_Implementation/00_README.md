> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

# Bizrail Africa implementation tracker

Version 2.0 | Governing source: original Software White Spaces research MVP | SRS: Bizrail_Africa_MVP_SRS.docx v2.0

This replaces the narrower v1 distributor collections plan. Build an offline-first SME operating system covering all twelve research capabilities. Ubuntu on Hetzner, private filesystem documents and encrypted SSH backups are fixed constraints; no AWS, S3 or S3-compatible service is required.

## Tracking rules

Tick Built when code is implemented and Verified when acceptance evidence passes. Assign owners and link PRs/tests. Keep blocked items unchecked. Phase completion requires every feature and its exit gate. Store these files in docs/implementation and commit progress. Filenames are retained for continuity; revised titles and v2 IDs govern their content.

## Phases

- [ ] [Foundation and offline ledger](01_Foundation_and_Hetzner_setup.md)
- [ ] [Access and business onboarding](02_Tenancy_access_and_onboarding.md)
- [ ] [Sales purchasing and inventory](03_Orders_invoices_and_buyer_journey.md)
- [ ] [Smart Invoice and financial evidence adapters](04_Payment_partner_and_collection_processing.md)
- [ ] [Reconciliation accounting and reports](05_Reconciliation_and_financial_exceptions.md)
- [ ] [Accountant access and financing readiness](06_Evidence_reports_and_operational_tools.md)
- [ ] [Hardening and qualification](07_Hardening_recovery_and_release_qualification.md)
- [ ] [Research pilot](08_Controlled_pilot_and_expansion_decision.md)

## Supporting checklists

- [Hetzner operations](09_Hetzner_Operations.md)
- [Research traceability and decisions](10_Traceability_and_Decisions.md)

## Scope and sequence

Version 2.0 supersedes the distributor collection scope in version 1.0. The governing product source is Software White Spaces in Zambia and Africa: A Scalable Venture Thesis for a Billion-Dollar Software Company, specifically Recommended product and technical design, MVP, Offline-first is mandatory and Zambia pilot. The product is an offline-first SME operating system connecting daily business activity, compliance, reconciled records and financing readiness.

Initial users are Zambian businesses with approximately 2–30 employees using notebooks, Excel, WhatsApp or basic POS: retail/hardware/parts, wholesalers/distributors, service SMEs and light manufacturers with simple stock needs. The MVP supports English, ZMW and one branch/location per business. It does not attempt manufacturing production planning.

All twelve research MVP capabilities are required: sales/quotations/receipts; Smart Invoice-compatible invoicing; purchases/expenses; inventory/alerts; cash/bank/mobile-money reconciliation; customer/supplier ledger; cash-flow dashboard; basic P&L/downloads; offline PWA; roles/audit; accountant portal; financing-readiness profile.

Release two includes multi-branch, supplier purchase orders, payment links/initiation, payroll connectors, formalisation workflows, lender APIs and industry modules. No proprietary wallet, custody, own-balance-sheet lending, full payroll/HR/CRM, marketplace, logistics or AI copilot is required. The MVP records payments and reconciles existing financial rails rather than initiating new transfers.

Ubuntu on Hetzner is the infrastructure constraint. Private server files and encrypted SSH backups replace the research’s suggested S3-compatible storage. NestJS, React/Next.js PWA, PostgreSQL and Redis are proposed as in the original research; supported exact versions and libraries are engineering decisions. No AWS services, Amazon buckets or S3-compatible dependency is required.

## Definition of done

- [ ] Every F01–F30 requirement and Q01–Q08 gate has evidence.
- [ ] All twelve research capabilities are present; no required capability is silently deferred.
- [ ] Offline/sync, ledger, stock, fiscal and reconciliation invariants pass replay and conflict tests.
- [ ] Security, accountant review, current integration readiness and recoverability are accepted.
- [ ] No feature is marked built merely because this plan exists.