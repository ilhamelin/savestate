export type GamingNewsSource = 'vandal' | '3djuegos' | 'ign' | 'anime';
export interface GamingNewsItem {
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  source: GamingNewsSource;
  relativeTime: string;
  imageUrl?: string | null;
}
function decodeNewsEntities(input: string) {
  let text = input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const entities: Record<string, string> = {
    amp: '&',
    apos: "'",
    quot: '"',
    lt: '<',
    gt: '>',
    nbsp: ' ',
  };
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(
      /&(#x[\da-f]+|#\d+|amp|apos|quot|lt|gt|nbsp);/gi,
      (match, entity: string) => {
        if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
        const code =
          entity[1]?.toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code)
          : '';
      },
    );
  }
  return text;
}
export function newsText(input: string) {
  return decodeNewsEntities(input)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function extractNewsImage(itemXml: string): string | null {
  const xml = decodeNewsEntities(itemXml);
  const patterns = [
    /<enclosure\b[^>]*\burl\s*=\s*(["'])(.*?)\1/gi,
    /<media:(?:thumbnail|content)\b[^>]*\burl\s*=\s*(["'])(.*?)\1/gi,
    /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi,
  ];
  function safeImage(value: string | undefined) {
    if (!value || value.length > 2000 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
    try {
      const url = new URL(value);
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        ![
          'sm.ign.com',
          'media.vandal.net',
          'videos.vandalimg.com',
          'areajugones.sport.es',
          'i.blogs.es',
          'i.3djuegos.com',
        ].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port ||
        /\.(?:mp4|webm|mp3|ogg)$/i.test(url.pathname)
      )
        return null;
      url.protocol = 'https:';
      return url.href;
    } catch {
      return null;
    }
  }
  for (const pattern of patterns) {
    for (const match of xml.matchAll(pattern)) {
      const url = safeImage(match[2]);
      if (url) return url;
    }
  }
  for (const match of xml.matchAll(/https?:\/\/[^"'\s<>&]+?\.(?:jpg|jpeg|png|webp|avif)/gi)) {
    const url = safeImage(match[0]);
    if (url && /\.(?:jpg|jpeg|png|webp|avif)$/i.test(new URL(url).pathname)) return url;
  }
  return null;
}
export function newsAge(publishedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(publishedAt)) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (!minutes) return 'AHORA';
  if (minutes < 60) return `HACE ${minutes}M`;
  if (minutes < 1440) return `HACE ${Math.floor(minutes / 60)}H`;
  return `HACE ${Math.floor(minutes / 1440)}D`;
}
export function parseGamingRss(
  xml: string,
  source: GamingNewsSource,
  now: number,
): GamingNewsItem[] {
  const items: GamingNewsItem[] = [];
  for (const match of [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)].slice(0, 20)) {
    const item = match[1] ?? '';
    const field = (name: string) =>
      item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'))?.[1] ?? '';
    const title = newsText(field('title')).slice(0, 300);
    const date = Date.parse(newsText(field('pubDate')));
    if (!title || !Number.isFinite(date)) continue;
    try {
      const url = new URL(newsText(field('link')));
      const hosts =
        source === 'vandal'
          ? ['vandal.elespanol.com', 'www.vandal.elespanol.com']
          : source === '3djuegos'
            ? ['www.3djuegos.com', '3djuegos.com']
            : source === 'ign'
              ? ['es.ign.com']
              : ['areajugones.sport.es'];
      if (
        !hosts.includes(url.hostname) ||
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.port
      )
        continue;
      url.protocol = 'https:';
      url.hash = '';
      const publishedAt = new Date(date).toISOString();
      const description = newsText(field('description'));
      items.push({
        title,
        url: url.href,
        publishedAt,
        source,
        relativeTime: newsAge(publishedAt, now),
        imageUrl: extractNewsImage(item),
        description:
          description.length > 180 ? description.slice(0, 177).trimEnd() + '…' : description,
      });
    } catch {
      /* Omitir entradas con enlaces inválidos. */
    }
  }
  return items;
}
export function combineGamingNews(feeds: GamingNewsItem[][]) {
  return [...new Map(feeds.flat().map((item) => [item.url, item])).values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 30);
}
