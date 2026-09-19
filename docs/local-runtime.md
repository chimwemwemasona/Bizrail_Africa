# Native local runtime

Updated 2026-09-15. Docker, containers and WSL are not project prerequisites. Node.js and native PostgreSQL are sufficient for the current local development scope. Redis delivery/cache is explicitly deferred locally.

```powershell
# On a clean installation:
npm ci
npm run local:configure
npm run db:start
npm run db:migrate
npm run runtime:check
npm run dev
```

`local:configure` generates a root `.env` with a random database password, without overwriting an existing file or printing credentials. The file is ignored by Git. The native helper expects `DATABASE_URL` to identify user/database `bizrail` at `127.0.0.1:5433`. Changing `.env` does not change an existing cluster's password.

`db:start` uses the installed PostgreSQL binaries at `C:/Program Files/PostgreSQL/18/bin`. Set `PG_BIN` for another installation. It initializes a project-owned cluster in `storage/postgres/data`, starts it on loopback port 5433 and creates the `bizrail` database. Repeated starts preserve data. It verifies cluster ownership and the connected server's data directory before creating the database. The existing Windows PostgreSQL service on port 5432 is independent.

```powershell
npm run db:status
npm run db:stop
```

Stopping retains all data. Start it again after a laptop restart; this helper does not install a Windows service or automatic startup task. Data and PostgreSQL logs remain in ignored `storage/postgres`. Do not delete that directory to troubleshoot a startup failure. Check `PG_BIN`, port availability, `.env` credentials and `storage/postgres/postgres.log`. The local database user owns this development cluster; production runtime-role isolation remains pending.

## Local Redis mode

The generated configuration explicitly uses:

```dotenv
NODE_ENV=development
REDIS_ENABLED=false
REDIS_URL=
```

Only this explicit development setting disables the Redis readiness requirement. Readiness reports `redis: disabled`; it never claims Redis is healthy. Production or unspecified `NODE_ENV` still requires Redis. To enable a separately provisioned native Redis service later, set `REDIS_ENABLED=true` and its `REDIS_URL`, then restart the API.

Redis-dependent workers and cache are unavailable in this mode. Accepted journals and outbox entries remain durable in PostgreSQL. Redis delivery/replay qualification and the full Phase 1 infrastructure gate remain open; disabling Redis does not establish those guarantees.

## Runtime checks

`npm run runtime:check` builds the API, reads `.env`, checks recorded migration versions/checksums and any enabled Redis dependency, then exits nonzero if not ready. Run `db:migrate` explicitly; API startup and probes never apply migrations.

- `GET /api/health/live`: HTTP 200 when the API responds, independent of dependencies.
- `GET /api/health/ready`: HTTP 200 for the configured runtime when PostgreSQL migration checks pass and Redis is either responding or explicitly disabled for development. Otherwise HTTP 503.

Responses do not expose connection strings or raw errors. Probes have bounded connection/query timeouts and close their connections. Readiness does not establish business-workflow or offline acceptance.
