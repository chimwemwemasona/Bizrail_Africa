import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { prepareJournal } from './journal.js';

/** Internal posting boundary. Tenant authority must come from trusted server context.
 * This is deliberately not exposed as an unauthenticated HTTP/manual-journal API.
 */
export class LedgerRepository {
  constructor(private readonly pool: Pool) {}

  async post(tenantId: string, input: unknown) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.postInTransaction(client, tenantId, input);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** Caller owns BEGIN/COMMIT/ROLLBACK, allowing domain and sync effects to commit together. */
  async postInTransaction(
    client: PoolClient,
    tenantId: string,
    input: unknown,
  ) {
    z.uuid().parse(tenantId);
    const journal = prepareJournal(input);
    const id = randomUUID();
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO journals (tenant_id, id, operation_id, source_id, occurred_at, description, payload_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant_id, operation_id) DO NOTHING RETURNING id`,
      [
        tenantId,
        id,
        journal.operationId,
        journal.sourceId,
        journal.occurredAt,
        journal.description,
        journal.hash,
      ],
    );
    if (inserted.rowCount === 0) {
      const prior = await client.query<{ id: string; payload_hash: string }>(
        'SELECT id, payload_hash FROM journals WHERE tenant_id=$1 AND operation_id=$2',
        [tenantId, journal.operationId],
      );
      const existing = prior.rows[0];
      if (!existing || existing.payload_hash !== journal.hash) {
        throw new Error('Operation ID was already used with different content');
      }
      return { journalId: existing.id, replayed: true };
    }
    for (const [index, entry] of journal.lines.entries()) {
      await client.query(
        `INSERT INTO journal_lines (tenant_id,journal_id,line_no,account_id,amount_minor)
           VALUES ($1,$2,$3,$4,$5)`,
        [tenantId, id, index + 1, entry.accountId, entry.amountMinor],
      );
    }
    // The database trigger writes the outbox entry in this same transaction.
    return { journalId: id, replayed: false };
  }
}
