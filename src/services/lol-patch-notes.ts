import 'server-only';
import { AppError } from '@/lib/http';
import {
  parseLolPatchList,
  parseLolPatchDetail,
  normalizeSkinSearch,
  parseSpotlightVideos,
  type SkinVideo,
} from '@/domain/lol-patch-notes';
const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();
function cached<T>(key: string, ttl: number, action: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<T>;
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const promise = action().catch((error) => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw error;
  });
  cache.set(key, { expires: Date.now() + ttl, promise });
  return promise;
}
async function html(url: string, ttl: number) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    next: { revalidate: ttl / 1000 },
    headers: { 'Accept-Language': 'es-ES,es;q=0.9', 'User-Agent': 'SaveStatePatchReader/1.0' },
  });
  if (!response.ok)
    throw new AppError('La fuente oficial no está disponible. Inténtalo más tarde.', 503);
  const reader = response.body?.getReader();
  if (!reader) throw new AppError('Respuesta vacía de la fuente oficial.', 503);
  let bytes = 0,
    output = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 5000000) {
        await reader.cancel();
        throw new AppError('La respuesta de la fuente es demasiado grande.', 503);
      }
      output += decoder.decode(part.value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export function fetchLolPatches2026() {
  return cached('list', 900000, async () => {
    const patches = parseLolPatchList(
      await html('https://www.leagueoflegends.com/es-es/news/tags/patch-notes/', 900000),
    );
    if (!patches.length) throw new AppError('Riot no devolvió notas de parche de 2026.', 503);
    return {
      patches,
      latestVersion: patches[0]?.version ?? null,
      fetchedAt: new Date().toISOString(),
    };
  });
}
export function fetchLolPatchDetail(slug: string) {
  if (!/^[a-z0-9-]{1,160}$/i.test(slug))
    throw new AppError('Identificador de parche inválido.', 400);
  return cached('patch:' + slug, 1800000, async () => {
    try {
      return parseLolPatchDetail(
        await html(
          'https://www.leagueoflegends.com/es-es/news/game-updates/' + slug + '/',
          1800000,
        ),
        slug,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('No se pudo interpretar la nota oficial de Riot.', 503);
    }
  });
}
export function resolveSkinSpotlightVideo(title: string): Promise<SkinVideo> {
  if (!title.trim() || title.length > 200 || /[\p{Cc}\p{Cf}]/u.test(title))
    throw new AppError('Nombre de aspecto inválido.', 400);
  const normalized = normalizeSkinSearch(title),
    query = normalized + ' Skin Spotlight';
  return cached('video:' + normalized.toLowerCase(), 3600000, async () => {
    const searchUrl =
      'https://www.youtube.com/@SkinSpotlights/search?query=' + encodeURIComponent(query);
    const fallback: SkinVideo = {
      videoId: null,
      videoTitle: null,
      embedUrl: null,
      youtubeUrl: null,
      searchUrl,
    };
    for (const q of [
      ...new Set([query, (normalized.split(' ')[0] ?? normalized) + ' Skin Spotlight']),
    ]) {
      try {
        const found = parseSpotlightVideos(
          await html(
            'https://www.youtube.com/@SkinSpotlights/search?query=' + encodeURIComponent(q),
            3600000,
          ),
          title,
        );
        if (found)
          return {
            ...found,
            embedUrl:
              'https://www.youtube-nocookie.com/embed/' + found.videoId + '?autoplay=1&rel=0',
            youtubeUrl: 'https://www.youtube.com/watch?v=' + found.videoId,
            searchUrl,
          };
      } catch {
        /* YouTube may require consent or block automated reads. Keep official fallback. */
      }
    }
    return fallback;
  });
}
