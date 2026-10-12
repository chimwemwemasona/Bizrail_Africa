# Bizrail Africa

An offline-first SME workspace built with Next.js, shadcn/ui, NestJS and PostgreSQL. The local Phase 1 application connects merchant capture, stock, a balanced ZMW ledger and device sync end to end.

## Current status — 20 September 2026

- Password sign-in, development-business creation, authenticated device enrolment and time-limited offline grants.
- Online/offline sales, quotations, cash receipts, purchases and expenses with immediate provisional balances and stock.
- Installable PWA shell, persistent device-scoped records, reconnect sync and safe retries after lost responses.
- Transaction activity, quotation versions, inventory, account balances and read-only journals.
- Device revocation, preserved quarantine, independent review and idempotent release.
- Recovery export, storage/lease warnings, safe logout and pending-work protection during updates.
- Atomic ledger/source/stock/sync/outbox writes and durable PostgreSQL outbox delivery.

**Development accounting rules are enabled with the user's approval.** New test businesses receive 100 sample units costing K6 and priced at K10. No tax is calculated; cash receipts credit the receivables control account. Accountant approval, physical-device qualification and the previously deferred production infrastructure remain outside local acceptance. See [acceptance evidence and remaining gates](docs/phase-1-acceptance.md) and the [implementation plan](Bizrail_Africa_Implementation/00_README.md).

## Hosted portfolio demo

The Phase 1 sample-business demo is live at [https://95.217.214.201:8444/](https://95.217.214.201:8444/). Choose **Create a demo workspace** and your own credentials. Use sample records only. See [deployment and verification](docs/hosted-demo.md). This is a hosted demo, not a production accounting service.

## Run locally

Requirements: Node.js 24.11.1 or newer within Node 24, npm 11, and native PostgreSQL 18. Docker and WSL are not required. Redis is explicitly disabled for local development.

```powershell
git clone https://github.com/chimwemwemasona/Bizrail_Africa.git
cd Bizrail_Africa
npm ci
npm run local:configure
npm run db:start
npm run db:migrate
npm run db:runtime
npm run runtime:check
```

The native helper defaults to `C:/Program Files/PostgreSQL/18/bin`; set `PG_BIN` for another installation. It uses a dedicated persistent database on `127.0.0.1:5433`, independently of an existing service on port 5432. `local:configure` preserves an existing `.env`. `db:runtime` generates the restricted application role and stores its connection string privately in `.env`; migrations use the separate owner connection.

For development with automatic reload:

```powershell
npm run dev
```

For the complete PWA/offline workflow, build first, then run API and web in separate terminals:

```powershell
npm run build
npm run start -w @bizrail/api
```

```powershell
npm run start -w @bizrail/web
```

Open [the app](http://127.0.0.1:3000), choose **Create a local development workspace**, and choose your own credentials. There is no shared default password. Initial enrolment and catalogue download require an online connection. On Windows, stop the web server before rebuilding because it can hold the standalone output directory open.

`npm run db:status` reports database status; `npm run db:stop` stops it while retaining data. Restart it after restarting the laptop. See [runtime configuration and recovery](docs/local-runtime.md).

## Verification

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test -- --maxWorkers=1 --testTimeout=30000
npm run build
# With the built API/web app and database running:
npm run test:browser
```

The automated suite contains 45 tests. PostgreSQL integration tests use an isolated temporary native cluster; a skipped suite is not database verification. Browser acceptance uses Chromium and synthetic businesses in the local application database. On a clean machine, install the browser with `npx playwright install chromium`.

Browser checks exercise offline reload/reopening, ten sales and two expenses, lost-response retries without duplicate posting, revoked-device quarantine and independent review. Reports/screenshots are written to ignored `storage/acceptance/`. Chromium installability checks do not replace physical-device installation and flight-mode qualification.

API [liveness](http://127.0.0.1:3001/api/health/live) is separate from [readiness](http://127.0.0.1:3001/api/health/ready). Readiness verifies migration checksums and configured dependencies; local Redis status is explicitly `disabled`.

## Configuration and data

Use `.env.example` for configuration guidance; never commit real credentials. `.env`, database storage, browser evidence, dependencies and generated build/service-worker files are ignored by Git. Keep backups of local business data separately.

`OFFLINE_LEASE_MINUTES` accepts 1–1440, defaulting to 1440. Renewal never changes grants on previously captured records or automatically approves quarantine. The public app shell is cached by the service worker; business records remain in scoped IndexedDB storage. Recovery exports exclude passwords and device credentials but contain private business data.

The local API uses `NODE_ENV=development` even when serving the built PWA, so development registration and the explicit Redis bypass remain available. This is a local testing configuration, not a production deployment recipe.

## Repository structure

- `apps/web`: responsive merchant UI, IndexedDB queue, projections and PWA integration.
- `apps/api`: authentication, device authority, sync, domain posting, ledger and migrations.
- `tests`: unit, offline-storage, API/runtime and native PostgreSQL integration tests.
- `scripts`: native runtime helpers, restricted database-role setup, PWA build and browser acceptance.
- `docs`: [acceptance](docs/phase-1-acceptance.md), [progress](docs/phase-1-progress.md), [sync contract](docs/sync-contract.md) and [runtime](docs/local-runtime.md).
- `Bizrail_Africa_Implementation`: the governing eight-phase plan. Referenced research/SRS documents are not present in this repository.
