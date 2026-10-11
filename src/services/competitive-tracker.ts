import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  competitiveInput,
  normalizedGenshin,
  type CompetitiveProfile,
} from '@/domain/competitive-tracker';
import { record } from '@/domain/game-live-telemetry';
import { AppError } from '@/lib/http';
import { getEnkaStore } from '@/services/genshin-enka-store';
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
    if (input.game === 'genshin') {
      const [payload, store] = await Promise.all([
        upstream(`https://enka.network/api/uid/${input.uid}/`),
        getEnkaStore(),
      ]);
      return normalizedGenshin(payload, input.uid, store);
    }
    if (!process.env.RIOT_API_KEY?.trim())
      throw new AppError('Se requiere configurar RIOT_API_KEY para consultar Valorant.', 503);
    const cluster =
      input.region === 'eu'
        ? 'europe'
        : input.region === 'ap' || input.region === 'kr'
          ? 'asia'
          : 'americas';
    const base = `https://${cluster}.api.riotgames.com/riot/account/v1`;
    const headers = { 'X-Riot-Token': process.env.RIOT_API_KEY };
    const account = record(
      await upstream(
        `${base}/accounts/by-riot-id/${encodeURIComponent(input.gameName)}/${encodeURIComponent(input.tagLine)}`,
        headers,
      ),
    );
    if (
      typeof account.puuid !== 'string' ||
      typeof account.gameName !== 'string' ||
      typeof account.tagLine !== 'string'
    )
      throw new AppError('Respuesta de Riot inválida.', 503);
    const shard = record(
      await upstream(
        `${base}/active-shards/by-game/val/by-puuid/${encodeURIComponent(account.puuid)}`,
        headers,
      ).catch(() => null),
    );
    return {
      game: 'valorant',
      gameName: account.gameName,
      tagLine: account.tagLine,
      puuid: account.puuid,
      region: input.region,
      activeShard: typeof shard.activeShard === 'string' ? shard.activeShard : null,
      verifiedAt: new Date().toISOString(),
    };
  },
  ['competitive-tracker-v2'],
  { revalidate: 60 },
);
export async function inspectCompetitive(input: unknown) {
  return inspectCached(competitiveInput(input));
}
