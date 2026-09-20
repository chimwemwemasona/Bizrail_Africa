# Local groundwork status

Updated 2026-09-20. The local Phase 1 application is implemented and verified end to end with development accounting rules. See [current acceptance evidence](phase-1-acceptance.md) and [progress](phase-1-progress.md).

## Available and verified

- Node.js 24/npm 11, pinned workspace dependencies and a committed lockfile.
- Native PostgreSQL 18 in dedicated project storage, listening on loopback port 5433 independently of the Windows service on 5432.
- Five checksummed migrations and a restricted runtime database role, separate from the migration owner.
- NestJS API with authentication, device authority, posting, sync, administration and health checks.
- Responsive Next.js/shadcn UI and built PWA with persistent offline capture and reconnect sync.
- 45 automated tests, including native database tests, and browser acceptance covering offline persistence, lost responses and quarantine/review.

Docker, Compose and WSL are not required. Redis is explicitly disabled for local development; PostgreSQL provides durable outbox delivery to a local idempotent delivery table. This does not qualify a production Redis deployment.

## Running and recovery

Use the [README](../README.md) for setup, build and verification commands, and [native runtime instructions](local-runtime.md) for configuration and recovery. Database storage and credentials are ignored by Git. Stopping the database retains its data.

Hetzner, production TLS, remote backups and staging rebuild remain deferred. Accountant approval and physical-device qualification remain external acceptance gates. These limits are documented in the [acceptance record](phase-1-acceptance.md).
