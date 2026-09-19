import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { Pool } from 'pg';

// This helper owns only this project's native cluster, never the Windows service.
const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const storage = join(root, 'storage');
const directory = join(storage, 'postgres');
const data = join(directory, 'data');
const marker = join(directory, 'managed.json');
const bin = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name) =>
  join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const command = process.argv[2];
const run = (name, args) =>
  execFileSync(executable(name), args, {
    windowsHide: true,
    stdio: 'ignore',
    timeout: 60000,
  });
const running = () => {
  if (!existsSync(join(data, 'PG_VERSION'))) return false;
  try {
    run('pg_ctl', ['-D', data, 'status']);
    return true;
  } catch (error) {
    // pg_ctl uses exit 3 for a stopped server. Spawn/permission failures are unknown status.
    if (error.status === 3) return false;
    throw error;
  }
};

async function main() {
  if (!['start', 'stop', 'status'].includes(command))
    throw new Error('Use start, stop or status.');
  if (!existsSync(executable('pg_ctl')))
    throw new Error(
      'PostgreSQL binaries unavailable; set PG_BIN to their directory.',
    );
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5433' ||
    url.pathname !== '/bizrail' ||
    url.username !== 'bizrail' ||
    !url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Native helper requires DATABASE_URL for bizrail at 127.0.0.1:5433/bizrail with a password.',
    );
  mkdirSync(storage, { recursive: true });
  if (realpathSync(storage) !== storage)
    throw new Error('Refusing redirected storage directory.');
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== directory)
    throw new Error('Refusing redirected PostgreSQL directory.');
  if (existsSync(data) && realpathSync(data) !== data)
    throw new Error('Refusing redirected data directory.');
  const identity = JSON.stringify({ project: root, port: 5433, version: 1 });
  if (existsSync(marker) && readFileSync(marker, 'utf8') !== identity)
    throw new Error('Cluster ownership does not match this workspace.');
  if (existsSync(data) && !existsSync(marker))
    throw new Error('Unmanaged data directory; refusing to use it.');
  if (command === 'status') {
    console.log(
      running()
        ? 'Native Bizrail PostgreSQL is running on port 5433.'
        : 'Native Bizrail PostgreSQL is stopped.',
    );
    return;
  }
  if (command === 'stop') {
    if (running()) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log('Native Bizrail PostgreSQL is stopped; data retained.');
    return;
  }
  if (!existsSync(marker)) writeFileSync(marker, identity, { flag: 'wx' });
  if (!existsSync(join(data, 'PG_VERSION'))) {
    const passwordFile = join(directory, `init-password-${randomUUID()}`);
    writeFileSync(passwordFile, decodeURIComponent(url.password), {
      flag: 'wx',
      mode: 0o600,
    });
    try {
      run('initdb', [
        '-D',
        data,
        '-U',
        'bizrail',
        '-A',
        'scram-sha-256',
        '--pwfile',
        passwordFile,
        '--encoding=UTF8',
        '--no-locale',
      ]);
    } finally {
      unlinkSync(passwordFile);
    }
  }
  if (!running())
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      join(dirname(data), 'postgres.log'),
      '-o',
      '-h 127.0.0.1 -p 5433',
      '-w',
      'start',
    ]);
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5433,
    user: 'bizrail',
    password: decodeURIComponent(url.password),
    database: 'postgres',
    connectionTimeoutMillis: 3000,
  });
  try {
    // Verify the connection is our cluster before creating the dedicated database.
    const location = await pool.query('SHOW data_directory');
    if (realpathSync(location.rows[0].data_directory) !== realpathSync(data))
      throw new Error('Connected PostgreSQL is not this project cluster.');
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname='bizrail'",
    );
    if (!result.rowCount) await pool.query('CREATE DATABASE bizrail');
  } finally {
    await pool.end();
  }
  console.log(
    'Native Bizrail PostgreSQL ready at 127.0.0.1:5433/bizrail. Data: storage/postgres/data.',
  );
}

main().catch(() => {
  console.error(
    'Native PostgreSQL command failed. Check PG_BIN, local DATABASE_URL, port 5433 and storage/postgres/postgres.log. Existing data was preserved.',
  );
  process.exitCode = 1;
});
