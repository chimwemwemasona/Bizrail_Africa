# Dependency foundation

**Current scope (2026-09-13): laptop-only development. Hetzner provisioning, deployment and production operations are deferred, not prerequisites for local groundwork. Dependencies are installed; Phase 1 implementation is in progress.**

The supplied v2 plans propose NestJS, Next.js/React, PostgreSQL, Redis and IndexedDB. npm workspaces are scaffolded for the modular API and frontend. Application and development packages are installed and direct versions are pinned in the workspace manifests and lockfile. Type checks, builds and the first 20 tests pass. See [groundwork status](groundwork-status.md) and [Phase 1 evidence](phase-1-progress.md) for completed checks and remaining work.

## Package decisions

UI decision (2026-09-13): use shadcn/ui wherever possible, as requested by the user. The web app uses Tailwind CSS 4, the Radix Nova preset, Lucide icons and the official shadcn component sources. Dependencies are pinned; see [UI conventions](ui-conventions.md).

| Area                          | Packages                                                                                                         | Plan coverage                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| API                           | NestJS common/core/platform-express, config, Swagger, class-validator, class-transformer, reflect-metadata, RxJS | F01, F03, F05; API validation and contracts                                       |
| Database                      | pg, Kysely (including its migration API)                                                                         | F01, F03, F05, F24; explicit SQL and transactional ledger/outbox                  |
| Queue and logs                | ioredis, bullmq, nestjs-pino, pino, pino-http                                                                    | F05, F17, F30; delivery and structured operational logs                           |
| Authentication primitives     | argon2, otplib, NestJS throttler, helmet                                                                         | F06–F07; hashing, MFA primitives, rate limits and HTTP headers                    |
| Frontend                      | Next.js, React, React DOM                                                                                        | F02, F05 and later merchant/accountant UI                                         |
| Offline primitives            | Dexie, dexie-react-hooks, workbox-window, workbox-build                                                          | F02–F04; IndexedDB and service-worker tooling                                     |
| Forms and contracts           | Zod, react-hook-form, @hookform/resolvers                                                                        | Structured forms and versioned payload validation                                 |
| Exact amounts and dates       | decimal.js, date-fns, @date-fns/tz                                                                               | F01, F11–F15, F24–F25; decimal amounts and Lusaka display                         |
| Imports, exports and evidence | csv-parse, csv-stringify, pdfkit, file-type                                                                      | F09, F19, F25, F29                                                                |
| Notifications                 | nodemailer                                                                                                       | F30; SMTP transport                                                               |
| Tooling                       | TypeScript, ESLint, Prettier, concurrently                                                                       | Builds, static checks and local processes                                         |
| Verification                  | Vitest, Supertest, Playwright, fake-indexeddb                                                                    | API, native binary and storage smoke checks; future browser/offline qualification |

Kysely is the initial SQL/migration choice because ledger constraints, transaction boundaries and outbox semantics must remain explicit. Its PostgreSQL dialect uses pg without requiring additional database backends. The first transactional ledger migration and internal posting contract are implemented; full sync and domain contracts remain pending. Redis is delivery/cache infrastructure; accepted business events must be persisted in PostgreSQL, and BullMQ alone does not fulfill the durable-outbox requirement.

Workbox and Dexie are installed; a durable Dexie event queue is implemented and tested. No service worker or caching policy is enabled yet: tenant cache boundaries, device leases, pending-event preservation and upgrade behavior require implementation. Decimal.js does not establish the accountant-approved rounding or posting policy. Authentication and upload packages similarly do not implement access control, sessions, MFA enrollment or malware scanning by themselves.

## Local infrastructure

PostgreSQL 18.6 is already installed at `C:/Program Files/PostgreSQL/18`. The native project helper uses these binaries for a dedicated cluster in `storage/postgres/data` on loopback port 5433. The existing Windows service and databases on port 5432 remain independent. Run `npm run local:configure`, `npm run db:start`, then `npm run db:migrate`; see [native local runtime](local-runtime.md).

Docker, Compose and WSL are not project dependencies. Redis is not installed as a native service, so local development explicitly sets `NODE_ENV=development` and `REDIS_ENABLED=false`. PostgreSQL retains the ledger/outbox; Redis delivery/cache remains deferred. The ioredis/BullMQ packages remain available for later Redis integration, and other runtime modes still require Redis readiness.

Hetzner infrastructure and its Nginx, production TLS, SSH/Borg backup and WAL-archival setup are deferred to a future deployment phase. Do not install or provision these as part of the current laptop groundwork. Local malware-scanner integration can be addressed when implementing F29 attachments; it is not needed to start the application scaffold.

During local development, private evidence will use a private directory on the laptop, outside web-served paths. No AWS/S3/MinIO SDK, payment-initiation SDK or lender integration is needed. Smart Invoice and statement-specific SDKs remain undecided until the approved integration contract and pilot statement formats are supplied (D01/D03).

Browser executables are separate from the Playwright npm package. Install Chromium with `npx playwright install chromium` for browser qualification. Other browser/device targets remain subject to D05.

## Version references

- [NestJS setup requirements](https://docs.nestjs.com/first-steps)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [PostgreSQL supported releases](https://www.postgresql.org/support/versioning/)

Direct versions and the lockfile are recorded. A clean `npm ci` reproducibility check remains pending.
