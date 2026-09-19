import type { OnApplicationShutdown } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import Redis from 'ioredis';

type Check = 'ok' | 'unavailable' | 'not_configured' | 'disabled';

/** Read-only probes. Starting the API never creates or migrates a database. */
export class RuntimeHealth implements OnApplicationShutdown {
  private readonly pool?: Pool;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    if (env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: env.RUNTIME_DATABASE_URL ?? env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 1500,
        query_timeout: 1500,
        statement_timeout: 1500,
        idleTimeoutMillis: 5000,
      });
      // An idle connection failure must affect readiness, not crash the process.
      this.pool.on('error', () => {});
    }
  }

  private async database(): Promise<Check> {
    if (!this.pool) return 'not_configured';
    try {
      const directory = resolve(__dirname, '../../migrations');
      const files = (await readdir(directory))
        .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
        .sort();
      const applied = await this.pool.query<{
        version: string;
        checksum: string;
      }>('SELECT version, checksum FROM schema_migrations');
      if (files.length === 0 || applied.rows.length !== files.length)
        return 'unavailable';
      for (const file of files) {
        const sql = await readFile(resolve(directory, file), 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex');
        if (
          !applied.rows.some(
            (row) =>
              row.version === file.slice(0, -4) && row.checksum === checksum,
          )
        )
          return 'unavailable';
      }
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  private async redis(): Promise<Check> {
    if (
      this.env.NODE_ENV === 'development' &&
      this.env.REDIS_ENABLED === 'false'
    )
      return 'disabled';
    if (!this.env.REDIS_URL) return 'not_configured';
    let client: Redis | undefined;
    try {
      client = new Redis(this.env.REDIS_URL, {
        lazyConnect: true,
        connectTimeout: 1500,
        commandTimeout: 1500,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        reconnectOnError: () => false,
      });
      client.on('error', () => {});
      await client.connect();
      return (await client.ping()) === 'PONG' ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      client?.disconnect();
    }
  }

  async readiness() {
    const [postgres, redis] = await Promise.all([
      this.database(),
      this.redis(),
    ]);
    return {
      status:
        postgres === 'ok' && (redis === 'ok' || redis === 'disabled')
          ? 'ready'
          : 'not_ready',
      service: 'bizrail-api',
      checks: { postgres, redis },
    };
  }

  async onApplicationShutdown() {
    await this.pool?.end();
  }
}
