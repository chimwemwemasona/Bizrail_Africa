# Phase 1 progress

Updated 2026-09-20. The local development implementation is complete and connected end to end. The full production/SRS exit gate remains open for external approvals and the explicitly deferred infrastructure scope.

## Implemented locally

- F01: tenant-scoped ZMW chart of accounts, immutable balanced journals, source documents, stock movements and UTC/Lusaka timestamps.
- F02: authenticated enrolment, installable PWA shell, scoped IndexedDB catalogue/events, five capture workflows and provisional ledger/stock projections.
- F03: authenticated push/pull, operation and sequence checks, dependency retry, atomic posting/outbox/receipts, resumable cursor and consistent snapshot application.
- F04: configurable offline leases, device revocation, immutable quarantine/review, independent idempotent release, versioned quotations, recovery export and safe logout/update handling.
- Local runtime: native PostgreSQL with five migrations, restricted application role, readiness checks and idempotent durable outbox delivery. Docker and WSL are not required; Redis is explicitly disabled for development.

The user authorised development accounting rules. No accountant approval or live fiscal/payment integration is claimed.

## Verification

45 tests across five files passed, including real isolated native PostgreSQL integration tests. Both application builds passed. Browser acceptance against the built app passed again on 20 September: offline ten-sales/two-expenses capture survives reload and tab reopening with correct totals; ten lost-acknowledgement retries do not duplicate posting; revoked-device work stays quarantined; independent review posts it once. Chromium reports no PWA installability errors; mobile has no horizontal overflow and neither context reports page errors.

See [detailed acceptance, posting policy and evidence](phase-1-acceptance.md), [sync contract](sync-contract.md), and [native runtime](local-runtime.md).

## Remaining external gates

Accountant sign-off (D02), Smart Invoice discovery and pilot/accountant recruitment (D01/D06), policy/device qualification (D05), and the deferred Hetzner/Redis/backup/staging infrastructure (F05) remain open. Physical-device installation/flight-mode testing is not implied by Chromium's network-offline tests. The referenced SRS is not in this repository, so full SRS review cannot be recorded.

## Milestones

- 13 September: dependency installation, shadcn UI foundation, ledger and durable queue; 20 tests.
- 15 September: native PostgreSQL replaces Docker; readiness and internal sync implemented; 40 tests.
- 19–20 September: authenticated merchant workflows, PWA, device administration/review, restricted runtime role and browser acceptance; 45 tests.
