import 'server-only';
import { itchUrl, itchMetadata, latestItchDevlog, type ItchMetadata } from '@/domain/itch-tracker';
import { AppError } from '@/lib/http';

async function read(url: string) {
  const response = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new AppError(
      'itch.io no pudo devolver el juego o su devlog. Revisa que sea público.',
      502,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new AppError('Respuesta vacía de itch.io.', 502);
  let bytes = 0,
    output = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 1000000) {
        await reader.cancel();
        throw new AppError('Respuesta de itch.io demasiado grande.', 502);
      }
      output += decoder.decode(part.value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function inspectItch(input: unknown): Promise<ItchMetadata> {
  const url = itchUrl(input);
  try {
    const [data, feed] = await Promise.all([
      read(`${url}/data.json`),
      read(`${url}/devlog.rss`)
        .then((rss) => ({ devlog: latestItchDevlog(rss, url), available: true }))
        .catch(() => ({ devlog: null, available: false })),
    ]);
    return {
      ...itchMetadata(JSON.parse(data), url),
      devlog: feed.devlog,
      devlogAvailable: feed.available,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('No se pudo consultar itch.io. Revisa la URL y vuelve a intentarlo.', 502);
  }
}
