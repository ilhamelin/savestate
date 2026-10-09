import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '@/lib/http';
import { steamGames, steamProfile, type SteamGame } from '@/domain/steam';
import { steamAchievementSummary } from '@/domain/steam-achievements';

export async function fetchSteamAchievements(steamid: string, appid: number) {
  const account = steamProfile(steamid);
  if (!('steamid' in account) || !Number.isInteger(appid) || appid < 1 || appid > 4294967295)
    throw new AppError('Identificador de Steam inválido.', 400);
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new AppError('Configura STEAM_API_KEY para sincronizar logros.', 503);
  const url = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/');
  url.search = new URLSearchParams({
    key,
    steamid: account.steamid,
    appid: String(appid),
  }).toString();
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    });
    // Steam returns 400 for games without user stats and 403 for unavailable/private stats.
    if (response.status === 400 || response.status === 403) return null;
    if (!response.ok) throw new Error('upstream');
    return steamAchievementSummary(await response.json());
  } catch {
    throw new AppError('No se pudieron consultar los logros de Steam. Inténtalo de nuevo.', 503);
  }
}

async function request(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.STEAM_API_KEY;
  if (!key)
    throw new AppError(
      'El importador está pendiente de configuración: añade STEAM_API_KEY en el servidor. Tu biblioteca actual sigue disponible.',
      503,
    );
  const url = new URL(`https://api.steampowered.com/${path}`);
  url.search = new URLSearchParams({ ...params, key }).toString();
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('upstream');
    return await response.json();
  } catch {
    throw new AppError(
      'Steam no está disponible o la clave de servidor no es válida. Inténtalo de nuevo.',
      503,
    );
  }
}
export async function ownedSteamLibrary(input: unknown) {
  const profile = steamProfile(input);
  let steamid: string;
  if ('steamid' in profile) steamid = profile.steamid;
  else {
    const resolved = (await request('ISteamUser/ResolveVanityURL/v0001/', {
      vanityurl: profile.vanity,
    })) as { response?: { success?: number; steamid?: string } };
    if (resolved.response?.success !== 1 || !resolved.response.steamid)
      throw new AppError('No se encontró ese perfil de Steam.', 404);
    const parsed = steamProfile(resolved.response.steamid);
    if (!('steamid' in parsed)) throw new AppError('Steam devolvió un perfil inválido.', 503);
    steamid = parsed.steamid;
  }
  const games = steamGames(
    await request('IPlayerService/GetOwnedGames/v0001/', {
      steamid,
      include_appinfo: '1',
      include_played_free_games: '1',
    }),
  );
  return { steamid, games };
}
export async function ownedSteamGames(input: unknown) {
  return (await ownedSteamLibrary(input)).games;
}
function signature(value: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('El importador requiere configuración de servidor.', 503);
  return createHmac('sha256', key).update(`savestate.steam.v1:${value}`).digest();
}
export function steamTicket(
  game: SteamGame,
  userId: string,
  steamid?: string,
  purpose: 'game' | 'account' = 'game',
) {
  const payload = Buffer.from(
    JSON.stringify({ game, userId, steamid, purpose, expires: Date.now() + 1800000 }),
  ).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}
export function readSteamTicket(
  value: unknown,
  userId: string,
  purpose: 'game' | 'account' = 'game',
): SteamGame & { steamid?: string } {
  if (typeof value !== 'string' || value.length > 1500)
    throw new AppError('Previsualización inválida.', 400);
  const [payload, mac, extra] = value.split('.');
  if (!payload || !mac || extra) throw new AppError('Previsualización inválida.', 400);
  const expected = signature(payload),
    received = Buffer.from(mac, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new AppError('Previsualización inválida.', 400);
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      parsed.userId !== userId ||
      (parsed.purpose ?? 'game') !== purpose ||
      !Number.isFinite(parsed.expires) ||
      parsed.expires < Date.now()
    )
      throw new Error('expired');
    const game = steamGames({
      response: {
        games: [
          {
            appid: parsed.game.appid,
            name: parsed.game.name,
            playtime_forever: parsed.game.minutes,
          },
        ],
      },
    })[0]!;
    if (parsed.steamid === undefined) return game; // Previously issued tickets remain valid.
    const account = steamProfile(parsed.steamid);
    if (!('steamid' in account)) throw new Error('Invalid signed Steam ID');
    return { ...game, steamid: account.steamid };
  } catch {
    throw new AppError('La previsualización expiró. Vuelve a consultar Steam.', 400);
  }
}
