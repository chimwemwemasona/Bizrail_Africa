import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { EventQueue } from '../apps/web/lib/offline/event-queue';

const databases: EventQueue[] = [];
const now = new Date('2026-09-13T12:00:00Z');
const expiry = '2026-09-14T12:00:00Z';
function queue() {
  const scope = {
    tenantId: randomUUID(),
    actorId: randomUUID(),
    deviceId: randomUUID(),
  };
  const db = new EventQueue(scope);
  databases.push(db);
  return { db, scope };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

describe('durable offline queue', () => {
  it('blocks logout with unresolved records and blocks racing capture once logout starts', async () => {
    const { db } = queue();
    await db.recordOnlineGrant(expiry, now, randomUUID());
    const event = await db.capture(
      { kind: 'expense', payload: { amount: '1' } },
      now,
    );
    expect(await db.prepareLogout()).toBe(false);
    await db.recordResult(event.id, 'accepted');
    expect(await db.prepareLogout()).toBe(true);
    await expect(
      db.capture({ kind: 'expense', payload: { amount: '1' } }, now),
    ).rejects.toThrow('renewal');
  });
  it('retains ten sales and two expenses after close/reopen with unique sequences', async () => {
    const { db } = queue();
    await db.recordOnlineGrant(expiry, now);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        db.capture(
          {
            kind: i < 10 ? 'sale' : 'expense',
            payload: { amount: '10.10' },
          },
          now,
        ),
      ),
    );
    db.close();
    await db.open();
    const events = await db.pending();
    expect(events).toHaveLength(12);
    expect(events.map((event) => event.sequence)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    expect(new Set(events.map((event) => event.id)).size).toBe(12);
    expect(
      events.every(
        (event) =>
          event.schemaVersion === 1 && event.payload.amount === '10.10',
      ),
    ).toBe(true);
  });

  it('blocks missing/expired grants and preserves work through revocation and renewal', async () => {
    const { db } = queue();
    const input = { kind: 'sale' as const, payload: {} };
    await expect(db.capture(input, now)).rejects.toThrow('enrolment');
    await db.recordOnlineGrant(expiry, now);
    const pending = await db.capture(input, now);
    const accepted = await db.capture(input, now);
    await db.recordResult(accepted.id, 'accepted');
    await expect(db.capture(input, new Date(expiry))).rejects.toThrow(
      'renewal',
    );
    await db.quarantine('Device revoked');
    await expect(db.capture(input, now)).rejects.toThrow('renewal');
    await db.recordOnlineGrant(expiry, now);
    expect((await db.events.get(pending.id))?.state).toBe('quarantined');
    expect((await db.events.get(accepted.id))?.state).toBe('accepted');
    await expect(db.recordResult(pending.id, 'accepted')).rejects.toThrow(
      'review',
    );
    expect((await db.capture(input, now)).sequence).toBe(3);
  });

  it('isolates businesses and preserves conflicts without losing unrelated work', async () => {
    const { db } = queue();
    const { db: other } = queue();
    await db.recordOnlineGrant(expiry, now);
    const a = await db.capture({ kind: 'purchase', payload: {} }, now);
    await db.capture({ kind: 'quotation', payload: {} }, now);
    await db.recordResult(a.id, 'conflict', 'Document version changed');
    expect(await db.pending()).toHaveLength(1);
    expect((await db.events.get(a.id))?.reason).toBe(
      'Document version changed',
    );
    expect(await other.events.count()).toBe(0);
    await expect(other.recordResult(a.id, 'accepted')).rejects.toThrow(
      'Unknown',
    );
    await expect(
      db.capture({ kind: 'journal' as 'sale', payload: {} }, now),
    ).rejects.toThrow();
    await expect(
      db.recordOnlineGrant('2026-09-15T12:00:00Z', now),
    ).rejects.toThrow('24 hours');
  });
});
