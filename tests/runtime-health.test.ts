import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  end: vi.fn(),
  connect: vi.fn(),
  ping: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('pg', () => ({
  Pool: class {
    query = mocks.query;
    end = mocks.end;
    on() {}
  },
}));
vi.mock('ioredis', () => ({
  default: class {
    connect = mocks.connect;
    ping = mocks.ping;
    disconnect = mocks.disconnect;
    on() {}
  },
}));
import { RuntimeHealth } from '../apps/api/src/runtime/runtime-health';
import { HealthController } from '../apps/api/src/app.module';

const env = {
  DATABASE_URL: 'postgresql://test:secret@127.0.0.1/test',
  REDIS_URL: 'redis://127.0.0.1',
};
const directory = resolve('apps/api/migrations');
const rows = readdirSync(directory)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => ({
    version: file.slice(0, -4),
    checksum: createHash('sha256')
      .update(readFileSync(resolve(directory, file), 'utf8'))
      .digest('hex'),
  }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue({ rows });
  mocks.ping.mockResolvedValue('PONG');
});

describe('runtime readiness', () => {
  it('allows explicitly disabled Redis only during local development', async () => {
    const runtime = new RuntimeHealth({
      ...env,
      NODE_ENV: 'development',
      REDIS_ENABLED: 'false',
      REDIS_URL: '',
    });
    expect(await runtime.readiness()).toMatchObject({
      status: 'ready',
      checks: { postgres: 'ok', redis: 'disabled' },
    });
    expect(mocks.connect).not.toHaveBeenCalled();
    mocks.query.mockRejectedValueOnce(new Error('database down'));
    expect((await runtime.readiness()).status).toBe('not_ready');
  });

  it.each(['production', undefined])(
    'does not disable Redis outside explicit development mode (%s)',
    async (NODE_ENV) => {
      const runtime = new RuntimeHealth({
        ...env,
        NODE_ENV,
        REDIS_ENABLED: 'false',
        REDIS_URL: '',
      });
      expect(await runtime.readiness()).toMatchObject({
        status: 'not_ready',
        checks: { redis: 'not_configured' },
      });
    },
  );

  it('requires configuration without attempting implicit default connections', async () => {
    const runtime = new RuntimeHealth({});
    expect(await runtime.readiness()).toMatchObject({
      status: 'not_ready',
      checks: { postgres: 'not_configured', redis: 'not_configured' },
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('requires current migrations and a Redis response, and closes connections', async () => {
    const runtime = new RuntimeHealth(env);
    expect(await runtime.readiness()).toMatchObject({ status: 'ready' });
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    await runtime.onApplicationShutdown();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it.each([
    { applied: [] },
    { applied: rows.map((row) => ({ ...row, checksum: 'changed' })) },
    { applied: [...rows, { version: '999_unknown', checksum: 'unknown' }] },
  ])('rejects missing, modified or unknown migrations', async ({ applied }) => {
    mocks.query.mockResolvedValue({ rows: applied });
    expect((await new RuntimeHealth(env).readiness()).checks.postgres).toBe(
      'unavailable',
    );
  });

  it('redacts failures and recovers on the next probe', async () => {
    const runtime = new RuntimeHealth(env);
    mocks.query.mockRejectedValueOnce(new Error('database secret'));
    mocks.connect.mockRejectedValueOnce(new Error('redis secret'));
    const result = await runtime.readiness();
    expect(result).toMatchObject({
      status: 'not_ready',
      checks: { postgres: 'unavailable', redis: 'unavailable' },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect((await runtime.readiness()).status).toBe('ready');
  });

  it('returns HTTP 503 during dependency failure while liveness stays 200', async () => {
    class TestModule {}
    Module({
      controllers: [HealthController],
      providers: [
        { provide: RuntimeHealth, useFactory: () => new RuntimeHealth(env) },
      ],
    })(TestModule);
    const app = await NestFactory.create(TestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.init();
    try {
      await request(app.getHttpServer()).get('/api/health/ready').expect(200);
      mocks.ping.mockRejectedValue(new Error('private connection details'));
      const response = await request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(503);
      expect(response.body.checks.redis).toBe('unavailable');
      expect(response.text).not.toContain('private');
      await request(app.getHttpServer()).get('/api/health/live').expect(200);
    } finally {
      await app.close();
    }
  });
});
