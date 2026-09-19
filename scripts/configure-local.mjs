import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import console from 'node:console';
import { URL } from 'node:url';

const password = randomBytes(32).toString('hex');
const contents = `# Generated for native local PostgreSQL. Never commit this file.
DATABASE_URL=postgresql://bizrail:${password}@127.0.0.1:5433/bizrail
NODE_ENV=development
REDIS_ENABLED=false
REDIS_URL=
DOCUMENT_STORAGE_PATH=./storage/private
TZ=UTC
`;

try {
  await writeFile(new URL('../.env', import.meta.url), contents, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    'Created local .env with a generated database password. Next: npm run db:start, then npm run db:migrate.',
  );
} catch (error) {
  if (error.code === 'EEXIST') {
    console.log(
      'Existing .env preserved. See docs/local-runtime.md for native PostgreSQL configuration.',
    );
  } else {
    throw error;
  }
}
