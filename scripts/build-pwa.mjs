import { generateSW } from 'workbox-build';
import { readFile, cp, mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const build = (await readFile(web + '.next/BUILD_ID', 'utf8')).trim();
const result = await generateSW({
  globDirectory: web,
  globPatterns: ['.next/static/**/*.{js,css}', 'public/icon-*.png'],
  modifyURLPrefix: { '.next/': '/_next/', 'public/': '/' },
  additionalManifestEntries: [
    { url: '/', revision: build },
    { url: '/manifest.webmanifest', revision: build },
  ],
  swDest: web + 'public/sw.js',
  navigateFallback: '/',
  navigateFallbackDenylist: [/^\/api\//],
  skipWaiting: false,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
});
if (result.warnings.length) throw new Error(result.warnings.join('\n'));
console.log(`Offline shell precached: ${result.count} assets.`);
const standalone = web + '.next/standalone/apps/web/';
await mkdir(standalone + '.next/cache', { recursive: true });
await cp(web + 'public', standalone + 'public', { recursive: true });
await cp(web + '.next/static', standalone + '.next/static', {
  recursive: true,
});
