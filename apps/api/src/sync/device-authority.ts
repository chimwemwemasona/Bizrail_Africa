import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export const scopeSchema = z
  .object({ tenantId: z.uuid(), actorId: z.uuid(), deviceId: z.uuid() })
  .strict();
export type TrustedDeviceContext = z.infer<typeof scopeSchema>;

/** Serialize authority changes and sync for one business, retaining lock to commit. */
export async function lockBusiness(client: PoolClient, tenantId: string) {
  const business = await client.query(
    'SELECT id FROM businesses WHERE id=$1 FOR UPDATE',
    [tenantId],
  );
  if (!business.rowCount) throw new Error('Unknown business');
}

/** Called only by a trusted online enrolment/session boundary, never a device payload. */
export class DeviceAuthority {
  constructor(private readonly pool: Pool) {}

  async enrol(context: TrustedDeviceContext, durationMinutes = 24 * 60) {
    scopeSchema.parse(context);
    z.number().int().min(1).max(1440).parse(durationMinutes);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await lockBusiness(client, context.tenantId);
      const actor = await client.query(
        'SELECT id FROM business_actors WHERE tenant_id=$1 AND id=$2 AND disabled_at IS NULL FOR SHARE',
        [context.tenantId, context.actorId],
      );
      if (!actor.rowCount)
        throw new Error('Actor is not active in this business');
      await client.query(
        'INSERT INTO devices(tenant_id,id,actor_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [context.tenantId, context.deviceId, context.actorId],
      );
      const device = await client.query<{
        actor_id: string;
        revoked_at: Date | null;
      }>(
        'SELECT actor_id,revoked_at FROM devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [context.tenantId, context.deviceId],
      );
      if (
        device.rows[0]?.actor_id !== context.actorId ||
        device.rows[0].revoked_at
      )
        throw new Error('Device is revoked or belongs to another actor');
      const grant = await client.query<{
        id: string;
        issued_at: Date;
        expires_at: Date;
      }>(
        `WITH issued AS (SELECT date_trunc('milliseconds',clock_timestamp()) AS at)
         INSERT INTO offline_grants(tenant_id,id,actor_id,device_id,issued_at,expires_at)
         SELECT $1,$2,$3,$4,at,at + ($5 * interval '1 minute') FROM issued RETURNING id,issued_at,expires_at`,
        [
          context.tenantId,
          randomUUID(),
          context.actorId,
          context.deviceId,
          durationMinutes,
        ],
      );
      await client.query(
        "INSERT INTO device_audit(tenant_id,actor_id,device_id,action,reason) VALUES ($1,$2,$3,'grant_issued','Online device enrolment or renewal')",
        [context.tenantId, context.actorId, context.deviceId],
      );
      await client.query('COMMIT');
      const row = grant.rows[0]!;
      return {
        ...context,
        grantId: row.id,
        issuedAt: row.issued_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async revoke(
    tenantId: string,
    deviceId: string,
    approvingActorId: string,
    reason: string,
  ) {
    [tenantId, deviceId, approvingActorId].forEach((id) => z.uuid().parse(id));
    z.string().trim().min(1).max(500).parse(reason);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await lockBusiness(client, tenantId);
      const approver = await client.query(
        'SELECT id FROM business_actors WHERE tenant_id=$1 AND id=$2 AND disabled_at IS NULL AND can_manage_devices FOR SHARE',
        [tenantId, approvingActorId],
      );
      if (!approver.rowCount)
        throw new Error('Device management authority is required');
      const updated = await client.query(
        'UPDATE devices SET revoked_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING id',
        [tenantId, deviceId],
      );
      if (updated.rowCount)
        await client.query(
          "INSERT INTO device_audit(tenant_id,actor_id,device_id,action,reason) VALUES ($1,$2,$3,'device_revoked',$4)",
          [tenantId, approvingActorId, deviceId, reason],
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
