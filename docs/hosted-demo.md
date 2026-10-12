# Hosted portfolio demo

Live: https://95.217.214.201:8444/
Deployed: 12 October 2026. Scope: the committed Phase 1 application with sample businesses. Ongoing local Phase 2 onboarding changes are separate.

Choose **Create a demo workspace**, a unique username and a password of at least 12 characters. Each new business receives 100 sample items. The app supports online/offline sales, quotations, receipts, purchases and expenses, stock, ledger views, sync and revoked-device review. Use sample records only; development accounting rules are not accountant-approved or a production business service.

## Deployment

Source: `/home/chimwemwe/apps/Bizrail_Africa`.
Private runtime configuration: `/home/chimwemwe/apps/bizrail-runtime`, mode 700; environment files mode 600. Secrets are generated on the server and never stored in Git. API/database migrations use different database roles. The application role cannot create databases, change schemas or administer PostgreSQL.

`deploy/compose.yml` runs pinned Node 24, PostgreSQL 18, Redis 8 and Nginx containers. Only the HTTPS proxy publishes port 8444; the database, Redis, API and web ports remain on the private Compose network. Database and Redis volumes persist across restarts. App containers run as an unprivileged user with read-only source/root filesystems and bounded writable cache/storage mounts. Registration/sign-in are rate limited. Runtime API mode is production, with secure HttpOnly session cookies and explicit `BIZRAIL_DEMO_MODE=true` to permit sample workspace creation. The default production configuration still rejects registration without this flag.

The app has a dedicated browser origin so its service worker and IndexedDB do not interfere with the portfolio. It uses the same trusted IP certificate, mounted read-only, and a separate proxy container. The portfolio renewal helper reads `/home/chimwemwe/apps/portfolio-acme/tls-consumers.json`; its Bizrail entry is `bizrail-africa-proxy` with health URL `https://95.217.214.201:8444/healthz`. Certificate activation reloads both services. Stopped additional consumers are skipped until started; they load the current certificate on startup.

## Rebuild and update

Use the pinned Node image from Compose with source mounted at `/app`, working directory `/app`, UID/GID 1000. Run `npm ci`, then `npm run build` with `BIZRAIL_API_ORIGIN=http://api:3001` and `NEXT_TELEMETRY_DISABLED=1`. Limit builds to about 1.5 GB RAM and one CPU on this shared host. The Next build uses one worker. The PWA build creates the writable cache mountpoint.

Run migrations with the private `owner.env` file on network `bizrail-africa_default`:

```sh
docker compose --env-file /home/chimwemwe/apps/bizrail-runtime/compose.env -f /home/chimwemwe/apps/Bizrail_Africa/deploy/compose.yml up -d
# After rebuilding, restart only the application processes:
docker compose --env-file /home/chimwemwe/apps/bizrail-runtime/compose.env -f /home/chimwemwe/apps/Bizrail_Africa/deploy/compose.yml restart api web
```

Keep migration files immutable after application. Add new migrations instead of editing old ones. Preserve private credentials and persistent volumes; do not run `down -v`. For application rollback, restore the previous source/build and restart API/web; database rollback needs a compatible migration plan or a verified backup.

## Checks and backups

```sh
curl https://95.217.214.201:8444/api/health/live
curl https://95.217.214.201:8444/api/health/ready
docker compose --env-file /home/chimwemwe/apps/bizrail-runtime/compose.env -f /home/chimwemwe/apps/Bizrail_Africa/deploy/compose.yml ps
```

Readiness checks migration checksums, PostgreSQL and Redis. A private daily backup job exports PostgreSQL into `/home/chimwemwe/apps/bizrail-runtime/backups`, keeping seven days of dumps. Backups remain on this host and are not an offsite recovery solution. The public demo is not intended for real business records.

## Verification

Both applications built successfully. All 47 tests passed, including 18 PostgreSQL integration cases in a temporary, isolated PostgreSQL 18 cluster. The actual hosted browser acceptance passed: ten offline sales/two expenses survive reload/reopen; lost acknowledgements retry without duplicate financial effects; revoked work stays quarantined; an independent reviewer posts preserved work once. No page errors, no mobile horizontal overflow, and Chromium PWA installability passed. These browser checks do not claim physical-device qualification or accountant approval.

Browser acceptance accepts `BIZRAIL_TEST_URL` and uses generated synthetic users. Reports and screenshots remain in ignored `storage/acceptance`.
