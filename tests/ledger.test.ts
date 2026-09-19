import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prepareJournal, toMinorUnits } from '../apps/api/src/ledger/journal';

export function exampleJournal() {
  return {
    operationId: randomUUID(),
    sourceId: randomUUID(),
    occurredAt: '2026-09-13T14:00:00+02:00',
    description: 'Synthetic cash sale',
    currency: 'ZMW' as const,
    lines: [
      { accountId: randomUUID(), side: 'debit' as const, amount: '40.00' },
      { accountId: randomUUID(), side: 'credit' as const, amount: '40.00' },
    ],
  };
}

describe('journal boundary', () => {
  it('uses exact minor units, normalises UTC and accepts balanced entries', () => {
    expect(toMinorUnits('10.10') * 3n + toMinorUnits('9.70')).toBe(4000n);
    const input = exampleJournal();
    const result = prepareJournal(input);
    expect(result.occurredAt).toBe('2026-09-13T12:00:00.000Z');
    expect(result.lines.map((line) => line.amountMinor).sort()).toEqual([
      '-4000',
      '4000',
    ]);
    expect(
      prepareJournal({ ...input, lines: [...input.lines].reverse() }).hash,
    ).toBe(result.hash);
  });

  it.each(['0.001', '-1', '1e3', 'NaN', 'Infinity', '01.00', '10000000000000'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => toMinorUnits(amount)).toThrow();
    },
  );

  it('rejects unbalanced, zero, unsupported currency and tenant injection', () => {
    const input = exampleJournal();
    expect(() =>
      prepareJournal({
        ...input,
        lines: input.lines.map((line, i) => ({
          ...line,
          amount: i ? '39' : '40',
        })),
      }),
    ).toThrow('balance');
    expect(() =>
      prepareJournal({
        ...input,
        lines: input.lines.map((line) => ({ ...line, amount: '0' })),
      }),
    ).toThrow('nonzero');
    expect(() => prepareJournal({ ...input, currency: 'USD' })).toThrow();
    expect(() =>
      prepareJournal({ ...input, tenantId: randomUUID() }),
    ).toThrow();
  });
});
