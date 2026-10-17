import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://savestate-eight.vercel.app').replace(
    /\/+$/,
    '',
  );
  const now = new Date();
  return [
    '',
    '/explore',
    '/screen',
    '/hoyo',
    '/worlds',
    '/rift',
    '/feed',
    '/forum',
    '/highlights',
    '/library',
    '/lists',
    '/players',
    '/terms',
    '/privacy',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: ['', '/feed', '/hoyo'].includes(route) ? 'hourly' : 'daily',
    priority: route === '' ? 1 : ['/explore', '/hoyo'].includes(route) ? 0.9 : 0.8,
  }));
}
