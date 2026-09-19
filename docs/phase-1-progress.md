# Phase 1 progress

Updated 2026-09-15. Status: in progress, local foundation increment. No F01–F05 requirement or phase exit gate is complete.

## Internal sync increment — 2026-09-15

Implemented `SyncService.push/pull` with per-event transactions, canonical payload hashes, operation/sequence reuse checks, server grant/device checks, dependency waiting, durable final outcomes and resumable per-business cursors. Ledger posting can now participate in the same transaction as domain effects and the sync receipt/outbox. Known revoked/expired-device work is quarantined; retries of accepted events return their original receipt. Device revocation requires an explicit trusted-provisioned management capability.

**40 tests across five files passed** with `npm test -- --maxWorkers=1 --testTimeout=15000`. Ten new native PostgreSQL cases cover concurrent lost-ack retries with one journal/outbox/receipt, out-of-order dependencies, per-event isolation, grant/device matching, revoked/disabled/expired authority, quarantine retained after renewal, savepoint rollback on version conflicts, whole-event rollback on unexpected/deferred-balance errors and tenant-isolated numeric cursor pagination. Test clusters are separate from the persistent local database.

This is internal server groundwork. Tests use a synthetic server-side posting handler; no production merchant handler, authenticated sync endpoint, UI capture or IndexedDB-to-server adapter is complete. The preview is unchanged. See [the internal contract and integration constraints](sync-contract.md).

API type checking/build, repository lint and changed-file formatting passed. Migration `003_sync_outcomes` was applied to the dedicated native database; the live runtime probe returned ready with PostgreSQL `ok` and Redis `disabled`.

The native status helper now distinguishes a stopped server from process/permission failures instead of reporting every failed probe as stopped. An unrestricted status check confirms that the project database is running.

## Native runtime decision — 2026-09-15

At the user's direction, Docker/Compose has been removed from the project workflow. Native PostgreSQL start/stop/status commands replace container commands. Local development explicitly disables Redis; readiness reports this as `disabled` and still requires PostgreSQL migrations. Redis delivery/cache and full F05 verification remain deferred. See [current native setup](local-runtime.md). The earlier container attempt below is historical and no longer a blocker or prerequisite.

The dedicated persistent native cluster on loopback port 5433 has been initialized, the `bizrail` database created and both migrations applied. The actual runtime probe returned `status: ready`, `postgres: ok`, `redis: disabled`. API liveness returned HTTP 200. The existing Windows PostgreSQL service remains independent.

Verification: **30 tests across five files passed** with one worker, including native isolated PostgreSQL tests and development-only Redis bypass checks. API type checking/build and repository lint passed. A live stop/restart, repeated start and migration rerun succeeded; readiness still passed after restart, confirming the migration records persisted.

## Earlier runtime increment — 2026-09-15 (superseded setup)

Added generated local configuration (`npm run local:configure`), a read-only CLI probe (`npm run runtime:check`) and `/api/health/ready`. Readiness requires current recorded migration checksums and Redis PONG; failures return HTTP 503 without exposing credentials. Liveness remains independent. The new root `.env` targets the isolated Compose PostgreSQL port 5433 and Redis port 6379.

Persistent infrastructure remains blocked: Docker's Linux engine did not start, and WSL reports unavailable Windows virtualization prerequisites. Windows reports BIOS virtualization enabled; optional-feature inspection requires administrator elevation. No feature settings were changed or restart triggered. The actual runtime probe correctly returned both services unavailable. See [local setup and recovery steps](local-runtime.md).

The workspace also contained `002_device_sync.sql` and an internal `DeviceAuthority` implementation when this increment began. They are preserved; trusted HTTP authentication, role enforcement and end-to-end sync acceptance are still pending.

Verification: all **27 tests across five files passed** with `npm test -- --maxWorkers=1 --testTimeout=15000`, including the real isolated PostgreSQL suite and seven new readiness checks. The readiness success/failure tests use mocked clients; persistent PostgreSQL/Redis success is not claimed. An initial run found a test-module decorator loading issue (fixed) and a liveness timeout under parallel load; the successful run reduced contention on the laptop.

Both workspace type checks, the API production build, repository lint and formatting checks for the changed files passed. Running local configuration again preserved the existing `.env`. The frontend was not changed or rebuilt during this increment.

## Visible UI foundation

The user's shadcn/ui preference is configured using the official CLI, the Radix Nova preset and Tailwind CSS 4. Button, Card, Badge, Separator and Sheet component sources are in the web workspace. Shared theme variables provide a neutral/teal starting point with system fonts. See [UI conventions](ui-conventions.md).

The local homepage now shows a responsive workspace preview with desktop navigation, a mobile drawer, an overview and clearly labelled unavailable workflows. Navigation works; financial data, capture forms, device enrolment and sync are not connected. This is the visible app-shell foundation, not completed F02 offline capture.

Verification for the UI increment: web production build including TypeScript, lint, formatting and four dependency smoke tests passed; npm audit reported zero vulnerabilities. Playwright verified desktop rendering, section navigation, mobile drawer selection, Escape/focus return, no mobile horizontal overflow and no page errors. Desktop and mobile screenshots were visually inspected. These checks do not establish installable-PWA or airplane-mode functionality.

## Implemented and tested

- **Ledger boundary:** Strict ZMW input, exact integer minor units, UTC timestamps, balanced nonzero lines and canonical request hashes. Tenant identity is a separate server-context argument, not accepted from journal payloads.
- **PostgreSQL foundation:** Businesses with one branch label, tenant-scoped accounts, source/operation uniqueness, append-only journals and lines, composite foreign keys preventing cross-business account postings, and commit-time balance checks. Later corrections must use new compensating journals.
- **Atomic posting and outbox:** A journal and its outbox entry commit together. Identical retries return the existing journal; changed content under the same operation ID is rejected. A different operation cannot repost the same source ID. Redis is not needed to retain these records.
- **Migration runner:** Transactional, locked and checksummed migration; unchanged reruns are safe. Run `npm run db:migrate` only against a dedicated Bizrail database configured through `DATABASE_URL` in the root `.env`.
- **Offline queue:** IndexedDB events preserve UUIDs, schema version, device sequence, dependencies and payloads after close/reopen. Storage is separated by tenant/actor/device. Capture requires a recorded online grant of no more than 24 hours; supported kinds are sales, quotations, cash receipts, purchases and expenses. Conflicts and quarantined events remain inspectable. Renewing a grant does not clear or automatically approve quarantined work.
- **Dependency baseline:** Direct application and development versions are pinned to the installed lockfile versions. The API and web production builds succeed.

## Acceptance evidence for this increment

- `npm test`: **20 tests passed across four files**, including the existing dependency smoke checks.
- PostgreSQL tests created a separate temporary PostgreSQL 18 cluster on a random loopback port with generated credentials. They did not use the existing Windows service or `DATABASE_URL`. The successful run stopped and removed its cluster.
- Database tests cover ten concurrent identical submissions producing one journal/outbox entry, changed-content and duplicate-source rejection, cross-tenant account rejection, empty/unbalanced direct-SQL rollback, and attempted changes to committed journals.
- IndexedDB tests cover ten sales and two expenses surviving close/reopen, concurrent sequence allocation, missing/expired grants, revocation, renewal without loss, tenant separation and preserved conflicts. These are queue tests using fake-indexeddb, not browser/PWA acceptance evidence or validation of stock/ledger projections.
- `npm run typecheck` and `npm run build`: passed for both workspaces.
- `npm run lint` and `npm run format:check`: passed with the Next.js workspace root configured. Repository formatting was normalised; generated Next.js declarations are excluded from formatting.

PostgreSQL integration tests use `PG_BIN` or the local Windows PostgreSQL 18 binary directory. They skip if `initdb` is unavailable; a skipped suite must not be reported as database verification. The test runner requires permission to start processes in this environment.

## Remaining Phase 1 work

1. Provision native Redis later when implementing its delivery/cache workflows. Persistent local PostgreSQL and migration readiness are now verified. Docker is not required.
2. Obtain accountant review of the chart of accounts and posting rules (D02). Source IDs currently enforce uniqueness; source-document workflows and subledgers are not built.
3. Connect authenticated online enrolment and actor/device credentials to the tested internal authority/sync services; implement authorised quarantine review. Client storage/lease checks are usability controls, not a security boundary. No posting/sync endpoint is exposed yet, and database runtime-role isolation is still to be designed.
4. Build the installed PWA, authorised catalogue cache, capture screens, immediate provisional ledger/stock projections and sync/conflict/storage warnings. The queue currently stores transport payloads; it does not validate or execute business transactions.
5. Integrate the tested internal sync push/pull service with approved domain handlers and the IndexedDB queue (including per-event server grant IDs and waiting/retry handling). Implement actual source-document version checks in domain handlers, automatic dependency retry and cursor application to client projections. Add outbox delivery/recovery and verify Redis loss/replay.
6. Qualify real-browser airplane-mode operation, lost-ack retries and revoked-device uploads end to end. Complete UTC/Lusaka display behaviour and pending-work handling on logout/upgrades.
7. Track approved Smart Invoice integration discovery and accountant recruitment from Phase 1 (D01/D06). These external decisions are still open.

Hetzner hosts, staging rebuild, private production documents and encrypted SSH backups remain deferred. F05 and the complete Phase 1 exit gate therefore remain open.
