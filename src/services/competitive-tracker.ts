import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  competitiveInput,
  normalizedGenshin,
  normalizedHsr,
  normalizedRust,
  type CompetitiveProfile,
} from '@/domain/competitive-tracker';
import { inspectValorant } from '@/services/valorant';
import { AppError } from '@/lib/http';
import { getEnkaStore } from '@/services/genshin-enka-store';
import { getHsrEnkaStore } from '@/services/hsr-enka-store';
import { steamProfile } from '@/domain/steam';
import { record } from '@/domain/game-live-telemetry';
async function upstream(url: string, headers: Record<string, string> = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'SaveState/1.0 (+https://savestate.app)', ...headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      redirect: 'error',
    });
  } catch {
    throw new AppError('El proveedor no respondió a tiempo. Inténtalo más tarde.', 503);
  }
  if (!response.ok)
    throw new AppError(
      response.status === 404
        ? 'No se encontró esta cuenta pública.'
        : response.status === 429
          ? 'El proveedor está ocupado. Inténtalo en unos minutos.'
          : 'No se pudo consultar el tracker. Verifica la cuenta o inténtalo más tarde.',
      response.status === 404 ? 404 : response.status === 429 ? 429 : 503,
    );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AppError('Respuesta del proveedor inválida.', 503);
  }
}
const inspectCached = unstable_cache(
  async (input: ReturnType<typeof competitiveInput>): Promise<CompetitiveProfile> => {
    if (input.game === 'hsr') {
      const [payload, store] = await Promise.all([
        upstream(`https://enka.network/api/hsr/uid/${input.uid}/`),
        getHsrEnkaStore(),
      ]);
      return normalizedHsr(payload, input.uid, store);
    }
    if (input.game === 'rust') {
      const key = process.env.STEAM_API_KEY?.trim();
      if (!key)
        throw new AppError('Se requiere configurar STEAM_API_KEY para consultar Rust.', 503);
      const steamRequest = (method: string, params: Record<string, string>) =>
        upstream(
          `https://api.steampowered.com/${method}/?${new URLSearchParams({ key, ...params })}`,
        );
      let steamId: string;
      if ('vanity' in input.target) {
        const resolved = record(
          record(
            await steamRequest('ISteamUser/ResolveVanityURL/v0001', {
              vanityurl: input.target.vanity,
            }),
          ).response,
        );
        if (resolved.success !== 1 || typeof resolved.steamid !== 'string')
          throw new AppError('Steam no encontró ese nombre personalizado.', 404);
        const target = steamProfile(resolved.steamid);
        if (!('steamid' in target))
          throw new AppError('Steam devolvió un identificador inválido.', 503);
        steamId = target.steamid;
      } else steamId = input.target.steamid;
      const results = await Promise.allSettled([
        steamRequest('ISteamUser/GetPlayerSummaries/v0002', { steamids: steamId }),
        steamRequest('IPlayerService/GetOwnedGames/v0001', {
          steamid: steamId,
          include_appinfo: '1',
          include_played_free_games: '1',
        }),
        steamRequest('ISteamUserStats/GetUserStatsForGame/v0002', {
          steamid: steamId,
          appid: '252490',
        }),
        steamRequest('ISteamUserStats/GetPlayerAchievements/v0001', {
          steamid: steamId,
          appid: '252490',
        }),
      ]);
      if (results[0].status === 'rejected') throw results[0].reason;
      const values = results.map((result) => (result.status === 'fulfilled' ? result.value : null));
      return normalizedRust(values[0], values[1], values[2], steamId, values[3]);
    }
    if (input.game === 'genshin') {
      const [payload, store] = await Promise.all([
        upstream(`https://enka.network/api/uid/${input.uid}/`),
        getEnkaStore(),
      ]);
      return normalizedGenshin(payload, input.uid, store);
    }
    return inspectValorant(input);
  },
  ['competitive-tracker-v4'],
  { revalidate: 60 },
);
export async function inspectCompetitive(input: unknown) {
  return inspectCached(competitiveInput(input));
}
