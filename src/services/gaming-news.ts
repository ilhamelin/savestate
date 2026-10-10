import 'server-only';
import { parseGamingRss, combineGamingNews, type GamingNewsSource } from '@/domain/gaming-news';
export type { GamingNewsItem } from '@/domain/gaming-news';

const feeds: { source: GamingNewsSource; url: string }[] = [
  { source: 'vandal', url: 'https://vandal.elespanol.com/xml.cgi' },
  { source: 'ign', url: 'https://es.ign.com/feed.xml' },
  { source: 'anime', url: 'https://areajugones.sport.es/anime/feed/' },
];
async function readFeed(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 1800 },
    redirect: 'error',
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('RSS unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty RSS');
  const charset = response.headers.get('content-type') ?? '';
  const decoder = new TextDecoder(
    /(?:iso-8859-1|windows-1252|latin1)/i.test(charset) ? 'windows-1252' : 'utf-8',
  );
  let bytes = 0,
    output = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1000000) {
        await reader.cancel();
        throw new Error('RSS too large');
      }
      output += decoder.decode(part.value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function getRecentGamingNews() {
  const now = Date.now();
  const outcomes = await Promise.allSettled(
    feeds.map(async (feed) => parseGamingRss(await readFeed(feed.url), feed.source, now)),
  );
  return combineGamingNews(
    outcomes.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
  );
}
