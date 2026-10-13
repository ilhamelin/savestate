import 'server-only';
import { AppError } from '@/lib/http';
export function tmdbConfigured() {
  return Boolean(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);
}
export async function tmdbRequest(
  path: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  if (!tmdbConfigured())
    throw new AppError(
      'Configura TMDB_API_KEY o TMDB_READ_TOKEN para consultar el catálogo real.',
      503,
    );
  if (
    !/^(trending\/(all|tv|movie)\/week|search\/multi|movie\/(popular|upcoming|top_rated)|tv\/(popular|top_rated)|(?:tv|movie)\/\d+(?:\/(?:watch\/providers|season\/\d+))?)$/.test(
      path,
    )
  )
    throw new AppError('Consulta TMDB inválida.', 400);
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set('language', 'es-ES');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) url.searchParams.set('api_key', process.env.TMDB_API_KEY!);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      next: { revalidate: 3600 },
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new AppError('TMDB no está disponible. Inténtalo de nuevo.', 503);
  }
  if (!response.ok)
    throw new AppError(
      response.status === 404
        ? 'Título o temporada no encontrado en TMDB.'
        : 'No se pudo consultar TMDB. Revisa la configuración o inténtalo más tarde.',
      response.status === 404 ? 404 : 503,
    );
  const reader = response.body?.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  if (reader)
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 2500000) {
          await reader.cancel();
          throw new AppError('Respuesta TMDB demasiado grande.', 503);
        }
        chunks.push(new Uint8Array(part.value));
      }
    } finally {
      reader.releaseLock();
    }
  try {
    const value: unknown = JSON.parse(await new Blob(chunks).text());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new AppError('Respuesta TMDB inválida.', 503);
  }
}
