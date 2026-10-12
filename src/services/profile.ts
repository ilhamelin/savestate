import 'server-only';
import { authenticated } from '@/lib/session';
import { dbCheck, AppError } from '@/lib/http';
import { object, username, text, bool, socialLinks } from '@/domain/validation';
import { publicEnv } from '@/lib/env';
import { roomTheme } from '@/domain/arcade';
import { ownedPlatforms } from '@/domain/hardware';
import { wallpaperForDisplay } from '@/domain/wallpaper';
import { consoleIdentity } from '@/domain/console-import';
import { equippedRewards } from '@/domain/progression';
import { GALLERY_AVATARS, themeColor } from '@/domain/profile-studio';
import { isValidBannerStoragePath } from '@/domain/banner-media';
import {
  appearanceNeedsFallback,
  legacyAppearance,
  restoreProfileAppearance,
} from '@/domain/profile-appearance';
function mediaUrl(
  input: unknown,
  userId: string,
  kind: 'avatar' | 'banner' | 'wallpaper' = 'avatar',
): string | null {
  if (input === null || input === '') return null;
  const value = text(input, 'Imagen', 500);
  if (kind === 'wallpaper') {
    const safe = wallpaperForDisplay(value, userId, publicEnv().url);
    if (!safe) throw new AppError('Wallpaper inválido.', 400);
    return safe;
  }
  if (kind === 'avatar' && GALLERY_AVATARS.some((avatar) => avatar.url === value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('Imagen de perfil inválida.', 400);
  }
  const expected = new URL(publicEnv().url);
  if (
    url.origin !== expected.origin ||
    (kind === 'banner'
      ? !isValidBannerStoragePath(url.pathname, userId)
      : !url.pathname.startsWith(`/storage/v1/object/public/profiles/${userId}/`) ||
        !url.pathname.endsWith('.webp'))
  )
    throw new AppError('Imagen de perfil inválida.', 400);
  return url.toString();
}
export async function profileMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  const existing = await db
    .from('profiles')
    .select('level,equipped_title,equipped_frame,theme_color,room_theme,social_links')
    .eq('id', user.id)
    .single();
  dbCheck(existing.error);
  if (!existing.data) throw new AppError('Perfil no encontrado.', 404);
  const cosmetics = equippedRewards(
    data.equipped_title ?? existing.data.equipped_title,
    data.equipped_frame ?? existing.data.equipped_frame,
    existing.data.level,
  );
  const appearance = {
    theme_color: themeColor(data.theme_color),
    room_theme: roomTheme(data.room_theme ?? restoreProfileAppearance(existing.data).room_theme),
    social_links: socialLinks(data.social_links ?? {}),
  };
  const update = {
    ...cosmetics,
    ...(data.psn_id === undefined ? {} : { psn_id: consoleIdentity(data.psn_id) }),
    ...(data.xbox_gamertag === undefined
      ? {}
      : { xbox_gamertag: consoleIdentity(data.xbox_gamertag) }),
    username: username(data.username),
    terminal_status: text(data.terminal_status ?? '', 'Estado', 160, 0),
    library_private: bool(data.library_private, 'Privacidad'),
    ...appearance,
    ...(data.owned_platforms === undefined
      ? {}
      : { owned_platforms: ownedPlatforms(data.owned_platforms) }),
    avatar_url: mediaUrl(data.avatar_url, user.id),
    banner_url: mediaUrl(data.banner_url, user.id, 'banner'),
    ...(data.wallpaper_url === undefined
      ? {}
      : { wallpaper_url: mediaUrl(data.wallpaper_url, user.id, 'wallpaper') }),
  };
  let result = await db.from('profiles').update(update).eq('id', user.id).select().single();
  if (
    result.error?.code === '23514' &&
    appearanceNeedsFallback(appearance.theme_color, appearance.room_theme)
  ) {
    // Retry only a validated appearance; never bypass RLS or use the service-role client.
    result = await db
      .from('profiles')
      .update({ ...update, ...legacyAppearance(appearance) })
      .eq('id', user.id)
      .select()
      .single();
  }
  dbCheck(result.error);
  if (!result.data) throw new AppError('Perfil no encontrado.', 404);
  return restoreProfileAppearance(result.data);
}
