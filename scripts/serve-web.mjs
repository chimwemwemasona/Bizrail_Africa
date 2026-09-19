import { createRequire } from 'node:module';
import process from 'node:process';
process.env.HOSTNAME = '127.0.0.1';
process.env.PORT ??= '3000';
createRequire(import.meta.url)(
  '../apps/web/.next/standalone/apps/web/server.js',
);
