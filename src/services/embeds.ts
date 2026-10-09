import 'server-only';
import { unstable_cache } from 'next/cache';
import { socialPost } from '@/domain/social-embed';
import { sanitizeEmbedHtml } from './embed-html';
import { AppError } from '@/lib/http';

const cachedEmbed = unstable_cache(
  async (canonical: string) => {
    const post = socialPost(canonical);
    if (!post) throw new AppError('Enlace social no válido.', 400);
    const endpoint = new URL(
      post.provider === 'twitter'
        ? 'https://publish.twitter.com/oembed'
        : 'https://api.instagram.com/oembed',
    );
    endpoint.search = new URLSearchParams({
      url: post.url,
      omit_script: 'true',
      ...(post.provider === 'twitter' ? { theme: 'dark' } : {}),
    }).toString();
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(7000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok)
      throw new AppError(
        'No se pudo cargar la publicación. Puede ser privada o no estar disponible.',
        502,
      );
    const raw = await response.text();
    if (raw.length > 100000) throw new AppError('Respuesta del proveedor demasiado grande.', 502);
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('html' in data) || typeof data.html !== 'string')
      throw new AppError('El proveedor no devolvió un embed.', 502);
    const html = sanitizeEmbedHtml(data.html);
    if (!html.trim()) throw new AppError('Publicación no disponible.', 502);
    return { html, provider: post.provider, url: post.url };
  },
  ['social-oembed-v1'],
  { revalidate: 604800 },
);

export async function fetchSocialEmbed(url: string) {
  const post = socialPost(url);
  if (!post)
    throw new AppError('Solo se admiten publicaciones HTTPS de X/Twitter o Instagram.', 400);
  try {
    return await cachedEmbed(post.url);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('No se pudo cargar la publicación social.', 502);
  }
}
