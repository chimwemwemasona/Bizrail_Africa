import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bizrail Africa',
    short_name: 'Bizrail',
    description: 'Offline business capture for your Zambian business.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f9f8',
    theme_color: '#146b60',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
