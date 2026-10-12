import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: { cpus: 1 },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BIZRAIL_API_ORIGIN ?? 'http://127.0.0.1:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
