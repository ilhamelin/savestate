import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
  },
  async redirects() {
    return [
      { source: '/forum', destination: '/tavern', permanent: true },
      { source: '/taberna', destination: '/tavern', permanent: true },
      { source: '/highlights', destination: '/tavern?tab=momentos', permanent: true },
      { source: '/arcade', destination: '/tavern?tab=arcade', permanent: true },
      { source: '/parties', destination: '/tavern?tab=arcade', permanent: true },
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
