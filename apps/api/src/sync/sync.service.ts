import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  lockBusiness,
  scopeSchema,
  type TrustedDeviceContext,
} from './device-authority';

const uuid = z.uuid().transform((value) => value.toLowerCase());
const envelopeSchema = z
  .object({
    id: uuid,
    schemaVersion: z.literal(1),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    grantId: uuid,
    capturedAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
    kind: z.enum(['sale', 'quotation', 'cash_receipt', 'purchase', 'expense']),
    payload: z.record(z.string(), z.json()),
    dependsOn: z.array(uuid).max(100).default([]),
  })
  .strict();
export type SyncEnvelope = z.infer<typeof envelopeSchema>;
type Json = z.infer<ReturnType<typeof z.json>>;
type State = 'accepted' | 'waiting' | 'rejected' | 'conflict' | 'quarantined';
export interface SyncOutcome {
  id: string | null;
  state: State | 'retry';
  reason: string | null;
  cursor: string | null;
  result: Json | null;
}
type Stored = SyncOutcome & {
  payload_hash: string;
  actor_id: string;
  device_id: string;
};

/** Only trusted domain handlers construct financial effects. Never pass client journal lines directly. */
export type SyncHandler = (
  client: PoolClient,
  context: TrustedDeviceContext,
  event: SyncEnvelope,
) => Promise<Json>;
export class DomainFailure extends Error {
  constructor(
    readonly state: 'rejected' | 'conflict',
    readonly reason:
      | 'invalid_transaction'
      | 'version_conflict'
      | 'source_already_posted'
      | 'insufficient_stock',
  ) {
    super(reason);
  }
}

function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]!))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
function outcome(
  id: string | null,
  state: SyncOutcome['state'],
  reason: string | null = null,
): SyncOutcome {
  return { id, state, reason, cursor: null, result: null };
}
function receipt(row: Stored): SyncOutcome {
  return {
    id: row.id,
    state: row.state,
    reason: row.reason,
    cursor: row.cursor,
    result: row.result,
  };
}

/** Internal boundary: context must come from authenticated server authority, not request JSON.
 * Each event has its own transaction. A transient error leaves no terminal outcome.
 */
export class SyncService {
  constructor(
    private readonly pool: Pool,
    private readonly handlers: Partial<
      Record<SyncEnvelope['kind'], SyncHandler>
    >,
  ) {}

  async push(
    context: TrustedDeviceContext,
    inputs: unknown[],
    onlineReview = false,
  ) {
    context = scopeSchema.parse(context);
    z.array(z.unknown()).max(100).parse(inputs);
    const results: SyncOutcome[] = [];
    for (const input of inputs) {
      let event: SyncEnvelope;
      try {
        if (Buffer.byteLength(JSON.stringify(input) ?? '') > 65536)
          throw new Error('Too large');
        event = envelopeSchema.parse(input);
        event.dependsOn = [...new Set(event.dependsOn)].sort();
        if (event.dependsOn.includes(event.id))
          throw new Error('Self dependency');
      } catch {
        const candidate = z.object({ id: uuid }).safeParse(input);
        results.push(
          outcome(
            candidate.success ? candidate.data.id : null,
            'rejected',
            'invalid_envelope',
          ),
        );
        continue;
      }
      try {
        results.push(await this.accept(context, event, onlineReview));
      } catch {
        results.push(outcome(event.id, 'retry', 'temporarily_unavailable'));
      }
    }
    return results;
  }

  private async accept(
    context: TrustedDeviceContext,
    event: SyncEnvelope,
    onlineReview = false,
  ): Promise<SyncOutcome> {
    const hash = createHash('sha256').update(canonical(event)).digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await lockBusiness(client, context.tenantId);
      const device = await client.query<{
        disabled_at: Date | null;
        revoked_at: Date | null;
      }>(
        `SELECT a.disabled_at,d.revoked_at FROM business_actors a JOIN devices d
         ON d.tenant_id=a.tenant_id AND d.actor_id=a.id
         WHERE a.tenant_id=$1 AND a.id=$2 AND d.id=$3 FOR SHARE OF a,d`,
        [context.tenantId, context.actorId, context.deviceId],
      );
      if (!device.rowCount) {
        await client.query('ROLLBACK');
        return outcome(event.id, 'rejected', 'unknown_device');
      }
      const prior = await client.query<Stored>(
        'SELECT id,state,reason,cursor::text,result,payload_hash,actor_id,device_id FROM sync_events WHERE tenant_id=$1 AND id=$2',
        [context.tenantId, event.id],
      );
      const existing = prior.rows[0];
      if (
        existing &&
        (existing.payload_hash !== hash ||
          existing.actor_id !== context.actorId.toLowerCase() ||
          existing.device_id !== context.deviceId.toLowerCase())
      ) {
        await client.query('ROLLBACK');
        return outcome(event.id, 'conflict', 'operation_reused');
      }
      if (existing && existing.state !== 'waiting') {
        await client.query('COMMIT');
        return receipt(existing);
      }
      const grant = await client.query<{ valid: boolean }>(
        `SELECT issued_at <= $5::timestamptz AND $5::timestamptz < expires_at
          AND clock_timestamp() < expires_at AND $5::timestamptz <= clock_timestamp() AS valid
         FROM offline_grants WHERE tenant_id=$1 AND id=$2 AND actor_id=$3 AND device_id=$4`,
        [
          context.tenantId,
          event.grantId,
          context.actorId,
          context.deviceId,
          event.capturedAt,
        ],
      );
      if (!grant.rowCount) {
        await client.query('ROLLBACK');
        return outcome(event.id, 'rejected', 'invalid_grant');
      }
      if (!existing) {
        const sequence = await client.query(
          'SELECT id FROM sync_events WHERE tenant_id=$1 AND device_id=$2 AND device_sequence=$3',
          [context.tenantId, context.deviceId, event.sequence],
        );
        if (sequence.rowCount) {
          await client.query('ROLLBACK');
          return outcome(event.id, 'conflict', 'sequence_reused');
        }
        await client.query(
          `INSERT INTO sync_events(tenant_id,id,actor_id,device_id,device_sequence,grant_id,payload_hash,envelope,state)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'waiting')`,
          [
            context.tenantId,
            event.id,
            context.actorId,
            context.deviceId,
            event.sequence,
            event.grantId,
            hash,
            event,
          ],
        );
      }
      const finish = async (
        state: State,
        reason: string | null,
        cursor: string | null = null,
        result: Json | null = null,
      ) => {
        await client.query(
          'UPDATE sync_events SET state=$3,reason=$4,cursor=$5,result=$6 WHERE tenant_id=$1 AND id=$2',
          [
            context.tenantId,
            event.id,
            state,
            reason,
            cursor,
            result === null ? null : JSON.stringify(result),
          ],
        );
        await client.query('COMMIT');
        return { id: event.id, state, reason, cursor, result };
      };
      const authority = device.rows[0]!;
      // Only a fresh authenticated review call may resume a stored, server-created approval.
      const reviewed =
        onlineReview &&
        (
          await client.query(
            `SELECT 1 FROM sync_reviews WHERE tenant_id=$1 AND reviewer_id=$2 AND decision='release' AND envelope->>'id'=$3 AND context->>'deviceId'=$4`,
            [context.tenantId, context.actorId, event.id, context.deviceId],
          )
        ).rowCount === 1;
      if (
        authority.disabled_at ||
        authority.revoked_at ||
        (!grant.rows[0]!.valid && !reviewed)
      )
        return await finish(
          'quarantined',
          authority.disabled_at
            ? 'actor_disabled'
            : authority.revoked_at
              ? 'device_revoked'
              : 'offline_grant_expired_or_invalid_time',
        );
      if (event.dependsOn.length) {
        const dependencies = await client.query<{ state: State }>(
          `SELECT coalesce(released.state,e.state) AS state FROM sync_events e
           LEFT JOIN sync_reviews r ON r.tenant_id=e.tenant_id AND r.event_id=e.id AND r.decision='release'
           LEFT JOIN sync_events released ON released.tenant_id=e.tenant_id AND released.id=(r.envelope->>'id')::uuid
           WHERE e.tenant_id=$1 AND e.id=ANY($2::uuid[])`,
          [context.tenantId, event.dependsOn],
        );
        if (
          dependencies.rows.some(
            (row) => !['accepted', 'waiting'].includes(row.state),
          )
        )
          return await finish('conflict', 'dependency_not_accepted');
        if (
          dependencies.rowCount !== event.dependsOn.length ||
          dependencies.rows.some((row) => row.state === 'waiting')
        )
          return await finish('waiting', 'dependency_pending');
      }
      const handler = this.handlers[event.kind];
      if (!handler) return await finish('rejected', 'unsupported_workflow');
      await client.query('SAVEPOINT domain_effects');
      let result: Json;
      try {
        result = z.json().parse(await handler(client, context, event));
        // Force deferred ledger checks inside this savepoint before recording acceptance.
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT domain_effects');
        if (error instanceof DomainFailure)
          return await finish(error.state, error.reason);
        throw error;
      }
      await client.query(
        'INSERT INTO sync_counters(tenant_id) VALUES($1) ON CONFLICT DO NOTHING',
        [context.tenantId],
      );
      const cursor = await client.query<{ value: string }>(
        'UPDATE sync_counters SET value=value+1 WHERE tenant_id=$1 RETURNING value::text',
        [context.tenantId],
      );
      return await finish('accepted', null, cursor.rows[0]!.value, result);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async pull(context: TrustedDeviceContext, after = '0', limit = 100) {
    context = scopeSchema.parse(context);
    z.string()
      .regex(/^(0|[1-9]\d{0,18})$/)
      .refine((value) => BigInt(value) <= 9223372036854775807n)
      .parse(after);
    z.number().int().min(1).max(100).parse(limit);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await lockBusiness(client, context.tenantId);
      const allowed = await client.query(
        `SELECT d.id FROM devices d JOIN business_actors a ON a.tenant_id=d.tenant_id AND a.id=d.actor_id
        WHERE d.tenant_id=$1 AND d.id=$2 AND d.actor_id=$3 AND d.revoked_at IS NULL AND a.disabled_at IS NULL FOR SHARE OF a,d`,
        [context.tenantId, context.deviceId, context.actorId],
      );
      if (!allowed.rowCount)
        throw new Error('Active device authority required');
      const rows = await client.query<{
        id: string;
        cursor: string;
        envelope: SyncEnvelope;
        result: Json;
      }>(
        `SELECT id,cursor::text,envelope,result FROM sync_events WHERE tenant_id=$1 AND state='accepted' AND cursor>$2::bigint ORDER BY sync_events.cursor LIMIT $3`,
        [context.tenantId, after, limit + 1],
      );
      const events = rows.rows.slice(0, limit);
      await client.query('COMMIT');
      return {
        events,
        cursor: events.at(-1)?.cursor ?? after,
        hasMore: rows.rows.length > limit,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
