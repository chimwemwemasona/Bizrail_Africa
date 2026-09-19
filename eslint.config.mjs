import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/next-env.d.ts',
    'coverage/**',
    'storage/**',
    'apps/web/public/sw.js*',
    'apps/web/public/workbox-*',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: nextVitals,
    settings: { next: { rootDir: 'apps/web/' } },
  },
]);
