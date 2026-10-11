import type { Profile, Theme, ThemePreset } from './model.ts';
import { ValidationError } from './validation.ts';
import { hardwareForDisplay } from './hardware.ts';
export type DraftProfile = Pick<
  Profile,
  | 'username'
  | 'avatar_url'
  | 'banner_url'
  | 'wallpaper_url'
  | 'theme_color'
  | 'room_theme'
  | 'terminal_status'
  | 'library_private'
  | 'social_links'
  | 'owned_platforms'
> &
  Partial<Pick<Profile, 'psn_id' | 'xbox_gamertag' | 'equipped_title' | 'equipped_frame'>>;
export const SOCIAL_KEYS = ['steam', 'discord', 'twitch', 'github', 'x'] as const;
export const PROFILE_COLORS: Record<ThemePreset, string> = {
  cyan: '#00f0ff',
  green: '#00ff66',
  pink: '#ff0055',
  amber: '#ffb800',
  halloween: '#ff6b00',
  purple: '#a855f7',
  christmas: '#ff2e4c',
  ice: '#38bdf8',
};
export const PROFILE_COLOR_LABELS: Record<ThemePreset, string> = {
  cyan: 'Cian neón',
  green: 'Verde fósforo',
  pink: 'Rosa synthwave',
  amber: 'Ámbar CRT',
  halloween: '🎃 Naranja Halloween',
  purple: '🔮 Violeta Espectral',
  christmas: '🎄 Rojo Navidad',
  ice: '❄️ Hielo Invernal',
};
export const GALLERY_AVATARS = [
  { id: 'cyan', name: 'Pixel cian', url: '/avatars/cyan.svg' },
  { id: 'green', name: 'Pixel verde', url: '/avatars/green.svg' },
  { id: 'pink', name: 'Pixel rosa', url: '/avatars/pink.svg' },
  { id: 'amber', name: 'Pixel ámbar', url: '/avatars/amber.svg' },
  { id: 'halloween_pumpkin', name: '🎃 Calabaza Halloween', url: '/avatars/halloween_pumpkin.svg' },
  { id: 'halloween_ghost', name: '👻 Fantasma Espectral', url: '/avatars/halloween_ghost.svg' },
  { id: 'christmas_santa', name: '🎄 Santa Pixel', url: '/avatars/christmas_santa.svg' },
  { id: 'christmas_snowman', name: '⛄ Muñeco de Nieve', url: '/avatars/christmas_snowman.svg' },
  { id: 'retro_robot', name: '🤖 Robot 8-Bit', url: '/avatars/retro_robot.svg' },
  { id: 'space_invader', name: '👾 Alien Arcade', url: '/avatars/space_invader.svg' },
  { id: 'cyber_samurai', name: '⚔️ Cyber Samurai', url: '/avatars/cyber_samurai.svg' },
  { id: 'wizard_mage', name: '🧙‍♂️ Mago RPG', url: '/avatars/wizard_mage.svg' },
] as const;
export function isThemeColor(value: unknown): value is Theme {
  return (
    typeof value === 'string' &&
    (Object.hasOwn(PROFILE_COLORS, value) || /^#[0-9a-fA-F]{6}$/.test(value))
  );
}
export function themeColor(value: unknown): Theme {
  if (!isThemeColor(value))
    throw new ValidationError('Color de perfil inválido. Usa un preset o #RRGGBB.');
  return value.startsWith('#') ? (value.toLowerCase() as Theme) : value;
}
export function resolveThemeColor(themeColor: string): string {
  if (!isThemeColor(themeColor)) return PROFILE_COLORS.cyan;
  return themeColor.startsWith('#')
    ? themeColor.toLowerCase()
    : PROFILE_COLORS[themeColor as ThemePreset];
}
export const QUICK_STATUSES = [
  '🕹️ Jugando...',
  '🧭 Buscando próxima aventura',
  '⏸️ En pausa',
  '🏆 Platinando',
  '💀 Muriendo en bucle',
] as const;
export function profileDraft(profile: DraftProfile): DraftProfile {
  return {
    equipped_title: profile.equipped_title ?? 'Insert Coin',
    equipped_frame: profile.equipped_frame ?? 'default',
    psn_id: profile.psn_id ?? null,
    xbox_gamertag: profile.xbox_gamertag ?? null,
    username: profile.username,
    avatar_url: profile.avatar_url,
    banner_url: profile.banner_url,
    wallpaper_url: profile.wallpaper_url ?? null,
    theme_color: profile.theme_color,
    room_theme: profile.room_theme ?? 'crt_terminal',
    terminal_status: profile.terminal_status,
    library_private: profile.library_private,
    social_links: Object.fromEntries(
      SOCIAL_KEYS.map((key) => [key, profile.social_links[key] ?? '']),
    ),
    owned_platforms: hardwareForDisplay(profile.owned_platforms),
  };
}
export function profileChanged(draft: DraftProfile, saved: DraftProfile) {
  return JSON.stringify(profileDraft(draft)) !== JSON.stringify(profileDraft(saved));
}
