import { z } from 'zod';
import type { Pool, PoolClient } from 'pg';
import { LedgerRepository } from '../ledger/ledger.repository';
import { DomainFailure, type SyncHandler } from '../sync/sync.service';

export const transactionSchema = z
  .object({
    documentId: z.uuid(),
    expectedVersion: z.number().int().nonnegative().default(0),
    productId: z.uuid().optional(),
    quantity: z.number().int().min(1).max(100000).optional(),
    unitPrice: z
      .string()
      .regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/)
      .optional(),
    amount: z
      .string()
      .regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/)
      .optional(),
    settlement: z.enum(['cash', 'credit']).default('cash'),
    description: z.string().trim().min(1).max(200),
    party: z.string().trim().max(100).default('Walk-in'),
  })
  .strict();
function minor(value: string) {
  const [a, b = ''] = value.split('.');
  return BigInt(a!) * 100n + BigInt(b.padEnd(2, '0'));
}
function money(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

export function postingHandler(pool: Pool): SyncHandler {
  const ledger = new LedgerRepository(pool);
  return async (client, context, event) => {
    const parsed = transactionSchema.safeParse(event.payload);
    if (!parsed.success)
      throw new DomainFailure('rejected', 'invalid_transaction');
    const payload = parsed.data;
    const reviewedSource = await client.query<{ captured_at: string }>(
      `SELECT e.envelope->>'capturedAt' AS captured_at FROM sync_reviews r JOIN sync_events e ON e.tenant_id=r.tenant_id AND e.id=r.event_id WHERE r.tenant_id=$1 AND r.envelope->>'id'=$2 AND r.decision='release'`,
      [context.tenantId, event.id],
    );
    const occurredAt = reviewedSource.rows[0]?.captured_at ?? event.capturedAt;
    const previous = await client.query<{ kind: string; version: number }>(
      'SELECT kind,version FROM source_documents WHERE tenant_id=$1 AND id=$2',
      [context.tenantId, payload.documentId],
    );
    const prior = previous.rows[0];
    if ((prior?.version ?? 0) !== payload.expectedVersion)
      throw new DomainFailure('conflict', 'version_conflict');
    if (prior && (prior.kind !== 'quotation' || event.kind !== 'quotation'))
      throw new DomainFailure('conflict', 'source_already_posted');
    let total = payload.amount ? minor(payload.amount) : 0n;
    let stockDelta = 0;
    let stockValueDelta = 0n;
    let productId: string | null = null;
    if (['sale', 'purchase', 'quotation'].includes(event.kind)) {
      if (!payload.productId || !payload.quantity || !payload.unitPrice)
        throw new DomainFailure('rejected', 'invalid_transaction');
      const product = await client.query<{
        quantity: number;
        value_minor: string;
      }>(
        'SELECT quantity,value_minor FROM products WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [context.tenantId, payload.productId],
      );
      const row = product.rows[0];
      if (!row) throw new DomainFailure('rejected', 'invalid_transaction');
      total = minor(payload.unitPrice) * BigInt(payload.quantity);
      productId = payload.productId;
      if (event.kind === 'sale') {
        if (row.quantity < payload.quantity)
          throw new DomainFailure('conflict', 'insufficient_stock');
        stockDelta = -payload.quantity;
        stockValueDelta = -(
          (BigInt(row.value_minor) * BigInt(payload.quantity) +
            BigInt(row.quantity) / 2n) /
          BigInt(row.quantity)
        );
      } else if (event.kind === 'purchase') {
        stockDelta = payload.quantity;
        stockValueDelta = total;
      }
    }
    if (total <= 0n || total > 999999999999n)
      throw new DomainFailure('rejected', 'invalid_transaction');
    const lines: { code: string; value: bigint }[] = [];
    if (event.kind === 'sale')
      lines.push(
        { code: payload.settlement === 'cash' ? '1000' : '1100', value: total },
        { code: '4000', value: -total },
      );
    if (event.kind === 'sale' && stockValueDelta !== 0n)
      lines.push(
        { code: '5000', value: -stockValueDelta },
        { code: '1200', value: stockValueDelta },
      );
    if (event.kind === 'purchase')
      lines.push(
        { code: '1200', value: total },
        {
          code: payload.settlement === 'cash' ? '1000' : '2000',
          value: -total,
        },
      );
    if (event.kind === 'expense')
      lines.push(
        { code: '6000', value: total },
        {
          code: payload.settlement === 'cash' ? '1000' : '2000',
          value: -total,
        },
      );
    if (event.kind === 'cash_receipt')
      lines.push(
        { code: '1000', value: total },
        { code: '1100', value: -total },
      );
    const accounts = await client.query<{ id: string; code: string }>(
      'SELECT id,code FROM accounts WHERE tenant_id=$1',
      [context.tenantId],
    );
    let journalId: string | null = null;
    if (lines.length) {
      const journal = await ledger.postInTransaction(client, context.tenantId, {
        operationId: event.id,
        sourceId: payload.documentId,
        occurredAt,
        description: payload.description,
        currency: 'ZMW',
        lines: lines.map((line) => ({
          accountId: accounts.rows.find((a) => a.code === line.code)?.id,
          side: line.value > 0n ? 'debit' : 'credit',
          amount: money(line.value < 0n ? -line.value : line.value),
        })),
      });
      journalId = journal.journalId;
    }
    if (stockDelta && productId) {
      await client.query(
        'UPDATE products SET quantity=quantity+$3,value_minor=value_minor+$4,version=version+1 WHERE tenant_id=$1 AND id=$2',
        [context.tenantId, productId, stockDelta, stockValueDelta.toString()],
      );
      await client.query('INSERT INTO stock_movements VALUES($1,$2,$3,$4,$5)', [
        context.tenantId,
        event.id,
        productId,
        stockDelta,
        stockValueDelta.toString(),
      ]);
    }
    await client.query(
      `INSERT INTO source_documents(tenant_id,id,kind,version,payload,total_minor,journal_id,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(tenant_id,id) DO UPDATE SET version=excluded.version,payload=excluded.payload,total_minor=excluded.total_minor,occurred_at=excluded.occurred_at`,
      [
        context.tenantId,
        payload.documentId,
        event.kind,
        payload.expectedVersion + 1,
        payload,
        total.toString(),
        journalId,
        occurredAt,
      ],
    );
    await client.query('INSERT INTO document_history VALUES($1,$2,$3,$4,$5)', [
      context.tenantId,
      payload.documentId,
      payload.expectedVersion + 1,
      event.id,
      payload,
    ]);
    return {
      documentId: payload.documentId,
      version: payload.expectedVersion + 1,
      totalMinor: total.toString(),
      journalId,
      productId,
      stockDelta,
      stockValueDelta: stockValueDelta.toString(),
      lines: lines.map((line) => ({
        code: line.code,
        value: line.value.toString(),
      })),
    };
  };
}

export async function deliverOutbox(client: PoolClient) {
  const pending = await client.query<{
    id: string;
    tenant_id: string;
    journal_id: string;
  }>(
    'SELECT id,tenant_id,journal_id FROM outbox WHERE delivered_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100',
  );
  for (const row of pending.rows) {
    await client.query(
      'INSERT INTO delivered_events(outbox_id,tenant_id,journal_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [row.id, row.tenant_id, row.journal_id],
    );
    await client.query(
      'UPDATE outbox SET delivered_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1',
      [row.id],
    );
  }
  return pending.rowCount;
}
