import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.igdb.com' }] },
  async redirects() {
    return [
      { source: '/parties', destination: '/chat', permanent: true },
      { source: '/community/discord', destination: '/chat', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
