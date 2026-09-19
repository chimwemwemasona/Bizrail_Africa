import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../apps/api/src/ledger/migrate';
import { LedgerRepository } from '../apps/api/src/ledger/ledger.repository';
import { WorkspaceService } from '../apps/api/src/workspace/workspace.service';
import { DeviceAuthority } from '../apps/api/src/sync/device-authority';
import {
  DomainFailure,
  SyncService,
  type SyncEnvelope,
  type SyncHandler,
} from '../apps/api/src/sync/sync.service';

const bin = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name: string) =>
  join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`);

// A new temporary cluster, random port and generated password. Never uses the
// developer's DATABASE_URL, existing Windows service or existing databases.
describe.skipIf(!existsSync(executable('initdb')))(
  'PostgreSQL ledger integrity',
  () => {
    let directory: string;
    let pool: Pool;
    let started = false;
    let ledger: LedgerRepository;
    const tenant = randomUUID();
    const otherTenant = randomUUID();
    const cash = randomUUID();
    const income = randomUUID();
    const otherAccount = randomUUID();
    const pgctl = (...args: string[]) =>
      execFileSync(executable('pg_ctl'), args, {
        windowsHide: true,
        timeout: 60000,
        stdio: 'ignore',
      });

    beforeAll(async () => {
      directory = mkdtempSync(join(tmpdir(), 'bizrail-ledger-test-'));
      const password = randomUUID();
      const passwordFile = join(directory, 'password');
      writeFileSync(passwordFile, password);
      execFileSync(
        executable('initdb'),
        [
          '-D',
          join(directory, 'data'),
          '-U',
          'bizrail_test',
          '-A',
          'scram-sha-256',
          '--pwfile',
          passwordFile,
          '--encoding=UTF8',
          '--no-locale',
        ],
        { windowsHide: true, timeout: 60000, stdio: 'pipe' },
      );
      const server = createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No temporary test port');
      const port = address.port;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      started = true;
      pgctl(
        '-D',
        join(directory, 'data'),
        '-l',
        join(directory, 'postgres.log'),
        '-o',
        `-h 127.0.0.1 -p ${port}`,
        '-w',
        'start',
      );
      pool = new Pool({
        host: '127.0.0.1',
        port,
        user: 'bizrail_test',
        password,
        database: 'postgres',
        max: 12,
      });
      ledger = new LedgerRepository(pool);
      await migrate(pool);
      await migrate(pool); // Re-running an unchanged migration is safe.
      await pool.query(
        'INSERT INTO businesses(id,name) VALUES ($1,$2),($3,$4)',
        [tenant, 'Synthetic business', otherTenant, 'Other business'],
      );
      await pool.query(
        `INSERT INTO accounts(tenant_id,id,code,name,kind) VALUES
      ($1,$2,'1000','Cash','asset'),($1,$3,'4000','Sales','income'),($4,$5,'1000','Other cash','asset')`,
        [tenant, cash, income, otherTenant, otherAccount],
      );
    }, 120000);

    afterAll(async () => {
      if (pool) await pool.end();
      if (started)
        pgctl('-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop');
      if (directory) {
        const target = realpathSync(directory);
        const root = realpathSync(tmpdir());
        if (
          !target.startsWith(root + sep) ||
          !resolve(target).includes('bizrail-ledger-test-')
        )
          throw new Error('Unsafe cleanup path');
        rmSync(target, { recursive: true, force: true });
      }
    }, 60000);

    async function merchantFixture() {
      const service = new WorkspaceService(pool, true),
        username = `test_${randomUUID().slice(0, 8)}`,
        password = 'Test-only-password-123!';
      const login = await service.register({
        username,
        password,
        name: 'Synthetic merchant',
      });
      const enrolled = await service.enrol(
        login.identity,
        { deviceId: randomUUID() },
        '',
      );
      const initial = await service.snapshot(enrolled.context);
      let sequence = 0;
      const event = (
        kind: SyncEnvelope['kind'],
        payload: Record<string, string | number>,
      ): SyncEnvelope => ({
        id: randomUUID(),
        schemaVersion: 1,
        sequence: ++sequence,
        grantId: enrolled.grant.grantId,
        capturedAt: new Date().toISOString(),
        kind,
        payload: {
          documentId: randomUUID(),
          expectedVersion: 0,
          description: 'Synthetic merchant record',
          settlement: 'cash',
          ...payload,
        },
        dependsOn: [],
      });
      return { service, login, enrolled, initial, event, username, password };
    }

    it('posts all merchant workflows with source documents, exact balances and weighted stock', async () => {
      const f = await merchantFixture(),
        productId = f.initial.products[0]!.id;
      const events = [
        f.event('sale', { productId, quantity: 10, unitPrice: '10' }),
        f.event('expense', { amount: '5' }),
        f.event('purchase', { productId, quantity: 5, unitPrice: '8' }),
        f.event('quotation', { productId, quantity: 3, unitPrice: '12' }),
        f.event('cash_receipt', { amount: '20' }),
      ];
      const results = await f.service.sync.push(f.enrolled.context, events);
      expect(results.map((r) => r.state)).toEqual(Array(5).fill('accepted'));
      const state = await f.service.snapshot(f.enrolled.context);
      expect(state.products[0]).toMatchObject({
        quantity: 95,
        value_minor: '58000',
      });
      const balance = Object.fromEntries(
        state.accounts.map((a) => [a.code, a.balance]),
      );
      expect(balance).toMatchObject({
        '1000': '7500',
        '1100': '-2000',
        '1200': '58000',
        '4000': '-10000',
        '5000': '6000',
        '6000': '500',
      });
      expect(
        Object.values(balance).reduce((s, v) => s + BigInt(String(v)), 0n),
      ).toBe(0n);
      expect(state.documents).toHaveLength(5);
      expect(state.journals).toHaveLength(5); // opening plus four financial records
      await f.service.deliver();
      await f.service.deliver();
      const delivered = await pool.query(
        'SELECT count(*)::int AS count FROM delivered_events WHERE tenant_id=$1',
        [f.enrolled.context.tenantId],
      );
      expect(delivered.rows[0].count).toBe(5);
    });

    it('versions quotations and prevents stock oversell without financial side effects', async () => {
      const f = await merchantFixture(),
        productId = f.initial.products[0]!.id;
      const quote = f.event('quotation', {
        productId,
        quantity: 1,
        unitPrice: '10',
      });
      expect(
        (await f.service.sync.push(f.enrolled.context, [quote]))[0]?.state,
      ).toBe('accepted');
      const edit = f.event('quotation', {
        ...(quote.payload as Record<string, string | number>),
        expectedVersion: 1,
        unitPrice: '11',
      });
      const rival = f.event('quotation', {
        ...(quote.payload as Record<string, string | number>),
        expectedVersion: 1,
        unitPrice: '12',
      });
      const responses = await f.service.sync.push(f.enrolled.context, [
        edit,
        rival,
        f.event('sale', { productId, quantity: 101, unitPrice: '10' }),
      ]);
      expect(responses.map((r) => r.state)).toEqual([
        'accepted',
        'conflict',
        'conflict',
      ]);
      const state = await f.service.snapshot(f.enrolled.context);
      expect(state.documents[0]).toMatchObject({
        version: 2,
        total_minor: '1100',
      });
      expect(state.products[0]?.quantity).toBe(100);
      expect(state.journals).toHaveLength(1);
    });

    it('requires authenticated ownership and bounds sessions and login attempts', async () => {
      const f = await merchantFixture();
      await expect(f.service.identity('forged')).rejects.toThrow();
      await expect(f.service.device('0'.repeat(64))).rejects.toThrow();
      await expect(
        f.service.enrol(
          f.login.identity,
          { deviceId: f.enrolled.context.deviceId },
          '',
        ),
      ).rejects.toThrow();
      await pool.query(
        "UPDATE online_sessions SET last_seen_at=now()-interval '31 minutes' WHERE credential_id IN(SELECT id FROM staff_credentials WHERE username=$1)",
        [f.username],
      );
      await expect(f.service.identity(f.login.token)).rejects.toThrow();
      for (let i = 0; i < 5; i++)
        await expect(
          f.service.login({
            username: f.username,
            password: 'Incorrect-password-123',
          }),
        ).rejects.toThrow();
      await expect(
        f.service.login({ username: f.username, password: f.password }),
      ).rejects.toThrow();
    });

    it('releases revoked work only after independent review and does not duplicate reviewed posting', async () => {
      const f = await merchantFixture(),
        event = f.event('expense', { amount: '7.25' });
      await f.service.authority.revoke(
        f.enrolled.context.tenantId,
        f.enrolled.context.deviceId,
        f.enrolled.context.actorId,
        'Synthetic revoked device',
      );
      expect(
        (await f.service.sync.push(f.enrolled.context, [event]))[0]?.state,
      ).toBe('quarantined');
      await expect(
        f.service.review(f.login.identity, {
          eventId: event.id,
          decision: 'release',
          reason: 'Check source',
        }),
      ).rejects.toThrow('different');
      const username = `review_${randomUUID().slice(0, 8)}`,
        password = 'Review-password-123!';
      await f.service.addReviewer(f.login.identity, { username, password });
      const reviewer = await f.service.login({ username, password });
      const first = await f.service.review(reviewer.identity, {
        eventId: event.id,
        decision: 'release',
        reason: 'Verified against source',
      });
      const second = await f.service.review(reviewer.identity, {
        eventId: event.id,
        decision: 'release',
        reason: 'Verified against source',
      });
      expect(first).toMatchObject({ state: 'accepted' });
      expect(second).toEqual(first);
      const original = await pool.query(
        'SELECT state FROM sync_events WHERE tenant_id=$1 AND id=$2',
        [f.enrolled.context.tenantId, event.id],
      );
      expect(original.rows[0].state).toBe('quarantined');
      const docs = await pool.query(
        'SELECT count(*)::int AS count FROM source_documents WHERE tenant_id=$1',
        [f.enrolled.context.tenantId],
      );
      expect(docs.rows[0].count).toBe(1);
      const source = await pool.query(
        'SELECT occurred_at FROM source_documents WHERE tenant_id=$1 AND id=$2',
        [f.enrolled.context.tenantId, event.payload.documentId],
      );
      expect(source.rows[0].occurred_at.toISOString()).toBe(event.capturedAt);
      const child = {
        ...f.event('expense', { amount: '1.25' }),
        dependsOn: [event.id],
      };
      expect(
        (await f.service.sync.push(f.enrolled.context, [child]))[0]?.state,
      ).toBe('quarantined');
      expect(
        await f.service.review(reviewer.identity, {
          eventId: child.id,
          decision: 'release',
          reason: 'Dependency independently reviewed',
        }),
      ).toMatchObject({ state: 'accepted' });
    });

    async function syncFixture() {
      const context = {
        tenantId: randomUUID(),
        actorId: randomUUID(),
        deviceId: randomUUID(),
      };
      const debit = randomUUID();
      const credit = randomUUID();
      await pool.query('INSERT INTO businesses(id,name) VALUES($1,$2)', [
        context.tenantId,
        'Synthetic sync business',
      ]);
      await pool.query(
        'INSERT INTO business_actors(tenant_id,id,can_manage_devices) VALUES($1,$2,true)',
        [context.tenantId, context.actorId],
      );
      await pool.query(
        "INSERT INTO accounts(tenant_id,id,code,name,kind) VALUES($1,$2,'1000','Cash','asset'),($1,$3,'4000','Synthetic income','income')",
        [context.tenantId, debit, credit],
      );
      const authority = new DeviceAuthority(pool);
      const grant = await authority.enrol(context);
      // Synthetic domain handler: account selection and lines come from trusted server code.
      // This is not a production sale posting policy or a client journal endpoint.
      const handler: SyncHandler = async (client, scope, event) => {
        const posted = await ledger.postInTransaction(client, scope.tenantId, {
          operationId: event.id,
          sourceId: event.id,
          occurredAt: event.capturedAt,
          description: 'Synthetic sync posting',
          currency: 'ZMW',
          lines: [
            { accountId: debit, side: 'debit', amount: '10' },
            { accountId: credit, side: 'credit', amount: '10' },
          ],
        });
        return { journalId: posted.journalId };
      };
      const sync = new SyncService(pool, { sale: handler });
      const event = (sequence = 1): SyncEnvelope => ({
        id: randomUUID(),
        schemaVersion: 1,
        sequence,
        grantId: grant.grantId,
        capturedAt: grant.issuedAt,
        kind: 'sale',
        payload: { quantity: 1 },
        dependsOn: [],
      });
      const counts = async () =>
        (
          await pool.query(
            `SELECT
        (SELECT count(*)::int FROM journals WHERE tenant_id=$1) AS journals,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=$1) AS outbox,
        (SELECT count(*)::int FROM sync_events WHERE tenant_id=$1) AS events`,
            [context.tenantId],
          )
        ).rows[0];
      return { context, authority, grant, handler, sync, event, counts };
    }

    it('sync replays ten concurrent lost-ack retries with one journal, outbox and stable receipt', async () => {
      const f = await syncFixture();
      const event = f.event();
      const results = await Promise.all(
        Array.from({ length: 10 }, () => f.sync.push(f.context, [event])),
      );
      expect(results.every((batch) => batch[0]?.state === 'accepted')).toBe(
        true,
      );
      expect(
        new Set(results.map((batch) => JSON.stringify(batch[0]))).size,
      ).toBe(1);
      expect(await f.counts()).toEqual({ journals: 1, outbox: 1, events: 1 });
      expect(
        (
          await f.sync.push(f.context, [{ ...event, payload: { quantity: 2 } }])
        )[0],
      ).toMatchObject({ state: 'conflict', reason: 'operation_reused' });
      expect((await f.sync.push(f.context, [f.event()]))[0]).toMatchObject({
        state: 'conflict',
        reason: 'sequence_reused',
      });
    });

    it('keeps out-of-order work waiting and accepts it on retry after its dependency', async () => {
      const f = await syncFixture();
      const parent = f.event();
      const child = { ...f.event(2), dependsOn: [parent.id] };
      expect(
        (await f.sync.push(f.context, [child, parent])).map(
          (item) => item.state,
        ),
      ).toEqual(['waiting', 'accepted']);
      expect((await f.sync.push(f.context, [child]))[0]).toMatchObject({
        state: 'accepted',
        cursor: '2',
      });
      expect(await f.counts()).toEqual({ journals: 2, outbox: 2, events: 2 });
    });

    it('isolates malformed/unsupported events and preserves failed dependency conflicts', async () => {
      const f = await syncFixture();
      const unsupported = { ...f.event(), kind: 'expense' };
      const dependent = { ...f.event(2), dependsOn: [unsupported.id] };
      const results = await f.sync.push(f.context, [
        { ...f.event(3), tenantId: randomUUID() },
        unsupported,
        dependent,
        f.event(4),
      ]);
      expect(results.map((item) => item.state)).toEqual([
        'rejected',
        'rejected',
        'conflict',
        'accepted',
      ]);
      expect(await f.counts()).toEqual({ journals: 1, outbox: 1, events: 3 });
    });

    it('quarantines revoked-device pending events but safely replays already accepted receipts', async () => {
      const f = await syncFixture();
      const accepted = f.event();
      const waiting = { ...f.event(2), dependsOn: [randomUUID()] };
      const original = (await f.sync.push(f.context, [accepted, waiting]))[0];
      await f.authority.revoke(
        f.context.tenantId,
        f.context.deviceId,
        f.context.actorId,
        'Synthetic revocation',
      );
      const pending = f.event(3);
      const results = await f.sync.push(f.context, [
        accepted,
        waiting,
        pending,
      ]);
      expect(results[0]).toEqual(original);
      expect(results.slice(1).map((item) => item.state)).toEqual([
        'quarantined',
        'quarantined',
      ]);
      const saved = await pool.query(
        'SELECT envelope FROM sync_events WHERE tenant_id=$1 AND id=$2',
        [f.context.tenantId, pending.id],
      );
      expect(saved.rows[0].envelope).toEqual(pending);
      expect(await f.counts()).toEqual({ journals: 1, outbox: 1, events: 3 });
      await expect(f.sync.pull(f.context)).rejects.toThrow('Active device');
    });

    it('quarantines expired grants and does not release old quarantine after renewal', async () => {
      const f = await syncFixture();
      const grantId = randomUUID();
      const stale = await pool.query(
        `INSERT INTO offline_grants(tenant_id,id,actor_id,device_id,issued_at,expires_at)
        VALUES($1,$2,$3,$4,now()-interval '25 hours',now()-interval '1 hour') RETURNING issued_at`,
        [f.context.tenantId, grantId, f.context.actorId, f.context.deviceId],
      );
      const event = {
        ...f.event(),
        grantId,
        capturedAt: stale.rows[0].issued_at.toISOString(),
      };
      expect((await f.sync.push(f.context, [event]))[0]?.state).toBe(
        'quarantined',
      );
      await f.authority.enrol(f.context);
      expect((await f.sync.push(f.context, [event]))[0]?.state).toBe(
        'quarantined',
      );
      expect(await f.counts()).toEqual({ journals: 0, outbox: 0, events: 1 });
    });

    it('rejects grants from another device and blocks unauthorised revocation', async () => {
      const f = await syncFixture();
      const other = { ...f.context, deviceId: randomUUID() };
      const otherGrant = await f.authority.enrol(other);
      expect(
        (
          await f.sync.push(f.context, [
            { ...f.event(), grantId: otherGrant.grantId },
          ])
        )[0],
      ).toMatchObject({ state: 'rejected', reason: 'invalid_grant' });
      await pool.query(
        'UPDATE business_actors SET can_manage_devices=false WHERE tenant_id=$1',
        [f.context.tenantId],
      );
      await expect(
        f.authority.revoke(
          f.context.tenantId,
          f.context.deviceId,
          f.context.actorId,
          'Not permitted',
        ),
      ).rejects.toThrow('authority');
      await pool.query(
        'UPDATE business_actors SET disabled_at=clock_timestamp() WHERE tenant_id=$1',
        [f.context.tenantId],
      );
      expect((await f.sync.push(f.context, [f.event()]))[0]?.state).toBe(
        'quarantined',
      );
      expect(await f.counts()).toEqual({ journals: 0, outbox: 0, events: 1 });
    });

    it('rolls back domain effects on version conflicts and lets unrelated work proceed', async () => {
      const f = await syncFixture();
      const sync = new SyncService(pool, {
        sale: async (client, context, event) => {
          const result = await f.handler(client, context, event);
          if (event.payload.fail)
            throw new DomainFailure('conflict', 'version_conflict');
          return result;
        },
      });
      const results = await sync.push(f.context, [
        { ...f.event(), payload: { fail: true } },
        f.event(2),
      ]);
      expect(results.map((item) => item.state)).toEqual([
        'conflict',
        'accepted',
      ]);
      expect(results[1]?.cursor).toBe('1');
      expect(await f.counts()).toEqual({ journals: 1, outbox: 1, events: 2 });
    });

    it('leaves transient failures retryable with no partial journal/outbox/outcome', async () => {
      const f = await syncFixture();
      const event = f.event();
      const failing = new SyncService(pool, {
        sale: async (client, context, envelope) => {
          await f.handler(client, context, envelope);
          throw new Error('Private infrastructure error');
        },
      });
      expect((await failing.push(f.context, [event]))[0]).toMatchObject({
        state: 'retry',
        reason: 'temporarily_unavailable',
      });
      expect(await f.counts()).toEqual({ journals: 0, outbox: 0, events: 0 });
      expect((await f.sync.push(f.context, [event]))[0]).toMatchObject({
        state: 'accepted',
        cursor: '1',
      });
    });

    it('rejects deferred unbalanced SQL effects before accepting a sync event', async () => {
      const f = await syncFixture();
      const failing = new SyncService(pool, {
        sale: async (client, context, event) => {
          await client.query(
            `INSERT INTO journals(tenant_id,id,operation_id,source_id,occurred_at,description,payload_hash)
          VALUES($1,$2,$2,$2,now(),'Unbalanced synthetic SQL',$3)`,
            [context.tenantId, event.id, 'a'.repeat(64)],
          );
          return {};
        },
      });
      expect((await failing.push(f.context, [f.event()]))[0]?.state).toBe(
        'retry',
      );
      expect(await f.counts()).toEqual({ journals: 0, outbox: 0, events: 0 });
    });

    it('paginates concurrent accepted events in tenant-scoped commit order without omissions', async () => {
      const f = await syncFixture();
      const events = Array.from({ length: 10 }, (_, index) =>
        f.event(index + 1),
      );
      const results = await Promise.all(
        events.map((event) => f.sync.push(f.context, [event])),
      );
      expect(results.every((batch) => batch[0]?.state === 'accepted')).toBe(
        true,
      );
      let cursor = '0';
      const ids: string[] = [];
      for (;;) {
        const page = await f.sync.pull(f.context, cursor, 3);
        ids.push(...page.events.map((event) => event.id));
        cursor = page.cursor;
        if (!page.hasMore) break;
      }
      expect(cursor).toBe('10');
      expect(ids).toHaveLength(10);
      expect(new Set(ids)).toEqual(new Set(events.map((event) => event.id)));
      expect((await f.sync.pull(f.context, cursor)).events).toEqual([]);
      const other = await syncFixture();
      expect((await other.sync.pull(other.context)).events).toEqual([]);
      expect(
        (
          await f.sync.push(
            { ...f.context, tenantId: other.context.tenantId },
            [f.event(11)],
          )
        )[0]?.state,
      ).toBe('rejected');
      await expect(f.sync.pull(f.context, '-1')).rejects.toThrow();
    });

    function input() {
      return {
        operationId: randomUUID(),
        sourceId: randomUUID(),
        occurredAt: '2026-09-13T12:00:00Z',
        description: 'Synthetic posting',
        currency: 'ZMW',
        lines: [
          { accountId: cash, side: 'debit', amount: '40' },
          { accountId: income, side: 'credit', amount: '40' },
        ],
      };
    }

    it('posts once under ten concurrent retries, with one durable outbox entry', async () => {
      const journal = input();
      const results = await Promise.all(
        Array.from({ length: 10 }, () => ledger.post(tenant, journal)),
      );
      expect(new Set(results.map((result) => result.journalId)).size).toBe(1);
      expect(results.filter((result) => !result.replayed)).toHaveLength(1);
      const counts = await pool.query(
        `SELECT
      (SELECT count(*)::int FROM journals WHERE tenant_id=$1 AND operation_id=$2) AS journals,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=$1 AND journal_id=$3) AS outbox`,
        [tenant, journal.operationId, results[0]!.journalId],
      );
      expect(counts.rows[0]).toEqual({ journals: 1, outbox: 1 });
      await expect(
        ledger.post(tenant, { ...journal, description: 'Changed request' }),
      ).rejects.toThrow('different content');
      await expect(
        ledger.post(tenant, { ...journal, operationId: randomUUID() }),
      ).rejects.toThrow();
    });

    it('rolls back cross-business accounts and leaves no journal or outbox', async () => {
      const journal = input();
      journal.lines[0]!.accountId = otherAccount;
      await expect(ledger.post(tenant, journal)).rejects.toThrow();
      expect(
        (
          await pool.query('SELECT id FROM journals WHERE operation_id=$1', [
            journal.operationId,
          ])
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await pool.query(
            'SELECT * FROM outbox WHERE journal_id NOT IN (SELECT id FROM journals)',
          )
        ).rowCount,
      ).toBe(0);
    });

    it('database rejects unbalanced and empty journals even when bypassing TypeScript', async () => {
      for (const withLine of [true, false]) {
        const client = await pool.connect();
        const id = randomUUID();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO journals(tenant_id,id,operation_id,source_id,occurred_at,description,payload_hash)
          VALUES($1,$2,$3,$4,now(),'Invalid direct SQL',$5)`,
            [tenant, id, randomUUID(), randomUUID(), 'a'.repeat(64)],
          );
          if (withLine)
            await client.query(
              'INSERT INTO journal_lines VALUES ($1,$2,1,$3,4000)',
              [tenant, id, cash],
            );
          await expect(client.query('COMMIT')).rejects.toThrow('balance');
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
        expect(
          (await pool.query('SELECT * FROM journals WHERE id=$1', [id]))
            .rowCount,
        ).toBe(0);
        expect(
          (await pool.query('SELECT * FROM outbox WHERE journal_id=$1', [id]))
            .rowCount,
        ).toBe(0);
      }
    });

    it('rejects journal edits, deletions and appending lines after commit', async () => {
      const { journalId } = await ledger.post(tenant, input());
      await expect(
        pool.query("UPDATE journals SET description='tampered' WHERE id=$1", [
          journalId,
        ]),
      ).rejects.toThrow('append-only');
      await expect(
        pool.query('DELETE FROM journal_lines WHERE journal_id=$1', [
          journalId,
        ]),
      ).rejects.toThrow('append-only');
      await expect(
        pool.query('INSERT INTO journal_lines VALUES($1,$2,3,$3,100)', [
          tenant,
          journalId,
          cash,
        ]),
      ).rejects.toThrow('committed');
    });
  },
);
