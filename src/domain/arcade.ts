import { object, text, uuid, ValidationError } from './validation.ts';
import type { Game, Profile } from './model.ts';
export const ROOM_THEMES = [
  'crt_terminal',
  'handheld_console',
  'retro_shelf',
  'arcade_cabinet',
  'cyber_deck',
  'vaporwave_shrine',
  'halloween_crypt',
  'christmas_lodge',
] as const;
export type RoomTheme = (typeof ROOM_THEMES)[number];
export const ROOM_LABELS: Record<RoomTheme, string> = {
  crt_terminal: 'Terminal CRT',
  handheld_console: 'Consola portátil',
  retro_shelf: 'Estantería retro',
  arcade_cabinet: '👾 Cabina Arcade 80s',
  cyber_deck: '⚡ Cyberdeck HUD',
  vaporwave_shrine: '🌅 Santuario Vaporwave',
  halloween_crypt: '🎃 Noche de Halloween (Spooky)',
  christmas_lodge: '🎄 Cabaña de Navidad (Holiday)',
};
export function roomTheme(input: unknown): RoomTheme {
  if (!ROOM_THEMES.includes(input as RoomTheme)) throw new ValidationError('Habitación inválida.');
  return input as RoomTheme;
}
export const PARTY_PLATFORMS = [
  'PC',
  'PlayStation',
  'Xbox',
  'Nintendo Switch',
  'Retro/Emulador',
  'Multiplataforma',
] as const;
export type PartyPlatform = (typeof PARTY_PLATFORMS)[number];
export const PARTY_STYLES = ['casual', 'competitive', 'coop_campaign', 'achievements'] as const;
export type PartyStyle = (typeof PARTY_STYLES)[number];
export const PARTY_STYLE_LABELS: Record<PartyStyle, string> = {
  casual: 'Casual',
  competitive: 'Competitivo',
  coop_campaign: 'Campaña cooperativa',
  achievements: 'Logros',
};
export interface GameDuel {
  id: string;
  game_a_id: string;
  game_b_id: string;
  title: string;
  is_active: boolean;
  created_at: string;
}
export interface DuelVote {
  duel_id: string;
  user_id: string;
  chosen_game_id: string;
  created_at: string;
}
export interface PartyRequest {
  id: string;
  user_id: string;
  game_id: string;
  platform: PartyPlatform;
  playstyle: PartyStyle;
  schedule: string;
  contact_note: string;
  created_at: string;
  expires_at: string;
}
export type ArcadeGame = Pick<Game, 'id' | 'title' | 'slug' | 'cover_url'>;
export interface DuelSummary {
  duel: GameDuel;
  games: ArcadeGame[];
  votes: Record<string, number>;
  ownVote: string | null;
}
export interface PartyCardData extends PartyRequest {
  game: ArcadeGame;
  author: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'level'>;
}
export function partyInput(input: unknown) {
  const data = object(input);
  if (!PARTY_PLATFORMS.includes(data.platform as PartyPlatform))
    throw new ValidationError('Plataforma inválida.');
  if (!PARTY_STYLES.includes(data.playstyle as PartyStyle))
    throw new ValidationError('Estilo inválido.');
  return {
    game_id: uuid(data.game_id),
    platform: data.platform as PartyPlatform,
    playstyle: data.playstyle as PartyStyle,
    schedule: text(data.schedule, 'Horario', 100, 3),
    contact_note: text(data.contact_note, 'Contacto', 500, 3),
  };
}
export function duelPercentages(a: number, b: number): [number, number] {
  const total = a + b;
  if (!total) return [0, 0];
  const first = Math.round((a * 100) / total);
  return [first, 100 - first];
}
export function remainingPartyTime(expiresAt: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60000));
  if (!minutes) return 'Expirada';
  return minutes < 60 ? `Expira en ${minutes} min` : `Expira en ${Math.ceil(minutes / 60)} h`;
}

export interface PartyFeedResponse {
  items: PartyCardData[];
  hasMore: boolean;
  generatedAt: number;
}
export interface PartyFeedFilters {
  platform?: PartyPlatform;
  playstyle?: PartyStyle;
  page: number;
}
export function partyFeedFilters(params: URLSearchParams): PartyFeedFilters {
  for (const name of ['platform', 'playstyle', 'page']) {
    if (params.getAll(name).length > 1) throw new ValidationError('Filtro repetido.');
  }
  const platform = params.get('platform') || undefined;
  const playstyle = params.get('playstyle') || undefined;
  const page = params.get('page') ?? '1';
  if (platform && !PARTY_PLATFORMS.includes(platform as PartyPlatform))
    throw new ValidationError('Plataforma inválida.');
  if (playstyle && !PARTY_STYLES.includes(playstyle as PartyStyle))
    throw new ValidationError('Estilo inválido.');
  if (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) > 10000)
    throw new ValidationError('Página inválida (1–10000).');
  return {
    platform: platform as PartyPlatform | undefined,
    playstyle: playstyle as PartyStyle | undefined,
    page: Number(page),
  };
}
