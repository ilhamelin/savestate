import 'server-only';
import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { AppError } from '@/lib/http';
import { ValidationError } from '@/domain/validation';
import { lolPage } from '@/domain/lol-pages';
import {
  LOL_PLATFORMS,
  accountCluster,
  lolPlatform,
  riotId,
  lolObject,
  dataDragonVersion,
  dataDragonAssets,
  lolAssetUrl,
  normalizeLolMatch,
  normalizeLolRank,
  normalizeLolMasteries,
  type LolPlatform,
  type LolCluster,
  type LolAssets,
  type LolProfileData,
  type LolRankEntry,
  type LolMatchSummary,
} from '@/domain/lol-tracker';

export class RiotRateLimitError extends AppError {
  readonly retryAfter: number;
  constructor(header: string | null) {
    const value = Number(header);
    const seconds = Number.isFinite(value) && value > 0 ? Math.min(600, Math.ceil(value)) : 60;
    super(`Riot alcanzó su límite de consultas. Vuelve a intentarlo en ${seconds} segundos.`, 429);
    this.retryAfter = seconds;
  }
}
async function riotRequest(host: LolPlatform | LolCluster, path: string): Promise<unknown> {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key)
    throw new AppError(
      'Rift Tracker requiere RIOT_API_KEY en el servidor. Configura la clave de Riot para cargar el historial.',
      503,
    );
  let response: Response;
  try {
    response = await fetch(`https://${host}.api.riotgames.com${path}`, {
      headers: { 'X-Riot-Token': key },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError('No se pudo conectar con Riot. Inténtalo de nuevo.', 503);
  }
  if (response.status === 429) throw new RiotRateLimitError(response.headers.get('retry-after'));
  if (response.status === 401 || response.status === 403)
    throw new AppError(
      'Riot rechazó la clave del servidor. Puede estar caducada o carecer de permisos.',
      503,
    );
  if (response.status === 404)
    throw new AppError('Riot no encontró el perfil o los datos en el servidor seleccionado.', 404);
  if (!response.ok)
    throw new AppError('Riot no está disponible en este momento. Inténtalo de nuevo.', 503);
  try {
    return await response.json();
  } catch {
    throw new AppError('Riot devolvió una respuesta no válida.', 503);
  }
}
async function dragonRequest(path: string): Promise<unknown> {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com${path}`, {
      next: { revalidate: 86400 },
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('Data Dragon unavailable');
    return await response.json();
  } catch {
    throw new AppError('No se pudieron cargar los recursos oficiales de Data Dragon.', 503);
  }
}
export function resolveRiotAccount(gameName: string, tagLine: string, platform: LolPlatform) {
  return riotRequest(
    accountCluster(platform),
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  );
}
export function fetchSummonerByPuuid(puuid: string, platform: LolPlatform) {
  return riotRequest(platform, `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`);
}
export function fetchRankedEntries(puuid: string, platform: LolPlatform) {
  return riotRequest(platform, `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`);
}
export function fetchChampionMasteries(puuid: string, platform: LolPlatform) {
  return riotRequest(
    platform,
    `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=3`,
  );
}
export function fetchRecentMatchIds(puuid: string, cluster: LolCluster, start = 0, count = 10) {
  const page = lolPage(start, count);
  return riotRequest(
    cluster,
    `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${page.start}&count=${page.count}`,
  );
}
export function fetchMatchDetails(matchId: string, cluster: LolCluster) {
  if (!/^[A-Z0-9]+_\d+$/.test(matchId))
    throw new AppError('Identificador de partida inválido.', 400);
  return riotRequest(cluster, `/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
}
async function loadProfile(
  gameName: string,
  tagLine: string,
  platform: LolPlatform,
  start: number,
  count: number,
): Promise<LolProfileData> {
  const [rawAccount, rawVersions] = await Promise.all([
    resolveRiotAccount(gameName, tagLine, platform),
    dragonRequest('/api/versions.json'),
  ]);
  const account = lolObject(rawAccount);
  if (typeof account.puuid !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(account.puuid))
    throw new Error('Invalid Riot account');
  if (!Array.isArray(rawVersions)) throw new Error('Invalid Data Dragon versions');
  const versions = rawVersions.filter((version): version is string => typeof version === 'string');
  const latestVersion = dataDragonVersion(versions);
  const puuid = account.puuid;
  const cluster = LOL_PLATFORMS[platform].cluster;
  const [summonerResult, rankResult, idsResult, masteryResult] = await Promise.allSettled([
    fetchSummonerByPuuid(puuid, platform),
    fetchRankedEntries(puuid, platform),
    fetchRecentMatchIds(puuid, cluster, start, count),
    fetchChampionMasteries(puuid, platform),
  ]);
  if (summonerResult.status === 'rejected') throw summonerResult.reason;
  const summoner = lolObject(summonerResult.value);
  if (
    typeof summoner.summonerLevel !== 'number' ||
    !Number.isFinite(summoner.summonerLevel) ||
    summoner.summonerLevel < 0 ||
    typeof summoner.profileIconId !== 'number' ||
    !Number.isSafeInteger(summoner.profileIconId) ||
    summoner.profileIconId < 0
  )
    throw new Error('Invalid Riot summoner');
  const profileIconUrl = lolAssetUrl(latestVersion, 'profileicon', `${summoner.profileIconId}.png`);
  if (!profileIconUrl) throw new Error('Invalid profile icon');
  const warnings: string[] = [];
  let soloQueue: LolRankEntry | null = null,
    flexQueue: LolRankEntry | null = null;
  let rankStatus: LolProfileData['rankStatus'] = 'available';
  try {
    if (rankResult.status === 'rejected') throw rankResult.reason;
    if (!Array.isArray(rankResult.value)) throw new Error('Invalid Riot ranks');
    for (const entry of rankResult.value) {
      const data = lolObject(entry);
      if (data.queueType === 'RANKED_SOLO_5x5') soloQueue = normalizeLolRank(data);
      if (data.queueType === 'RANKED_FLEX_SR') flexQueue = normalizeLolRank(data);
    }
  } catch {
    rankStatus = 'unavailable';
    warnings.push(
      'No se pudo consultar el rango. Esto no significa que el jugador esté sin clasificar.',
    );
  }
  let ids: string[] = [];
  let idsAvailable = false;
  if (
    idsResult.status === 'fulfilled' &&
    Array.isArray(idsResult.value) &&
    idsResult.value.every((id) => typeof id === 'string' && /^[A-Z0-9]+_\d+$/.test(id))
  ) {
    ids = (idsResult.value as string[]).slice(0, count);
    idsAvailable = true;
  } else warnings.push('El historial no pudo consultarse. Inténtalo de nuevo más tarde.');
  const assetsByVersion = new Map<string, Promise<LolAssets>>();
  const assetsFor = (version: string) => {
    if (!assetsByVersion.has(version))
      assetsByVersion.set(
        version,
        Promise.all([
          dragonRequest(`/cdn/${version}/data/es_MX/champion.json`),
          dragonRequest(`/cdn/${version}/data/es_MX/summoner.json`),
        ]).then(([champions, spells]) => dataDragonAssets(version, champions, spells)),
      );
    return assetsByVersion.get(version)!;
  };
  const matches: LolMatchSummary[] = [];
  let masteries: LolProfileData['masteries'] = [];
  let masteryStatus: LolProfileData['masteryStatus'] = 'available';
  try {
    if (masteryResult.status === 'rejected') throw masteryResult.reason;
    masteries = normalizeLolMasteries(masteryResult.value, await assetsFor(latestVersion));
  } catch {
    masteryStatus = 'unavailable';
    warnings.push(
      'No se pudieron consultar las maestrías. El resto del historial sigue disponible.',
    );
  }
  let failed = 0,
    excluded = 0;
  let scanned = 0;
  for (let offset = 0; offset < ids.length; offset += 3) {
    const results = await Promise.allSettled(
      ids.slice(offset, offset + 3).map(async (id) => {
        const raw = await fetchMatchDetails(id, cluster);
        const info = lolObject(lolObject(raw).info);
        if (info.queueId === 0 || info.gameType === 'CUSTOM_GAME') return null;
        const version = dataDragonVersion(
          versions,
          typeof info.gameVersion === 'string' ? info.gameVersion : undefined,
        );
        return normalizeLolMatch(raw, puuid, await assetsFor(version));
      }),
    );
    scanned += Math.min(3, ids.length - offset);
    let throttled = false;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value) matches.push(result.value);
        else excluded++;
      } else {
        failed++;
        if (result.reason instanceof RiotRateLimitError) throttled = true;
      }
    }
    if (throttled) {
      failed += Math.max(0, ids.length - offset - 3);
      warnings.push(
        'Riot limitó las consultas. Se muestran las partidas recuperadas; espera antes de volver a cargar.',
      );
      break;
    }
  }
  if (failed)
    warnings.push(`No se pudieron recuperar ${failed} de las ${ids.length} partidas solicitadas.`);
  if (excluded)
    warnings.push('Las partidas personalizadas no se muestran en búsquedas por Riot ID.');
  return {
    gameName: typeof account.gameName === 'string' ? account.gameName.slice(0, 32) : gameName,
    tagLine: typeof account.tagLine === 'string' ? account.tagLine.slice(0, 10) : tagLine,
    summonerLevel: Math.floor(summoner.summonerLevel),
    profileIconUrl,
    platform,
    soloQueue,
    flexQueue,
    rankStatus,
    masteries,
    masteryStatus,
    matches: matches.sort((a, b) => b.gameEndTimestamp - a.gameEndTimestamp),
    warnings,
    lastUpdated: new Date().toISOString(),
    nextStart: start + scanned,
    hasMore:
      start + scanned <= 10000 && (!idsAvailable || scanned < ids.length || ids.length === count),
  };
}
export async function inspectLol(
  inputRiotId: unknown,
  inputPlatform: unknown,
  inputStart: unknown = 0,
  inputCount: unknown = 10,
): Promise<LolProfileData> {
  const { gameName, tagLine } = riotId(inputRiotId);
  const platform = lolPlatform(inputPlatform);
  const { start, count } = lolPage(inputStart, inputCount);
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key)
    throw new AppError(
      'Rift Tracker requiere RIOT_API_KEY en el servidor. Configura la clave de Riot para cargar el historial.',
      503,
    );
  const fingerprint = createHash('sha256').update(key).digest('hex');
  try {
    return await unstable_cache(
      () => loadProfile(gameName, tagLine, platform, start, count),
      ['rift-tracker-v3', fingerprint, platform, gameName, tagLine, String(start), String(count)],
      { revalidate: 120 },
    )();
  } catch (error) {
    if (error instanceof AppError || error instanceof ValidationError) throw error;
    throw new AppError(
      'Riot o Data Dragon devolvieron datos incompletos. Inténtalo de nuevo.',
      503,
    );
  }
}
