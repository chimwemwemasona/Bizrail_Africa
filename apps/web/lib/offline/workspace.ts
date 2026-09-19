import { EventQueue, type DeviceEvent, type DeviceScope } from './event-queue';
export type Kind = DeviceEvent['kind'];
export interface Profile {
  context: DeviceScope;
  deviceToken: string;
  grant: { grantId: string; expiresAt: string; issuedAt: string };
  identity: {
    tenantId: string;
    actorId: string;
    username: string;
    name: string;
    canManage: boolean;
  };
}
export interface Product {
  id: string;
  name: string;
  price_minor: string;
  quantity: number;
  value_minor: string;
  version: number;
}
export interface Account {
  id: string;
  code: string;
  name: string;
  kind: string;
  balance: string;
}
export interface Document {
  id: string;
  kind: Kind;
  version: number;
  payload: Record<string, unknown>;
  total_minor: string;
  journal_id: string | null;
  occurred_at: string;
}
export interface Journal {
  id: string;
  source_id: string;
  description: string;
  occurred_at: string;
  lines: { code: string; name: string; amount: string }[];
}
export interface Outcome {
  id: string;
  state:
    'accepted' | 'waiting' | 'retry' | 'rejected' | 'conflict' | 'quarantined';
  reason: string | null;
}
export interface Snapshot {
  products: Product[];
  accounts: Account[];
  documents: Document[];
  journals: Journal[];
  outcomes: Outcome[];
  cursor: string;
  at: string;
}
export const emptySnapshot: Snapshot = {
  products: [],
  accounts: [],
  documents: [],
  journals: [],
  outcomes: [],
  cursor: '0',
  at: '',
};
export async function api<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`/api/workspace/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bizrail-request': '1',
      ...(token ? { 'x-device-token': token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'Connection failed');
  return result;
}
export function activate(profile: Profile) {
  localStorage.setItem('bizrail.active', JSON.stringify(profile.context));
  localStorage.setItem(
    `bizrail.device.${profile.identity.tenantId}.${profile.identity.actorId}`,
    JSON.stringify(profile.context),
  );
}
export async function retainedProfile(identity: Profile['identity']) {
  const raw = localStorage.getItem(
    `bizrail.device.${identity.tenantId}.${identity.actorId}`,
  );
  if (!raw) return null;
  const stored = new EventQueue(JSON.parse(raw));
  try {
    return ((await stored.cache.get('profile'))?.value as Profile) ?? null;
  } finally {
    stored.close();
  }
}
export async function restore() {
  const raw = localStorage.getItem('bizrail.active');
  if (!raw) return null;
  const db = new EventQueue(JSON.parse(raw));
  const saved = await db.cache.get('profile');
  if (!saved) {
    db.close();
    return null;
  }
  return { db, profile: saved.value as Profile };
}
export async function saveProfile(db: EventQueue, profile: Profile) {
  await db.recordOnlineGrant(
    profile.grant.expiresAt,
    new Date(),
    profile.grant.grantId,
  );
  await db.cache.put({ id: 'profile', value: profile });
  activate(profile);
}
export async function snapshot(db: EventQueue) {
  return ((await db.cache.get('snapshot'))?.value as Snapshot) ?? emptySnapshot;
}
export async function synchronize(db: EventQueue, profile: Profile) {
  // Web Locks serializes tabs. Retries are safe even on browsers without this optimisation.
  const work = async () => {
    let unresolved = await db.pending();
    for (
      let pass = 0;
      pass < Math.min(unresolved.length + 1, 101) && unresolved.length;
      pass++
    ) {
      let progressed = false;
      for (let start = 0; start < unresolved.length; start += 100) {
        const batch = unresolved.slice(start, start + 100);
        const ready: DeviceEvent[] = [];
        for (const event of batch) {
          if (!event.grantId)
            await db.recordResult(
              event.id,
              'quarantined',
              'Legacy event has no server grant. Preserve for review.',
            );
          else ready.push(event);
        }
        if (!ready.length) continue;
        const outcomes = await api<Outcome[]>(
          'push',
          {
            events: ready.map(
              ({
                id,
                schemaVersion,
                sequence,
                grantId,
                capturedAt,
                kind,
                payload,
                dependsOn,
              }) => ({
                id,
                schemaVersion,
                sequence,
                grantId,
                capturedAt,
                kind,
                payload,
                dependsOn,
              }),
            ),
          },
          profile.deviceToken,
        );
        for (const result of outcomes) {
          if (result.state === 'accepted') {
            progressed = true;
            continue;
          }
          if (result.state === 'waiting' || result.state === 'retry') {
            await db.events.update(result.id, {
              reason: result.reason ?? undefined,
            });
            continue;
          }
          await db.recordResult(
            result.id,
            result.state,
            result.reason ?? undefined,
          );
        }
      }
      // Do not mark accepted locally until the corresponding authoritative snapshot is durable.
      const current = await api<Snapshot>(
        'snapshot',
        undefined,
        profile.deviceToken,
      );
      await db.transaction('rw', db.cache, db.events, async () => {
        for (const result of current.outcomes) {
          const local = await db.events.get(result.id);
          if (!local) continue;
          if (result.state !== 'retry' && result.state !== 'waiting')
            await db.events.update(result.id, {
              state: result.state,
              reason: result.reason ?? undefined,
            });
        }
        await db.cache.put({ id: 'snapshot', value: current });
      });
      unresolved = await db.pending();
      if (!progressed) break;
    }
    // Pull is resumable. Commit its cursor together with a consistent snapshot, never ahead of state.
    const old = await snapshot(db);
    let after = old.cursor;
    for (let page = 0; page < 100; page++) {
      const next = await api<{ cursor: string; hasMore: boolean }>(
        `pull?after=${after}`,
        undefined,
        profile.deviceToken,
      );
      after = next.cursor;
      if (!next.hasMore) break;
    }
    const current = await api<Snapshot>(
      'snapshot',
      undefined,
      profile.deviceToken,
    );
    await db.transaction('rw', db.cache, db.events, async () => {
      for (const result of current.outcomes) {
        if (
          result.state !== 'waiting' &&
          result.state !== 'retry' &&
          (await db.events.get(result.id))
        )
          await db.events.update(result.id, {
            state: result.state,
            reason: result.reason ?? undefined,
          });
      }
      await db.cache.put({ id: 'snapshot', value: current });
    });
    return current;
  };
  return navigator.locks
    ? navigator.locks.request(`sync-${db.name}`, work)
    : work();
}
export function minor(value: string) {
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a valid amount with at most two decimals');
  const [a, b = ''] = value.split('.');
  return BigInt(a!) * 100n + BigInt(b.padEnd(2, '0'));
}
export function money(value: string | bigint) {
  const n = BigInt(value),
    abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}K ${(abs / 100n).toLocaleString('en-ZM')}.${(abs % 100n).toString().padStart(2, '0')}`;
}
export function date(value: string) {
  return value
    ? new Intl.DateTimeFormat('en-ZM', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Lusaka',
      }).format(new Date(value))
    : 'Never';
}
export function project(base: Snapshot, events: DeviceEvent[]) {
  const products = base.products.map((p) => ({ ...p }));
  const balances: Record<string, bigint> = Object.fromEntries(
    base.accounts.map((a) => [a.code, BigInt(a.balance)]),
  );
  let sales = 0n,
    expenses = 0n;
  const add = (code: string, value: bigint) => {
    balances[code] = (balances[code] ?? 0n) + value;
  };
  for (const doc of base.documents) {
    if (doc.kind === 'sale') sales += BigInt(doc.total_minor);
    if (doc.kind === 'expense') expenses += BigInt(doc.total_minor);
  }
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    if (event.state !== 'pending' || !event.grantId) continue;
    const p = event.payload,
      quantity = Number(p.quantity ?? 0),
      product = products.find((x) => x.id === p.productId);
    const total = ['sale', 'purchase', 'quotation'].includes(event.kind)
      ? minor(String(p.unitPrice)) * BigInt(quantity)
      : minor(String(p.amount));
    const settlement = p.settlement === 'credit' ? 'credit' : 'cash';
    if (event.kind === 'sale') {
      sales += total;
      add(settlement === 'cash' ? '1000' : '1100', total);
      add('4000', -total);
      if (product && product.quantity > 0) {
        const cost =
          (BigInt(product.value_minor) * BigInt(quantity) +
            BigInt(product.quantity) / 2n) /
          BigInt(product.quantity);
        product.quantity -= quantity;
        product.value_minor = (BigInt(product.value_minor) - cost).toString();
        add('1200', -cost);
        add('5000', cost);
      }
    }
    if (event.kind === 'purchase') {
      add('1200', total);
      add(settlement === 'cash' ? '1000' : '2000', -total);
      if (product) {
        product.quantity += quantity;
        product.value_minor = (BigInt(product.value_minor) + total).toString();
      }
    }
    if (event.kind === 'expense') {
      expenses += total;
      add('6000', total);
      add(settlement === 'cash' ? '1000' : '2000', -total);
    }
    if (event.kind === 'cash_receipt') {
      add('1000', total);
      add('1100', -total);
    }
  }
  return { products, balances, sales, expenses };
}
