import Dexie, { type Table } from 'dexie';
import { z } from 'zod';

const scopeSchema = z
  .object({ tenantId: z.uuid(), actorId: z.uuid(), deviceId: z.uuid() })
  .strict();
const captureSchema = z
  .object({
    kind: z.enum(['sale', 'quotation', 'cash_receipt', 'purchase', 'expense']),
    payload: z.record(z.string(), z.json()),
    dependsOn: z.array(z.uuid()).max(100).default([]),
  })
  .strict();
export type DeviceScope = z.infer<typeof scopeSchema>;
type CaptureInput = z.input<typeof captureSchema>;
type State = 'pending' | 'accepted' | 'rejected' | 'conflict' | 'quarantined';
export interface DeviceEvent extends DeviceScope {
  id: string;
  schemaVersion: 1;
  sequence: number;
  capturedAt: string;
  kind: CaptureInput['kind'];
  payload: z.infer<typeof captureSchema>['payload'];
  dependsOn: string[];
  state: State;
  reason?: string;
  grantId?: string;
}
interface DeviceMetadata {
  id: 'device';
  nextSequence: number;
  expiresAt: string;
  revoked: boolean;
  grantId?: string;
}

/** Durable transport queue only. Server enrolment/authentication and business
 * validation are separate; a client-side lease is never server authority.
 */
export class EventQueue extends Dexie {
  readonly events!: Table<DeviceEvent, string>;
  private readonly metadata!: Table<DeviceMetadata, string>;
  readonly cache!: Table<{ id: string; value: unknown }, string>;
  private readonly scope: DeviceScope;

  constructor(scope: DeviceScope) {
    const parsed = scopeSchema.parse(scope);
    super(`bizrail-v1-${parsed.tenantId}-${parsed.actorId}-${parsed.deviceId}`);
    this.scope = parsed;
    this.version(1).stores({ events: 'id,&sequence,state', metadata: 'id' });
    this.version(2).stores({
      events: 'id,&sequence,state',
      metadata: 'id',
      cache: 'id',
    });
  }

  /** Call only after successful online enrolment/renewal. Never clears queued work. */
  async recordOnlineGrant(
    expiresAt: string,
    now = new Date(),
    grantId?: string,
  ) {
    if (grantId) z.uuid().parse(grantId);
    z.iso.datetime({ offset: true }).parse(expiresAt);
    const remaining = new Date(expiresAt).getTime() - now.getTime();
    if (remaining <= 0 || remaining > 24 * 60 * 60 * 1000)
      throw new Error('Offline grant must expire within 24 hours');
    await this.transaction('rw', this.metadata, async () => {
      const prior = await this.metadata.get('device');
      await this.metadata.put({
        id: 'device',
        nextSequence: prior?.nextSequence ?? 1,
        expiresAt,
        revoked: false,
        grantId,
      });
    });
  }

  async capture(input: CaptureInput, now = new Date()) {
    const parsed = captureSchema.parse(input);
    return this.transaction('rw', this.events, this.metadata, async () => {
      const device = await this.metadata.get('device');
      if (
        !device ||
        device.revoked ||
        Date.parse(device.expiresAt) <= now.getTime()
      ) {
        throw new Error(
          'Online enrolment or renewal is required before capture',
        );
      }
      const event: DeviceEvent = {
        ...this.scope,
        ...parsed,
        id: crypto.randomUUID(),
        schemaVersion: 1,
        capturedAt: now.toISOString(),
        sequence: device.nextSequence,
        state: 'pending',
        grantId: device.grantId,
      };
      await this.events.add(event);
      await this.metadata.update('device', {
        nextSequence: device.nextSequence + 1,
      });
      return event;
    });
  }

  async pending() {
    return this.events.where('state').equals('pending').sortBy('sequence');
  }

  /** Atomically block capture before logout, including writes from another open tab. */
  async prepareLogout() {
    return this.transaction('rw', this.events, this.metadata, async () => {
      if (
        await this.events.filter((event) => event.state !== 'accepted').count()
      )
        return false;
      await this.metadata.update('device', { revoked: true });
      return true;
    });
  }

  /** Apply authenticated sync responses; retain failures for inspection/review. */
  async recordResult(
    id: string,
    state: Exclude<State, 'pending'>,
    reason?: string,
  ) {
    z.uuid().parse(id);
    z.enum(['accepted', 'rejected', 'conflict', 'quarantined']).parse(state);
    await this.transaction('rw', this.events, async () => {
      const event = await this.events.get(id);
      if (!event) throw new Error('Unknown device event');
      if (event.state === 'accepted') return;
      if (event.state === 'quarantined' && state !== 'quarantined') {
        throw new Error(
          'Quarantined work requires an authorised review workflow',
        );
      }
      await this.events.update(id, { state, reason });
    });
  }

  async quarantine(reason: string) {
    if (!reason.trim()) throw new Error('A quarantine reason is required');
    await this.transaction('rw', this.events, this.metadata, async () => {
      await this.metadata.update('device', { revoked: true });
      await this.events
        .filter((event) => event.state !== 'accepted')
        .modify({ state: 'quarantined', reason });
    });
  }
}
