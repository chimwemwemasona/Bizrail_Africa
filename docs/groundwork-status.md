# Local groundwork status

## Update — 2026-09-15

The latest internal sync increment passes 40 tests. Migration `003_sync_outcomes` is applied to the persistent native database, and live readiness passes. Device/lease validation, preserved outcomes, atomic ledger participation and per-business cursors are tested; authenticated endpoints, production domain handlers and UI integration remain pending. See [sync contract](sync-contract.md).

**Current decision:** Docker and Compose are removed from the project workflow. Use native PostgreSQL through `db:start`, `db:stop` and `db:status`. Redis is explicitly disabled for local development and remains future delivery/cache work. See [current runtime instructions](local-runtime.md). All container setup notes below are historical and superseded; no Docker or WSL repair is needed to continue.

The native Bizrail database is initialized on port 5433 with both migrations applied. The actual readiness probe succeeds with PostgreSQL `ok` and Redis `disabled`; API liveness returns HTTP 200.

Local `.env` credentials are generated, and API/CLI readiness probes are implemented. All 27 tests passed with one test worker. Persistent PostgreSQL/Redis readiness remains unverified: Docker's Linux engine cannot start with the current WSL prerequisites. Windows reports BIOS virtualization enabled; inspecting Virtual Machine Platform requires an administrator session. See [local runtime instructions](local-runtime.md) and [Phase 1 progress](phase-1-progress.md). The earlier checklist below is historical evidence as of 2026-09-13.

Status updated 2026-09-13 following the user's completed installation and local verification. Application and development dependencies are installed; local runtime setup and application verification remain pending. Work remains on the laptop; Hetzner and production operations are deferred.

This status supersedes earlier installation-paused/no-dependencies statements in the README and implementation-plan scope banners. Installation does not complete any business-feature acceptance gate.

## Already available

- Node.js 24.11.1, npm 11.6.2 and Git, as previously recorded.
- PostgreSQL 18.6, previously verified accepting connections on `127.0.0.1:5432`. Project database/user configuration remains pending; existing databases were not changed.
- API/frontend skeletons, manifests, development scripts and Compose configuration. Phase 1 ledger/outbox and offline queue foundations are now implemented; see [Phase 1 evidence](phase-1-progress.md).
- Project `node_modules` and `package-lock.json` now exist.

## Installation checklist

- [x] **API framework:** NestJS common/core/platform-express 11.2.3, configuration and Swagger packages, reflect-metadata, RxJS, class-transformer and class-validator.
- [x] **PostgreSQL access and SQL:** pg and Kysely.
- [x] **Redis delivery and logging:** ioredis, BullMQ, nestjs-pino, pino and pino-http.
- [x] **Authentication/security primitives:** argon2, otplib, NestJS throttler and helmet.
- [x] **Frontend:** Next.js 16.3.5 and React/React DOM 19.3.0. shadcn/ui (Radix Nova), Tailwind CSS 4 and shared theme/component configuration are installed; the responsive workspace preview is running locally.
- [x] **Offline storage/PWA tooling:** Dexie, dexie-react-hooks, workbox-window and workbox-build.
- [x] **Forms, validation, amounts and dates:** react-hook-form, @hookform/resolvers, Zod, decimal.js, date-fns and @date-fns/tz.
- [x] **Imports, reports, attachments and email:** csv-parse, csv-stringify, PDFKit, file-type and Nodemailer.
- [x] **Build/quality tooling:** TypeScript 5.9.3, concurrently, ESLint/@eslint/js 9.39.5, typescript-eslint, eslint-config-next 16.3.5 and Prettier.
- [x] **Test tooling:** Vitest 5.0.0, Supertest, @playwright/test 1.63.0 and fake-indexeddb.
- [x] **Type declarations:** Node 24.x, Express, Nodemailer, PDFKit, pg, React, React DOM and Supertest declarations.
- [x] **Browser test downloads:** Playwright Chromium, Chromium Headless Shell, FFmpeg and Winldd. The headless-shell download timed out once, then succeeded on automatic retry.
- [x] **Docker Desktop installation:** The user's installer reported success for 4.90.0. Local verification found Docker CLI 29.7.2.
- [ ] **Docker engine readiness:** The CLI could not connect to the Docker engine named pipe. Open Docker Desktop, complete setup and confirm the Linux-container engine starts; verify both Client and Server using `docker version`.
- [ ] **Local Redis runtime:** Start and verify Redis 8 in a local Linux environment. Docker Desktop/Compose is the supplied workflow; Docker installation alone does not establish Redis readiness. PostgreSQL does not need reinstalling; the optional isolated Compose database uses port 5433 to avoid the existing service.

## Verification evidence

- `npm ls --depth=0` passed on 2026-09-13 and confirmed the declared root/API/web packages are installed. It also listed `@img/sharp-wasm32@0.35.4` as extraneous; review this when establishing a reproducible clean installation.
- `npm audit --json` passed on 2026-09-13 with zero vulnerabilities at every severity. The earlier five high-severity findings were not reproduced; their earlier cause or resolution has not been established. No audit fix was applied during this review.
- The installation log contains deprecation warnings for glob 11.1.0 and ESLint 9.39.5. Review supported versions and compatibility before changing them; a zero-vulnerability audit does not resolve deprecation status.
- The initial Playwright launch was blocked by sandbox permissions (`spawn EPERM`). A subsequent permitted Playwright run successfully verified desktop/mobile preview rendering, navigation and drawer keyboard behaviour. Full offline PWA qualification remains pending.
- Docker CLI verification succeeded; engine verification failed because its named pipe was unavailable.
- All root and workspace direct dependencies are pinned to exact installed versions, and the lockfile is updated.
- Phase 1 verification: 20 tests passed, including isolated PostgreSQL integration checks and IndexedDB queue tests. Workspace type checks, lint and both production builds passed. Persistent local database/Redis setup remains pending.

## Remaining completion checks

- [x] Pin exact direct dependency versions in API/web manifests and update the lockfile.
- [ ] Verify a clean installation using the lockfile; review deprecations and the extraneous package.
- [ ] Configure a dedicated local Bizrail database/user and `.env`; start/check local Redis.
- [x] Run type checking, lint, dependency smoke checks and production builds.
- [x] Complete the repository formatting check (`npm run format:check` passed).
- [x] Verify Playwright can launch Chromium from a permitted local session.
- [ ] Confirm API/frontend startup and actual database/Redis connections separately from liveness. The current skeletons do not yet establish those connections.

Earlier registry/cache failures no longer prevent the recorded package installation. Full browser/PWA and end-to-end application readiness remain unverified; the passing foundation tests do not complete business-feature acceptance gates.

Hetzner accounts/hosts, production reverse proxies, production TLS, remote backups and deployment are outside the current laptop groundwork. These remain future plan items, not current blockers. All business-feature acceptance checkboxes remain open; the eight-phase plan is in [the implementation tracker](../Bizrail_Africa_Implementation/00_README.md).
