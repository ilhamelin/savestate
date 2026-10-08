import { object, text, uuid, bool, ValidationError } from './validation.ts';
import type { Reaction } from './model.ts';

export const POST_CATEGORIES = [
  'epic',
  'emotional',
  'funny',
  'glitch',
  'speedrun',
  'other',
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  epic: 'Épico',
  emotional: 'Emotivo',
  funny: 'Gracioso',
  glitch: 'Glitch',
  speedrun: 'Speedrun',
  other: 'Otro',
};
export interface Post {
  id: string;
  user_id: string;
  game_id: string | null;
  title: string;
  content: string;
  category: PostCategory;
  media_type: 'none' | 'images' | 'youtube';
  image_urls: string[];
  youtube_video_id: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}
export interface PostReaction {
  post_id: string;
  user_id: string;
  reaction_type: Reaction;
}
export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
export function postCategory(value: unknown): PostCategory {
  if (!POST_CATEGORIES.includes(value as PostCategory))
    throw new ValidationError('Categoría inválida.');
  return value as PostCategory;
}
export function youtubeId(input: unknown): string | null {
  if (input === '' || input === null || input === undefined) return null;
  const value = text(input, 'Enlace de YouTube', 500);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError('Usa un enlace válido de YouTube.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new ValidationError('Usa un enlace HTTPS de YouTube.');
  let id: string | null = null;
  if (url.hostname === 'youtu.be' && /^\/[^/]+\/?$/.test(url.pathname))
    id = url.pathname.split('/')[1] ?? null;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (/^\/shorts\/[^/]+\/?$/.test(url.pathname)) id = url.pathname.split('/')[2] ?? null;
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new ValidationError('El enlace debe corresponder a un video de YouTube.');
  return id;
}
export function highlightPaths(input: unknown, userId: string, postId: string): string[] {
  if (!Array.isArray(input) || input.length > 4)
    throw new ValidationError('Puedes adjuntar hasta cuatro capturas.');
  const paths = input.map((value) => {
    const path = text(value, 'Captura', 150);
    const prefix = `${uuid(userId)}/${uuid(postId)}/`;
    if (!path.startsWith(prefix) || !/^[a-f0-9-]{36}\.webp$/i.test(path.slice(prefix.length)))
      throw new ValidationError('Ruta de captura inválida.');
    uuid(path.slice(prefix.length, -5));
    return path;
  });
  if (new Set(paths).size !== paths.length)
    throw new ValidationError('Las capturas deben ser diferentes.');
  return paths;
}
export function validatePost(input: unknown, userId: string) {
  const data = object(input),
    id = uuid(data.id),
    image_urls = highlightPaths(data.image_urls ?? [], userId, id),
    youtube_video_id = youtubeId(data.youtube_url);
  if (image_urls.length && youtube_video_id)
    throw new ValidationError('Elige capturas o un video, no ambos.');
  return {
    id,
    user_id: uuid(userId),
    game_id: data.game_id ? uuid(data.game_id) : null,
    title: text(data.title, 'Título', 120, 3),
    content: text(data.content ?? '', 'Descripción', 5000, 0),
    category: postCategory(data.category),
    is_private: bool(data.is_private, 'Privacidad'),
    image_urls,
    youtube_video_id,
    media_type: (youtube_video_id
      ? 'youtube'
      : image_urls.length
        ? 'images'
        : 'none') as Post['media_type'],
  };
}
