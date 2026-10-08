import 'server-only';
import { authenticated } from '@/lib/session';
import { dbCheck, AppError } from '@/lib/http';
import { object, username, text, bool, socialLinks } from '@/domain/validation';
import { publicEnv } from '@/lib/env';
import { roomTheme } from '@/domain/arcade';
import { ownedPlatforms } from '@/domain/hardware';
import { wallpaperForDisplay } from '@/domain/wallpaper';
function mediaUrl(input: unknown, userId: string, wallpaper = false): string | null {
  if (input === null || input === '') return null;
  const value = text(input, 'Imagen', 500);
  if (wallpaper) {
    const safe = wallpaperForDisplay(value, userId, publicEnv().url);
    if (!safe) throw new AppError('Wallpaper inválido.', 400);
    return safe;
  }
  if (/^\/avatars\/(cyan|green|pink|amber)\.svg$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('Imagen de perfil inválida.', 400);
  }
  const expected = new URL(publicEnv().url);
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
      ...(data.room_theme === undefined ? {} : { room_theme: roomTheme(data.room_theme) }),
      ...(data.owned_platforms === undefined
        ? {}
        : { owned_platforms: ownedPlatforms(data.owned_platforms) }),
      social_links: socialLinks(data.social_links ?? {}),
      avatar_url: mediaUrl(data.avatar_url, user.id),
      banner_url: mediaUrl(data.banner_url, user.id),
      ...(data.wallpaper_url === undefined
        ? {}
        : { wallpaper_url: mediaUrl(data.wallpaper_url, user.id, true) }),
    })
    .eq('id', user.id)
    .select()
    .single();
  dbCheck(error);
  return row;
}
