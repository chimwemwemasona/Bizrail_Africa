import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hash, verify } from 'argon2';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DeviceAuthority,
  lockBusiness,
  type TrustedDeviceContext,
} from '../sync/device-authority';
import { SyncService, type SyncEnvelope } from '../sync/sync.service';
import { LedgerRepository } from '../ledger/ledger.repository';
import { deliverOutbox, postingHandler } from './posting';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const credentials = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_.-]{3,64}$/),
    password: z.string().min(12).max(128),
  })
  .strict();
export interface Identity {
  tenantId: string;
  actorId: string;
  username: string;
  name: string;
  canManage: boolean;
}
export class WorkspaceService {
  readonly sync: SyncService;
  readonly authority: DeviceAuthority;
  private timer?: ReturnType<typeof setInterval>;
  private delivering = false;
  constructor(
    readonly pool: Pool,
    private readonly localDevelopment = process.env.NODE_ENV ===
      'development' || process.env.BIZRAIL_DEMO_MODE === 'true',
  ) {
    const handler = postingHandler(pool);
    this.sync = new SyncService(pool, {
      sale: handler,
      quotation: handler,
      cash_receipt: handler,
      purchase: handler,
      expense: handler,
    });
    this.authority = new DeviceAuthority(pool);
    pool.on('error', () => {});
  }
  onModuleInit() {
    if (process.env.DATABASE_URL) {
      this.timer = setInterval(() => {
        void this.deliver().catch(() => {});
      }, 3000);
      this.timer.unref();
    }
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.pool.end();
  }
  async transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const result = await work(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async deliver() {
    if (this.delivering) return;
    this.delivering = true;
    try {
      return await this.transaction(deliverOutbox);
    } finally {
      this.delivering = false;
    }
  }

  async register(input: unknown) {
    if (!this.localDevelopment)
      throw new ForbiddenException('Local development setup is disabled');
    const parsed = credentials
      .extend({ name: z.string().trim().min(1).max(100) })
      .parse(input);
    const passwordHash = await hash(parsed.password);
    const tenantId = randomUUID(),
      actorId = randomUUID();
    await this.transaction(async (c) => {
      if (
        (
          await c.query('SELECT 1 FROM staff_credentials WHERE username=$1', [
            parsed.username,
          ])
        ).rowCount
      )
        throw new BadRequestException('Unable to create this username');
      await c.query('INSERT INTO businesses(id,name) VALUES($1,$2)', [
        tenantId,
        parsed.name,
      ]);
      await c.query(
        'INSERT INTO business_actors(tenant_id,id,can_manage_devices) VALUES($1,$2,true)',
        [tenantId, actorId],
      );
      await c.query('INSERT INTO staff_credentials VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        tenantId,
        actorId,
        parsed.username,
        passwordHash,
      ]);
      const chart = [
        ['1000', 'Cash', 'asset'],
        ['1100', 'Receivables', 'asset'],
        ['1200', 'Inventory', 'asset'],
        ['2000', 'Payables', 'liability'],
        ['3000', 'Opening equity', 'equity'],
        ['4000', 'Sales', 'income'],
        ['5000', 'Cost of sales', 'expense'],
        ['6000', 'Operating expenses', 'expense'],
      ];
      const ids: Record<string, string> = {};
      for (const [code, name, kind] of chart) {
        const id = randomUUID();
        ids[code!] = id;
        await c.query(
          'INSERT INTO accounts(tenant_id,id,code,name,kind) VALUES($1,$2,$3,$4,$5)',
          [tenantId, id, code, name, kind],
        );
      }
      const product = randomUUID();
      await c.query(
        'INSERT INTO products(tenant_id,id,name,price_minor,quantity,value_minor) VALUES($1,$2,$3,1000,100,60000)',
        [tenantId, product, 'Sample item'],
      );
      await new LedgerRepository(this.pool).postInTransaction(c, tenantId, {
        operationId: randomUUID(),
        sourceId: randomUUID(),
        occurredAt: new Date().toISOString(),
        description: 'Development opening stock: 100 sample units',
        currency: 'ZMW',
        lines: [
          { accountId: ids['1200'], side: 'debit', amount: '600' },
          { accountId: ids['3000'], side: 'credit', amount: '600' },
        ],
      });
    });
    return this.login({ username: parsed.username, password: parsed.password });
  }
  async login(input: unknown) {
    const { username, password } = credentials.parse(input);
    const token = randomBytes(32).toString('hex');
    const result = await this.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `login:${username}`,
      ]);
      await c.query(
        `INSERT INTO login_attempts(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 0 ELSE login_attempts.failures END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END`,
        [username],
      );
      const attempt = await c.query<{ failures: number }>(
        'SELECT failures FROM login_attempts WHERE key=$1',
        [username],
      );
      if (attempt.rows[0]!.failures >= 5) return false;
      const account = await c.query<{ id: string; password_hash: string }>(
        `SELECT s.id,s.password_hash FROM staff_credentials s JOIN business_actors a ON a.tenant_id=s.tenant_id AND a.id=s.actor_id WHERE s.username=$1 AND a.disabled_at IS NULL`,
        [username],
      );
      const row = account.rows[0];
      const valid = row
        ? await verify(row.password_hash, password)
        : (await hash(password), false);
      if (!valid) {
        await c.query(
          'UPDATE login_attempts SET failures=failures+1 WHERE key=$1',
          [username],
        );
        return false;
      }
      await c.query('UPDATE login_attempts SET failures=0 WHERE key=$1', [
        username,
      ]);
      await c.query(
        'INSERT INTO online_sessions(token_hash,credential_id) VALUES($1,$2)',
        [digest(token), row!.id],
      );
      return true;
    });
    if (!result)
      throw new UnauthorizedException(
        'Unable to sign in. Check credentials or try again later.',
      );
    return { token, identity: await this.identity(token) };
  }
  async identity(token: string): Promise<Identity> {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Sign in online');
    const rows = await this.pool.query<Identity>(
      `UPDATE online_sessions o SET last_seen_at=clock_timestamp()
      FROM staff_credentials s,business_actors a,businesses b WHERE o.token_hash=$1 AND s.id=o.credential_id AND a.tenant_id=s.tenant_id AND a.id=s.actor_id AND b.id=s.tenant_id AND a.disabled_at IS NULL AND o.expires_at>clock_timestamp() AND o.last_seen_at>clock_timestamp()-interval '30 minutes'
      RETURNING s.tenant_id AS "tenantId",s.actor_id AS "actorId",s.username,b.name,a.can_manage_devices AS "canManage"`,
      [digest(token)],
    );
    if (!rows.rowCount) throw new UnauthorizedException('Sign in online');
    return rows.rows[0]!;
  }
  async logout(token: string, deviceToken = '') {
    if (deviceToken) {
      const context = await this.device(deviceToken);
      await this.transaction(async (c) => {
        await lockBusiness(c, context.tenantId);
        await c.query(
          'UPDATE devices SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE tenant_id=$1 AND id=$2',
          [context.tenantId, context.deviceId],
        );
        await c.query(
          "INSERT INTO device_audit(tenant_id,actor_id,device_id,action,reason) VALUES($1,$2,$3,'device_revoked','Device signed out after pending-work check')",
          [context.tenantId, context.actorId, context.deviceId],
        );
      });
    }
    await this.pool.query('DELETE FROM online_sessions WHERE token_hash=$1', [
      digest(token),
    ]);
    return { ok: true };
  }
  async device(token: string): Promise<TrustedDeviceContext> {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Enrol this device online');
    const result = await this.pool.query<TrustedDeviceContext>(
      'SELECT tenant_id AS "tenantId",actor_id AS "actorId",device_id AS "deviceId" FROM device_credentials WHERE token_hash=$1',
      [digest(token)],
    );
    if (!result.rowCount)
      throw new UnauthorizedException('Enrol this device online');
    return result.rows[0]!;
  }
  async enrol(identity: Identity, input: unknown, priorToken: string) {
    const { deviceId } = z.object({ deviceId: z.uuid() }).strict().parse(input);
    const context = {
      tenantId: identity.tenantId,
      actorId: identity.actorId,
      deviceId,
    };
    const existing = await this.pool.query(
      'SELECT id FROM devices WHERE tenant_id=$1 AND id=$2',
      [context.tenantId, deviceId],
    );
    let deviceToken = priorToken;
    if (existing.rowCount) {
      const old = await this.device(priorToken);
      if (JSON.stringify(old) !== JSON.stringify(context))
        throw new ForbiddenException('Device ownership mismatch');
    } else deviceToken = randomBytes(32).toString('hex');
    const leaseMinutes = z.coerce
      .number()
      .int()
      .min(1)
      .max(1440)
      .parse(process.env.OFFLINE_LEASE_MINUTES ?? 1440);
    const grant = await this.authority.enrol(context, leaseMinutes);
    if (!existing.rowCount)
      await this.pool.query(
        'INSERT INTO device_credentials VALUES($1,$2,$3,$4)',
        [digest(deviceToken), context.tenantId, context.actorId, deviceId],
      );
    return { context, grant, deviceToken, identity };
  }
  async snapshot(context: TrustedDeviceContext) {
    return this.transaction(async (c) => {
      await lockBusiness(c, context.tenantId);
      const allowed = await c.query(
        'SELECT d.id FROM devices d JOIN business_actors a ON a.tenant_id=d.tenant_id AND a.id=d.actor_id WHERE d.tenant_id=$1 AND d.id=$2 AND d.actor_id=$3 AND d.revoked_at IS NULL AND a.disabled_at IS NULL',
        [context.tenantId, context.deviceId, context.actorId],
      );
      if (!allowed.rowCount)
        throw new ForbiddenException(
          'Device or actor revoked. Pending work must be reviewed.',
        );
      const products = (
        await c.query(
          'SELECT id,name,price_minor::text,quantity,value_minor::text,version FROM products WHERE tenant_id=$1 ORDER BY name',
          [context.tenantId],
        )
      ).rows;
      const accounts = (
        await c.query(
          `SELECT a.id,a.code,a.name,a.kind,coalesce(sum(l.amount_minor),0)::text AS balance FROM accounts a LEFT JOIN journal_lines l ON l.tenant_id=a.tenant_id AND l.account_id=a.id WHERE a.tenant_id=$1 GROUP BY a.id,a.code,a.name,a.kind ORDER BY a.code`,
          [context.tenantId],
        )
      ).rows;
      const documents = (
        await c.query(
          'SELECT id,kind,version,payload,total_minor::text,journal_id,occurred_at FROM source_documents WHERE tenant_id=$1 ORDER BY occurred_at DESC',
          [context.tenantId],
        )
      ).rows;
      const journals = (
        await c.query(
          `SELECT j.id,j.source_id,j.description,j.occurred_at,jsonb_agg(jsonb_build_object('code',a.code,'name',a.name,'amount',l.amount_minor::text) ORDER BY l.line_no) AS lines FROM journals j JOIN journal_lines l ON l.tenant_id=j.tenant_id AND l.journal_id=j.id JOIN accounts a ON a.tenant_id=l.tenant_id AND a.id=l.account_id WHERE j.tenant_id=$1 GROUP BY j.tenant_id,j.id ORDER BY j.accepted_at DESC`,
          [context.tenantId],
        )
      ).rows;
      const outcomes = (
        await c.query(
          'SELECT id,state,reason,cursor::text,result FROM sync_events WHERE tenant_id=$1 AND actor_id=$2 AND device_id=$3',
          [context.tenantId, context.actorId, context.deviceId],
        )
      ).rows;
      const cursor =
        (
          await c.query(
            'SELECT value::text FROM sync_counters WHERE tenant_id=$1',
            [context.tenantId],
          )
        ).rows[0]?.value ?? '0';
      return {
        products,
        accounts,
        documents,
        journals,
        outcomes,
        cursor,
        at: new Date().toISOString(),
      };
    });
  }
  async administration(identity: Identity) {
    if (!identity.canManage) throw new ForbiddenException();
    const devices = (
      await this.pool.query(
        'SELECT d.id,d.actor_id,d.revoked_at,s.username FROM devices d JOIN staff_credentials s ON s.tenant_id=d.tenant_id AND s.actor_id=d.actor_id WHERE d.tenant_id=$1',
        [identity.tenantId],
      )
    ).rows;
    const review = (
      await this.pool.query(
        `SELECT e.id,e.actor_id,e.device_id,e.envelope,e.state,e.reason,r.decision,r.reason AS review_reason FROM sync_events e LEFT JOIN sync_reviews r ON r.tenant_id=e.tenant_id AND r.event_id=e.id WHERE e.tenant_id=$1 AND e.state IN ('quarantined','conflict','rejected') ORDER BY e.received_at DESC`,
        [identity.tenantId],
      )
    ).rows;
    return { devices, review };
  }
  async addReviewer(identity: Identity, input: unknown) {
    if (!identity.canManage || !this.localDevelopment)
      throw new ForbiddenException();
    const account = credentials.parse(input),
      passwordHash = await hash(account.password);
    await this.transaction(async (c) => {
      const actor = randomUUID();
      await c.query(
        'INSERT INTO business_actors(tenant_id,id,can_manage_devices) VALUES($1,$2,true)',
        [identity.tenantId, actor],
      );
      await c.query('INSERT INTO staff_credentials VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        identity.tenantId,
        actor,
        account.username,
        passwordHash,
      ]);
    });
    return { ok: true };
  }
  async review(identity: Identity, input: unknown) {
    if (!identity.canManage) throw new ForbiddenException();
    const data = z
      .object({
        eventId: z.uuid(),
        decision: z.enum(['reject', 'release']),
        reason: z.string().trim().min(3).max(500),
      })
      .strict()
      .parse(input);
    const stored = await this.transaction(async (c) => {
      await lockBusiness(c, identity.tenantId);
      const row = (
        await c.query<{
          actor_id: string;
          state: string;
          envelope: SyncEnvelope;
        }>(
          'SELECT actor_id,state,envelope FROM sync_events WHERE tenant_id=$1 AND id=$2',
          [identity.tenantId, data.eventId],
        )
      ).rows[0];
      if (!row || row.state !== 'quarantined')
        throw new BadRequestException('Only quarantined work can be reviewed');
      if (row.actor_id === identity.actorId)
        throw new ForbiddenException(
          'A different authorised reviewer must decide',
        );
      const prior = (
        await c.query(
          'SELECT decision,context,envelope FROM sync_reviews WHERE tenant_id=$1 AND event_id=$2',
          [identity.tenantId, data.eventId],
        )
      ).rows[0];
      if (prior) {
        if (prior.decision !== data.decision)
          throw new BadRequestException('Review decision is final');
        return prior;
      }
      let context: TrustedDeviceContext | null = null,
        envelope: SyncEnvelope | null = null;
      if (data.decision === 'release') {
        context = {
          tenantId: identity.tenantId,
          actorId: identity.actorId,
          deviceId: randomUUID(),
        };
        await c.query(
          'INSERT INTO devices(tenant_id,id,actor_id) VALUES($1,$2,$3)',
          [context.tenantId, context.deviceId, context.actorId],
        );
        const grantId = randomUUID();
        const grant = (
          await c.query(
            `WITH t AS(SELECT date_trunc('milliseconds',clock_timestamp()) AS at) INSERT INTO offline_grants(tenant_id,id,actor_id,device_id,issued_at,expires_at) SELECT $1,$2,$3,$4,at,at+interval '24 hours' FROM t RETURNING issued_at`,
            [context.tenantId, grantId, context.actorId, context.deviceId],
          )
        ).rows[0];
        envelope = {
          ...row.envelope,
          id: randomUUID(),
          sequence: 1,
          grantId,
          capturedAt: grant.issued_at.toISOString(),
        };
      }
      await c.query(
        'INSERT INTO sync_reviews(tenant_id,event_id,reviewer_id,decision,reason,context,envelope) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          identity.tenantId,
          data.eventId,
          identity.actorId,
          data.decision,
          data.reason,
          context,
          envelope,
        ],
      );
      return { decision: data.decision, context, envelope };
    });
    // Stable reviewed event identity makes a crash between approval and posting safely resumable.
    if (stored.decision === 'release')
      return (await this.sync.push(stored.context, [stored.envelope], true))[0];
    return { state: 'rejected', reason: 'review_rejected' };
  }
}
