import 'reflect-metadata';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { Decimal } from 'decimal.js';
import { hash, verify } from 'argon2';
import Dexie from 'dexie';
import request from 'supertest';
import { AppModule } from '../apps/api/src/app.module';

describe('installed dependency smoke checks', () => {
  it('boots NestJS and responds to the liveness endpoint', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    try {
      await app.init();
      await request(app.getHttpServer())
        .get('/api/health/live')
        .expect(200)
        .expect({ status: 'ok', service: 'bizrail-api' });
    } finally {
      await app.close();
    }
  });

  it('supports exact decimal arithmetic for the planned ledger', () => {
    expect(new Decimal('10.10').times(3).plus('9.70').toFixed(2)).toBe('40.00');
  });

  it('loads the native password hashing binary', async () => {
    const encoded = await hash('synthetic-tooling-check');
    expect(await verify(encoded, 'synthetic-tooling-check')).toBe(true);
    expect(await verify(encoded, 'incorrect')).toBe(false);
  });

  it('supports reopening IndexedDB with Dexie', async () => {
    const db = new Dexie('bizrail-tooling-smoke');
    db.version(1).stores({ events: 'id' });
    try {
      await db.table('events').put({ id: 'synthetic-event', sequence: 1 });
      db.close();
      await db.open();
      expect(await db.table('events').get('synthetic-event')).toEqual({
        id: 'synthetic-event',
        sequence: 1,
      });
    } finally {
      await db.delete();
    }
  });
});
