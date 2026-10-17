import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://savestate-eight.vercel.app').replace(
    /\/+$/,
    '',
  );
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/guardian', '/gatekeeper', '/api/guardian/', '/api/gatekeeper/', '/settings'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
