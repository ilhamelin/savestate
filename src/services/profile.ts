import 'server-only';
import { authenticated } from '@/lib/session';
import { dbCheck, AppError } from '@/lib/http';
import { object, username, text, bool, socialLinks } from '@/domain/validation';
import { publicEnv } from '@/lib/env';
function mediaUrl(input: unknown, userId: string): string | null {
  if (input === null || input === '') return null;
  const value = text(input, 'Imagen', 500);
  if (/^\/avatars\/(cyan|green|pink|amber)\.svg$/.test(value)) return value;
  const url = new URL(value),
    expected = new URL(publicEnv().url);
  if (
    url.origin !== expected.origin ||
    !url.pathname.startsWith(`/storage/v1/object/public/profiles/${userId}/`) ||
    !url.pathname.endsWith('.webp')
  )
    throw new AppError('Imagen de perfil inválida.', 400);
  return url.toString();
}
export async function profileMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  if (!['cyan', 'green', 'pink', 'amber'].includes(String(data.theme_color)))
    throw new AppError('Tema inválido.', 400);
  const { data: row, error } = await db
    .from('profiles')
    .update({
      username: username(data.username),
      terminal_status: text(data.terminal_status ?? '', 'Estado', 160, 0),
      library_private: bool(data.library_private, 'Privacidad'),
      theme_color: data.theme_color as 'cyan' | 'green' | 'pink' | 'amber',
      social_links: socialLinks(data.social_links ?? {}),
      avatar_url: mediaUrl(data.avatar_url, user.id),
      banner_url: mediaUrl(data.banner_url, user.id),
    })
    .eq('id', user.id)
    .select()
    .single();
  dbCheck(error);
  return row;
}
