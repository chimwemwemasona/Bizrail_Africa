# Bizrail Africa

Development groundwork for the v2 offline-first SME operating system. The governing implementation plans are in [Bizrail_Africa_Implementation](Bizrail_Africa_Implementation/00_README.md). The referenced research document and SRS `.docx` are not present in this workspace; this setup follows the supplied v2 Markdown plans.

## Current scope and status

**2026-09-13: Work locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork.**

Dependencies are installed and pinned with a lockfile. Phase 1 is in progress: ledger/posting/outbox, offline queue, internal server sync and runtime readiness foundations are implemented. Forty tests pass, including native PostgreSQL sync failure/retry checks. The dedicated native PostgreSQL database is running with Redis explicitly disabled for development. See [Phase 1 evidence](docs/phase-1-progress.md), [internal sync contract](docs/sync-contract.md) and [groundwork status](docs/groundwork-status.md). Authenticated enrolment, domain handlers, UI capture, Redis delivery/cache and full PWA/sync workflows remain pending.

## Local development (after installation is completed)

Node.js 24.11.1 and npm 11.6.2 are already available; `.nvmrc` and `package.json` record this baseline.

```powershell
# On subsequent clean installations:
npm ci
# Generate local credentials without overwriting an existing .env:
npm run local:configure
# Uses the installed native PostgreSQL binaries:
npm run db:start
# Apply to the dedicated Bizrail database configured in .env:
npm run db:migrate
npm run runtime:check
npm run dev
```

The frontend preview runs at http://127.0.0.1:3000 and uses shadcn/ui with Tailwind CSS. Desktop/mobile rendering and preview navigation are verified; financial workflows are not connected. See [UI conventions](docs/ui-conventions.md). API liveness is configured for http://127.0.0.1:3001/api/health/live. Readiness at `/api/health/ready` checks PostgreSQL migration state and any enabled Redis dependency separately from liveness. The API loads the root `.env`; the web app has no secrets or environment configuration yet. See [native local runtime setup](docs/local-runtime.md). Docker and WSL are not required; Redis is explicitly disabled for local development for now.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

`npm run db:stop` stops the project's native PostgreSQL cluster and retains its data. `npm run db:status` reports whether it is running. PostgreSQL binds to loopback port 5433; the existing Windows service on 5432 is independent.

## Structure

- `apps/api`: NestJS modular-monolith starting point; HTTP liveness only.
- `apps/web`: Next.js App Router starting point.
- `tests`: dependency compatibility smoke checks, not feature acceptance tests.
- `docs/dependencies.md`: package decisions, scope and infrastructure prerequisites.
- `scripts/local-postgres.mjs`: native PostgreSQL start/stop/status with persistent project storage.

The ledger and offline queue are internal foundations; merchant workflows, authentication, approved accounting policies, complete offline guarantees and production deployment remain pending. Existing feature and qualification checkboxes remain open.
