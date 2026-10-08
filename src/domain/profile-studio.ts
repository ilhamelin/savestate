import type { Profile, Theme } from './model.ts';
import { hardwareForDisplay } from './hardware.ts';
export type DraftProfile = Pick<
  Profile,
  | 'username'
  | 'avatar_url'
  | 'banner_url'
  | 'theme_color'
  | 'room_theme'
  | 'terminal_status'
  | 'library_private'
  | 'social_links'
  | 'owned_platforms'
>;
export const SOCIAL_KEYS = ['steam', 'discord', 'twitch', 'github', 'x'] as const;
export const PROFILE_COLORS: Record<Theme, string> = {
  cyan: '#00f0ff',
  green: '#00ff66',
  pink: '#ff0055',
  amber: '#ffb800',
};
export const QUICK_STATUSES = [
  '🕹️ Jugando...',
  '🧭 Buscando próxima aventura',
  '⏸️ En pausa',
  '🏆 Platinando',
  '💀 Muriendo en bucle',
] as const;
export function profileDraft(profile: DraftProfile): DraftProfile {
  return {
    username: profile.username,
    avatar_url: profile.avatar_url,
    banner_url: profile.banner_url,
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
