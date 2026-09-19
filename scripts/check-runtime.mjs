import { createRequire } from 'node:module';
import console from 'node:console';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { RuntimeHealth } = require('../apps/api/dist/runtime/runtime-health.js');
const runtime = new RuntimeHealth();
try {
  const result = await runtime.readiness();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ready') process.exitCode = 1;
} finally {
  await runtime.onApplicationShutdown();
}
