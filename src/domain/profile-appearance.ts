import type { Theme } from './model.ts';
import { isThemeColor, themeColor } from './profile-studio.ts';
import { ROOM_THEMES, type RoomTheme } from './arcade.ts';

export const APPEARANCE_BACKUP_KEY = '_savestate_appearance';
export const LEGACY_COLORS = ['cyan', 'green', 'pink', 'amber'] as const;
export const LEGACY_ROOMS = ['crt_terminal', 'handheld_console', 'retro_shelf'] as const;
type Appearance = {
  theme_color: Theme;
  room_theme: RoomTheme;
  social_links: Record<string, string>;
};

export function appearanceNeedsFallback(theme: Theme, room: RoomTheme) {
  return (
    !LEGACY_COLORS.some((value) => value === theme) || !LEGACY_ROOMS.some((value) => value === room)
  );
}
export function legacyAppearance(profile: Appearance): Appearance {
  return {
    theme_color: LEGACY_COLORS.find((value) => value === profile.theme_color) ?? 'cyan',
    room_theme: LEGACY_ROOMS.find((value) => value === profile.room_theme) ?? 'crt_terminal',
    social_links: {
      ...profile.social_links,
      [APPEARANCE_BACKUP_KEY]: `v1:${profile.theme_color}:${profile.room_theme}`,
    },
  };
}
export function restoreProfileAppearance<T extends Appearance>(profile: T): T {
  const social_links = { ...profile.social_links };
  const backup = social_links[APPEARANCE_BACKUP_KEY];
  delete social_links[APPEARANCE_BACKUP_KEY];
  const parts = typeof backup === 'string' ? backup.split(':') : [];
  if (
    parts.length === 3 &&
    parts[0] === 'v1' &&
    isThemeColor(parts[1]) &&
    ROOM_THEMES.includes(parts[2] as RoomTheme)
  ) {
    return {
      ...profile,
      social_links,
      theme_color: themeColor(parts[1]),
      room_theme: parts[2] as RoomTheme,
    };
  }
  return { ...profile, social_links };
}
