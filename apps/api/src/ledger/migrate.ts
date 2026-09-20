import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

export async function migrate(pool: Pool) {
  const directory = resolve(__dirname, '../../migrations');
  const files = (await readdir(directory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('bizrail-schema-migrations'))",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ version: string; checksum: string }>(
      'SELECT version,checksum FROM schema_migrations',
    );
    if (applied.rows.some((row) => !files.includes(`${row.version}.sql`))) {
      throw new Error('An applied migration is missing from this build');
    }
    for (const file of files) {
      const version = file.slice(0, -4);
      const sql = await readFile(resolve(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = applied.rows.find((row) => row.version === version);
      if (prior && prior.checksum !== checksum)
        throw new Error(
          'Applied migration checksum changed; add a new migration instead',
        );
      if (!prior) {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations(version,checksum) VALUES ($1,$2)',
          [version, checksum],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  if (!process.env.DATABASE_URL)
    throw new Error(
      'DATABASE_URL is required; use a dedicated Bizrail database',
    );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  migrate(pool)
    .then(() => console.log('Ledger migration applied or already current'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
