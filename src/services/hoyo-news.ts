import 'server-only';
import { parseHoyoNews, type HoyoGame, type HoyoNewsItem } from '@/domain/hoyo-hub';

const GIDS_MAP: Record<HoyoGame, number> = { genshin: 2, hsr: 6 };
export async function fetchHoyoNews(game: HoyoGame): Promise<HoyoNewsItem[]> {
  try {
    const response = await fetch(
      `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=${GIDS_MAP[game]}&type=1&page_size=8`,
      {
        headers: { 'x-rpc-language': 'es-es', Accept: 'application/json' },
        next: { revalidate: 900 },
        redirect: 'error',
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return [];
    // Bound the response before JSON parsing; provider failures never block the other game.
    const reader = response.body?.getReader();
    if (!reader) return [];
    const decoder = new TextDecoder();
    let body = '',
      bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1_000_000) {
          await reader.cancel();
          return [];
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    return parseHoyoNews(JSON.parse(body));
  } catch {
    return [];
  }
}
