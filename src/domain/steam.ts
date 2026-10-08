import { object, text, ValidationError } from './validation.ts';
export interface SteamGame {
  appid: number;
  name: string;
  minutes: number;
}
export interface SteamPreview extends SteamGame {
  ticket: string;
}
export type SteamStatus = 'backlog' | 'playing' | 'cleared';
export function steamProfile(input: unknown): { steamid: string } | { vanity: string } {
  const value = text(input, 'Perfil de Steam', 200);
  const numeric = (id: string) => {
    if (!/^7656\d{13}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new ValidationError('Steam ID 64 inválido.');
    return { steamid: id };
  };
  if (/^\d+$/.test(value)) return numeric(value);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError('Usa Steam ID 64 o un enlace HTTPS de steamcommunity.com.');
  }
  if (
    url.protocol !== 'https:' ||
    !['steamcommunity.com', 'www.steamcommunity.com'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new ValidationError('Enlace de Steam inválido.');
  const match = /^\/(profiles|id)\/([A-Za-z0-9_-]{2,64})\/?$/.exec(url.pathname);
  if (!match) throw new ValidationError('Usa un enlace de perfil de Steam.');
  return match[1] === 'profiles' ? numeric(match[2]!) : { vanity: match[2]! };
}
export function steamGames(input: unknown): SteamGame[] {
  const response = object(object(input).response);
  if (response.games === undefined && response.game_count === 0) return [];
  if (!Array.isArray(response.games) || response.games.length > 10000)
    throw new ValidationError(
      'Steam no devolvió una biblioteca visible. Revisa la privacidad de Detalles de juegos.',
    );
  const ids = new Set<number>();
  return response.games
    .map((raw) => {
      const row = object(raw),
        appid = Number(row.appid),
        minutes = Number(row.playtime_forever);
      if (
        !Number.isInteger(appid) ||
        appid < 1 ||
        appid > 4294967295 ||
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > 6000000 ||
        ids.has(appid)
      )
        throw new ValidationError('Respuesta de Steam inválida.');
      ids.add(appid);
      return { appid, name: text(row.name, 'Título de Steam', 200), minutes };
    })
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}
export function suggestedSteamStatus(minutes: number): SteamStatus {
  return minutes > 0 ? 'playing' : 'backlog';
}
export function steamStatus(input: unknown): SteamStatus {
  if (!['backlog', 'playing', 'cleared'].includes(input as string))
    throw new ValidationError('Estado de importación inválido.');
  return input as SteamStatus;
}
export function matchingTitle(value: string) {
  return value
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}
