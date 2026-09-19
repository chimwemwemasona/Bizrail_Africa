import { createHash } from 'node:crypto';
import { z } from 'zod';

const money = z.string().regex(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/);
const line = z
  .object({
    accountId: z.uuid(),
    side: z.enum(['debit', 'credit']),
    amount: money,
  })
  .strict();

export const journalInput = z
  .object({
    operationId: z.uuid(),
    sourceId: z.uuid(),
    occurredAt: z.iso.datetime({ offset: true }),
    description: z.string().trim().min(1).max(500),
    currency: z.literal('ZMW'),
    lines: z.array(line).min(2).max(100),
  })
  .strict();

export type JournalInput = z.infer<typeof journalInput>;

/** No floating point arithmetic or implicit rounding at the ledger boundary. */
export function toMinorUnits(amount: string): bigint {
  money.parse(amount);
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function prepareJournal(input: unknown) {
  const parsed = journalInput.parse(input);
  const lines = parsed.lines
    .map((entry) => {
      const amount = toMinorUnits(entry.amount);
      if (amount === 0n) throw new Error('Journal lines must be nonzero');
      return {
        accountId: entry.accountId.toLowerCase(),
        amountMinor: (entry.side === 'debit' ? amount : -amount).toString(),
      };
    })
    .sort(
      (a, b) =>
        a.accountId.localeCompare(b.accountId) ||
        a.amountMinor.localeCompare(b.amountMinor),
    );
  if (
    lines.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n) !== 0n
  ) {
    throw new Error('Journal must balance');
  }
  const journal = {
    operationId: parsed.operationId.toLowerCase(),
    sourceId: parsed.sourceId.toLowerCase(),
    occurredAt: new Date(parsed.occurredAt).toISOString(),
    description: parsed.description,
    currency: parsed.currency,
    lines,
  };
  return {
    ...journal,
    hash: createHash('sha256').update(JSON.stringify(journal)).digest('hex'),
  };
}
