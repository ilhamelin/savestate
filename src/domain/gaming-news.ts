export type GamingNewsSource = 'vandal' | 'ign';
export interface GamingNewsItem {
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  source: GamingNewsSource;
  relativeTime: string;
}
export function newsText(input: string) {
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
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  for (const match of [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)].slice(0, 60)) {
    const item = match[1] ?? '';
    const field = (name: string) =>
      item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'))?.[1] ?? '';
    const title = newsText(field('title')).slice(0, 300);
    const date = Date.parse(newsText(field('pubDate')));
    if (!title || !Number.isFinite(date)) continue;
    try {
      const url = new URL(newsText(field('link')));
      const hosts =
        source === 'vandal' ? ['vandal.elespanol.com', 'www.vandal.elespanol.com'] : ['es.ign.com'];
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
    .slice(0, 12);
}
