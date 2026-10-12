import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  VALORANT_REGIONS,
  type ValorantRegion,
  type ValorantProfile,
} from '@/domain/competitive-tracker';
import { record, nonnegative } from '@/domain/game-live-telemetry';
import {
  normalizedHenrik,
  normalizedLeaderboard,
  optionalText,
  valorantImage,
} from '@/domain/valorant-profile';
import { AppError } from '@/lib/http';
async function json(url: string, headers: Record<string, string> = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    throw new AppError('El proveedor no respondió a tiempo.', 503);
  }
  if (!response.ok)
    throw new AppError(
      response.status === 401 || response.status === 403
        ? 'El proveedor rechazó la clave configurada o sus permisos. Revisa su vigencia en el servidor.'
        : response.status === 429
          ? 'El proveedor está ocupado; inténtalo más tarde.'
          : 'No se pudo consultar Valorant. Verifica el Riot ID y las credenciales del servidor.',
      response.status === 404 ? 404 : response.status === 429 ? 429 : 503,
    );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AppError('Respuesta del proveedor inválida.', 503);
  }
}
const decorativeCard = unstable_cache(
  async () => {
    const payload = record(await json('https://valorant-api.com/v1/playercards?language=es-MX'));
    const cards = Array.isArray(payload.data) ? payload.data.map(record) : [];
    const card =
      cards.find((item) => String(item.displayName).toUpperCase() === 'VALORANT') ?? cards[0];
    return valorantImage(card?.wideArt);
  },
  ['valorant-decorative-card-v1'],
  { revalidate: 86400 },
);
function validIdentity(
  value: Record<string, unknown>,
  input: { gameName: string; tagLine: string },
) {
  const name = value.gameName ?? value.name,
    tag = value.tagLine ?? value.tag;
  return typeof value.puuid === 'string' &&
    value.puuid.length > 0 &&
    typeof name === 'string' &&
    typeof tag === 'string' &&
    name.toLowerCase() === input.gameName.toLowerCase() &&
    tag.toLowerCase() === input.tagLine.toLowerCase()
    ? { puuid: value.puuid, gameName: name, tagLine: tag }
    : null;
}
export async function inspectValorant(input: {
  gameName: string;
  tagLine: string;
  region: ValorantRegion;
}): Promise<ValorantProfile> {
  const riotKey = process.env.RIOT_API_KEY?.trim(),
    henrikKey = process.env.HENRIK_API_KEY?.trim();
  if (!riotKey && !henrikKey)
    throw new AppError('Configura RIOT_API_KEY o HENRIK_API_KEY para consultar Valorant.', 503);
  const cluster =
    input.region === 'eu' ? 'europe' : ['ap', 'kr'].includes(input.region) ? 'asia' : 'americas';
  const accountBase = `https://${cluster}.api.riotgames.com/riot/account/v1`;
  const idPath = `${encodeURIComponent(input.gameName)}/${encodeURIComponent(input.tagLine)}`;
  const riotHeaders: Record<string, string> = riotKey ? { 'X-Riot-Token': riotKey } : {};
  const henrikHeaders: Record<string, string> = henrikKey ? { Authorization: henrikKey } : {};
  const results = await Promise.allSettled([
    riotKey
      ? json(`${accountBase}/accounts/by-riot-id/${idPath}`, riotHeaders)
      : Promise.resolve(null),
    henrikKey
      ? json(`https://api.henrikdev.xyz/valorant/v1/account/${idPath}`, henrikHeaders)
      : Promise.resolve(null),
    henrikKey
      ? json(`https://api.henrikdev.xyz/valorant/v2/mmr/${input.region}/${idPath}`, henrikHeaders)
      : Promise.resolve(null),
    henrikKey
      ? json(
          `https://api.henrikdev.xyz/valorant/v3/matches/${input.region}/${idPath}?size=5`,
          henrikHeaders,
        )
      : Promise.resolve(null),
  ]);
  const values = results.map((result) => (result.status === 'fulfilled' ? result.value : null));
  const riotIdentity = validIdentity(record(values[0]), input);
  const henrikAccountIdentity = validIdentity(record(record(values[1]).data), input);
  const henrikMmrIdentity = validIdentity(record(record(values[2]).data), input);
  const henrikIdentity = riotIdentity
    ? ([henrikAccountIdentity, henrikMmrIdentity].find(
        (value) => value?.puuid === riotIdentity.puuid,
      ) ?? null)
    : (henrikAccountIdentity ?? henrikMmrIdentity);
  const identity = riotIdentity ?? henrikIdentity;
  if (!identity) {
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    throw new AppError('El proveedor no encontró esta cuenta.', 404);
  }
  const henrikValid = Boolean(henrikIdentity && henrikIdentity.puuid === identity.puuid);
  const accountIdentity = validIdentity(record(record(values[1]).data), input);
  const mmrData = record(record(values[2]).data);
  const mmrMatchesIdentity = !mmrData.puuid || mmrData.puuid === identity.puuid;
  const henrik = normalizedHenrik(
    henrikValid && accountIdentity?.puuid === identity.puuid ? values[1] : null,
    henrikValid && mmrMatchesIdentity ? values[2] : null,
    henrikValid ? values[3] : null,
    identity,
  );
  const shard = riotKey
    ? record(
        await json(
          `${accountBase}/active-shards/by-game/val/by-puuid/${encodeURIComponent(identity.puuid)}`,
          riotHeaders,
        ).catch(() => null),
      )
    : {};
  const activeShard = VALORANT_REGIONS.includes(shard.activeShard as ValorantRegion)
    ? (shard.activeShard as ValorantRegion)
    : null;
  const region = activeShard ?? input.region;
  const encodedPuuid = encodeURIComponent(identity.puuid);
  const cross = async () => {
    if (!riotKey) return null;
    const platforms: Record<ValorantRegion, string[]> = {
      latam: ['la2', 'la1'],
      br: ['br1'],
      na: ['na1'],
      eu: ['euw1'],
      kr: ['kr'],
      ap: ['jp1'],
    };
    for (const platform of platforms[region]) {
      const [summonerRaw, tftRaw] = await Promise.all([
        json(
          `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodedPuuid}`,
          riotHeaders,
        ).catch(() => null),
        json(
          `https://${platform}.api.riotgames.com/tft/league/v1/by-puuid/${encodedPuuid}`,
          riotHeaders,
        ).catch(() => null),
      ]);
      const summoner = record(summonerRaw),
        tft = Array.isArray(tftRaw)
          ? tftRaw.map(record).find((entry) => entry.queueType === 'RANKED_TFT')
          : null;
      if (nonnegative(summoner.summonerLevel) === null && !tft) continue;
      const icon = nonnegative(summoner.profileIconId);
      return {
        summonerLevel: nonnegative(summoner.summonerLevel),
        profileIconUrl:
          icon !== null && Number.isInteger(icon)
            ? `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${icon}.png`
            : null,
        tftTier:
          tft && optionalText(tft.tier)
            ? `${optionalText(tft.tier)} ${optionalText(tft.rank) ?? ''}`.trim()
            : null,
        tftWins: nonnegative(tft?.wins),
        tftLosses: nonnegative(tft?.losses),
      };
    }
    return null;
  };
  const leaderboard = async () => {
    if (!riotKey) return { activeActName: null, regionalLeaderboard: [], own: null };
    const content = record(
      await json(
        `https://${region}.api.riotgames.com/val/content/v1/contents?locale=es-MX`,
        riotHeaders,
      ).catch(() => null),
    );
    const act = (Array.isArray(content.acts) ? content.acts.map(record) : []).find(
      (item) => item.isActive === true && item.type === 'act',
    );
    if (typeof act?.id !== 'string')
      return { activeActName: null, regionalLeaderboard: [], own: null };
    const ranked = record(
      await json(
        `https://${region}.api.riotgames.com/val/ranked/v1/leaderboards/by-act/${encodeURIComponent(act.id)}?size=10&startIndex=0`,
        riotHeaders,
      ).catch(() => null),
    );
    const players = Array.isArray(ranked.players) ? ranked.players.map(record) : [];
    return {
      activeActName: optionalText(act.name),
      regionalLeaderboard: normalizedLeaderboard(ranked),
      own: players.find((player) => player.puuid === identity.puuid) ?? null,
    };
  };
  const [riotCrossProfile, regional, banner] = await Promise.all([
    cross(),
    leaderboard(),
    henrikValid ? Promise.resolve(null) : decorativeCard().catch(() => null),
  ]);
  return {
    game: 'valorant',
    ...identity,
    region: input.region,
    activeShard,
    verifiedAt: new Date().toISOString(),
    ...henrik,
    cardWideUrl: henrik.cardWideUrl ?? banner,
    currentRank:
      henrik.currentRank ??
      (nonnegative(regional.own?.leaderboardRank)
        ? `Clasificación regional #${regional.own?.leaderboardRank}`
        : null),
    activeActName: regional.activeActName,
    regionalLeaderboard: regional.regionalLeaderboard,
    riotCrossProfile,
    dataSource: henrikValid ? 'henrik_full' : 'riot_official',
  };
}
