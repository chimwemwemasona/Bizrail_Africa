import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
const url = new URL(process.env.DATABASE_URL ?? '');
if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '5433' ||
  url.pathname !== '/bizrail'
)
  throw new Error('Use the dedicated local Bizrail database.');
const runtime = process.env.RUNTIME_DATABASE_URL
  ? new URL(process.env.RUNTIME_DATABASE_URL)
  : new URL(url);
if (!process.env.RUNTIME_DATABASE_URL) {
  runtime.username = 'bizrail_runtime';
  runtime.password = randomBytes(32).toString('hex');
}
if (
  runtime.username !== 'bizrail_runtime' ||
  runtime.hostname !== url.hostname ||
  runtime.port !== url.port ||
  runtime.pathname !== url.pathname ||
  !/^[a-f0-9]{64}$/.test(runtime.password)
)
  throw new Error(
    'Unexpected runtime configuration; refusing to change roles.',
  );
const pool = new Pool({ connectionString: url.toString() });
try {
  await pool.query('BEGIN');
  const role = await pool.query(
    "SELECT 1 FROM pg_roles WHERE rolname='bizrail_runtime'",
  );
  // The role name is constant and the generated password is validated hexadecimal.
  await pool.query(
    `${role.rowCount ? 'ALTER' : 'CREATE'} ROLE bizrail_runtime LOGIN PASSWORD '${runtime.password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  await pool.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await pool.query('GRANT USAGE ON SCHEMA public TO bizrail_runtime');
  // PostgreSQL requires an UPDATE privilege for the per-business row lock.
  await pool.query('GRANT UPDATE(name) ON businesses TO bizrail_runtime');
  await pool.query(
    'GRANT SELECT ON ALL TABLES IN SCHEMA public TO bizrail_runtime',
  );
  await pool.query(
    'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO bizrail_runtime',
  );
  await pool.query(
    'GRANT INSERT ON businesses,accounts,journals,journal_lines,offline_grants,device_audit,document_history,stock_movements,sync_reviews,device_credentials,staff_credentials,delivered_events TO bizrail_runtime',
  );
  await pool.query(
    'GRANT INSERT,UPDATE ON business_actors,devices,sync_counters,sync_events,products,source_documents,login_attempts,outbox TO bizrail_runtime',
  );
  await pool.query(
    'GRANT INSERT,UPDATE,DELETE ON online_sessions TO bizrail_runtime',
  );
  await pool.query('COMMIT');
  const path = new URL('../.env', import.meta.url);
  let text = await readFile(path, 'utf8');
  text = text.replace(/^RUNTIME_DATABASE_URL=.*\r?\n?/m, '');
  text += `\nRUNTIME_DATABASE_URL=${runtime.toString()}\n`;
  await writeFile(path, text);
  console.log(
    'Restricted local runtime role configured. Migration owner remains separate; credentials were not printed.',
  );
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
