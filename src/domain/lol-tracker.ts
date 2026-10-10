import { ValidationError } from './validation.ts';

export type LolCluster = 'americas' | 'europe' | 'asia' | 'sea';
export const LOL_PLATFORMS = {
  la2: { name: 'LAS · Latinoamérica Sur', cluster: 'americas' },
  la1: { name: 'LAN · Latinoamérica Norte', cluster: 'americas' },
  na1: { name: 'NA · Norteamérica', cluster: 'americas' },
  br1: { name: 'BR · Brasil', cluster: 'americas' },
  euw1: { name: 'EUW · Europa Oeste', cluster: 'europe' },
  eun1: { name: 'EUNE · Europa Nórdica y Este', cluster: 'europe' },
  tr1: { name: 'TR · Turquía', cluster: 'europe' },
  ru: { name: 'RU · Rusia', cluster: 'europe' },
  kr: { name: 'KR · Corea', cluster: 'asia' },
  jp1: { name: 'JP · Japón', cluster: 'asia' },
  oc1: { name: 'OCE · Oceanía', cluster: 'sea' },
} as const;
export type LolPlatform = keyof typeof LOL_PLATFORMS;
export function lolPlatform(input: unknown): LolPlatform {
  if (typeof input !== 'string' || !Object.hasOwn(LOL_PLATFORMS, input.trim().toLowerCase()))
    throw new ValidationError('Selecciona un servidor de LoL válido.');
  return input.trim().toLowerCase() as LolPlatform;
}
export function riotId(input: unknown) {
  if (typeof input !== 'string' || input.length > 100 || /[\p{Cc}\p{Cf}]/u.test(input))
    throw new ValidationError('Usa el formato Nombre#TAG.');
  const parts = input.trim().normalize('NFC').split('#');
  const gameName = parts[0]?.trim() ?? '',
    tagLine = parts[1]?.trim() ?? '';
  if (
    parts.length !== 2 ||
    [...gameName].length < 3 ||
    [...gameName].length > 16 ||
    /[\p{Cc}\p{Cf}]/u.test(gameName) ||
    !/^[\p{L}\p{N}]{3,5}$/u.test(tagLine)
  )
    throw new ValidationError(
      'Usa Nombre#TAG: nombre de 3–16 caracteres y etiqueta de 3–5 letras o números.',
    );
  return { gameName, tagLine };
}
export function accountCluster(platform: LolPlatform): Exclude<LolCluster, 'sea'> {
  const cluster = LOL_PLATFORMS[platform].cluster;
  return cluster === 'sea' ? 'asia' : cluster;
}
export interface LolRankEntry {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winrate: number;
}
export interface LolMatchParticipant {
  puuid: string;
  riotId: string;
  teamId: number;
  championName: string;
  championIcon: string | null;
  championLevel: number;
  largestMultiKill: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  kdaRatio: number;
  cs: number;
  csPerMin: number;
  items: (string | null)[];
  itemIds: number[];
  trinket: string | null;
  trinketId: number;
  spells: (string | null)[];
  spellNames: string[];
  totalDamage: number;
  gold: number;
  win: boolean;
  role: string;
}
export interface LolMatchSummary {
  matchId: string;
  gameMode: string;
  queueId: number;
  gameDurationMinutes: number;
  gameEndTimestamp: number;
  player: LolMatchParticipant;
  team100: LolMatchParticipant[];
  team200: LolMatchParticipant[];
  participants: LolMatchParticipant[];
}
export interface LolProfileData {
  gameName: string;
  tagLine: string;
  summonerLevel: number;
  profileIconUrl: string;
  platform: LolPlatform;
  soloQueue: LolRankEntry | null;
  flexQueue: LolRankEntry | null;
  rankStatus: 'available' | 'unavailable';
  masteries: LolChampionMastery[];
  masteryStatus: 'available' | 'unavailable';
  matches: LolMatchSummary[];
  warnings: string[];
  lastUpdated: string;
  nextStart: number;
  hasMore: boolean;
}
export interface LolChampionMastery {
  championId: number;
  championName: string;
  championIcon: string | null;
  level: number;
  points: number;
}
export function normalizeLolMasteries(input: unknown, assets: LolAssets): LolChampionMastery[] {
  if (!Array.isArray(input)) throw new Error('Invalid Riot masteries');
  const seen = new Set<number>();
  return input
    .map((entry): LolChampionMastery => {
      const data = lolObject(entry);
      const championId = requiredInteger(data.championId);
      if (championId <= 0 || seen.has(championId)) throw new Error('Invalid mastery champion');
      seen.add(championId);
      const champion = assets.champions[String(championId)];
      return {
        championId,
        championName: champion?.name ?? `Campeón ${championId}`,
        championIcon: champion ? lolAssetUrl(assets.version, 'champion', champion.file) : null,
        level: requiredInteger(data.championLevel),
        points: requiredInteger(data.championPoints),
      };
    })
    .sort((a, b) => b.points - a.points || a.championId - b.championId)
    .slice(0, 3);
}
export interface LolAssets {
  version: string;
  champions: Record<string, { name: string; file: string }>;
  spells: Record<string, { name: string; file: string }>;
}
export const LOL_TIERS: Record<string, string> = {
  IRON: 'Hierro',
  BRONZE: 'Bronce',
  SILVER: 'Plata',
  GOLD: 'Oro',
  PLATINUM: 'Platino',
  EMERALD: 'Esmeralda',
  DIAMOND: 'Diamante',
  MASTER: 'Maestro',
  GRANDMASTER: 'Gran Maestro',
  CHALLENGER: 'Retador',
};
export function lolQueueName(queue: number, mode: string) {
  const labels: Record<number, string> = {
    420: 'Solo/Dúo',
    440: 'Flexible',
    450: 'ARAM',
    400: 'Normal · Reclutamiento',
    430: 'Normal',
    490: 'Normal · Partida rápida',
    1700: 'Arena',
    1710: 'Arena',
  };
  return labels[queue] ?? `${mode || 'LoL'} · Cola ${queue}`;
}
export function dataDragonVersion(versions: string[], gameVersion?: string): string {
  const valid = versions.filter((value) => /^\d+\.\d+\.\d+$/.test(value));
  const patch = gameVersion?.match(/^(\d+\.\d+)\./)?.[1];
  const version = (patch && valid.find((value) => value.startsWith(patch + '.'))) || valid[0];
  if (!version) throw new Error('Data Dragon version unavailable');
  return version;
}
export function lolAssetUrl(
  version: string,
  kind: 'champion' | 'item' | 'spell' | 'profileicon',
  file: string,
) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[A-Za-z0-9_]+\.png$/.test(file)) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/${kind}/${file}`;
}
export function lolObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid Riot response');
  return input as Record<string, unknown>;
}
function number(input: unknown, fallback = 0) {
  return typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : fallback;
}
function integer(input: unknown) {
  return Math.floor(number(input));
}
function requiredInteger(input: unknown, signed = false) {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || (!signed && input < 0))
    throw new Error('Missing or invalid Riot statistic');
  return input;
}
function string(input: unknown, max = 100) {
  return typeof input === 'string' ? input.slice(0, max) : '';
}
export function normalizeLolRank(input: unknown): LolRankEntry {
  const data = lolObject(input);
  const tier = string(data.tier, 20);
  if (!Object.hasOwn(LOL_TIERS, tier) || !['I', 'II', 'III', 'IV'].includes(string(data.rank)))
    throw new Error('Invalid Riot rank');
  const wins = requiredInteger(data.wins),
    losses = requiredInteger(data.losses);
  return {
    tier,
    rank: string(data.rank, 4),
    leaguePoints: requiredInteger(data.leaguePoints, true),
    wins,
    losses,
    winrate: wins + losses ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
  };
}
export function dataDragonAssets(
  version: string,
  championsInput: unknown,
  spellsInput: unknown,
): LolAssets {
  const catalog = (input: unknown) => {
    const entries = lolObject(lolObject(input).data);
    const result: Record<string, { name: string; file: string }> = {};
    for (const entry of Object.values(entries)) {
      const data = lolObject(entry),
        image = lolObject(data.image);
      const key = string(data.key, 12),
        file = string(image.full, 100);
      if (/^\d+$/.test(key) && /^[A-Za-z0-9_]+\.png$/.test(file))
        result[key] = { name: string(data.name), file };
    }
    return result;
  };
  return { version, champions: catalog(championsInput), spells: catalog(spellsInput) };
}
export function normalizeLolMatch(
  input: unknown,
  puuid: string,
  assets: LolAssets,
): LolMatchSummary | null {
  const match = lolObject(input),
    info = lolObject(match.info),
    metadata = lolObject(match.metadata);
  const queueId = integer(info.queueId);
  // Custom games require explicit opt-in / RSO; never expose them in an ID-only lookup.
  if (queueId === 0 || info.gameType === 'CUSTOM_GAME') return null;
  if (!Array.isArray(info.participants) || info.participants.length > 32)
    throw new Error('Invalid Riot participants');
  const patch = string(info.gameVersion).match(/^(\d+)\.(\d+)/);
  const oldDuration =
    patch && (Number(patch[1]) < 11 || (Number(patch[1]) === 11 && Number(patch[2]) < 20));
  const seconds = number(info.gameDuration) / (oldDuration ? 1000 : 1);
  if (!seconds || seconds > 86400) throw new Error('Invalid Riot duration');
  const minutes = seconds / 60;
  const participants = info.participants.map((input): LolMatchParticipant => {
    const data = lolObject(input);
    const champion = assets.champions[String(integer(data.championId))];
    const kills = requiredInteger(data.kills),
      deaths = requiredInteger(data.deaths),
      assists = requiredInteger(data.assists);
    const cs =
      requiredInteger(data.totalMinionsKilled) + requiredInteger(data.neutralMinionsKilled);
    const items = Array.from({ length: 6 }, (_, index) => integer(data[`item${index}`]));
    const trinketId = integer(data.item6);
    const spells = [integer(data.summoner1Id), integer(data.summoner2Id)].map(
      (id) => assets.spells[String(id)],
    );
    const name = string(data.riotIdGameName),
      tag = string(data.riotIdTagline, 20);
    const kdaRatio = Math.round(((kills + assists) / Math.max(1, deaths)) * 100) / 100;
    if (typeof data.win !== 'boolean') throw new Error('Invalid Riot outcome');
    return {
      puuid: string(data.puuid, 128),
      riotId: name ? `${name}${tag ? '#' + tag : ''}` : string(data.summonerName) || 'Jugador',
      teamId: integer(data.teamId),
      championName: champion?.name || string(data.championName) || 'Campeón',
      championIcon: champion ? lolAssetUrl(assets.version, 'champion', champion.file) : null,
      championLevel: integer(data.champLevel),
      largestMultiKill: integer(data.largestMultiKill),
      kills,
      deaths,
      assists,
      kda: deaths === 0 ? 'Perfecto' : kdaRatio.toFixed(2),
      kdaRatio,
      cs,
      csPerMin: Math.round((cs / minutes) * 10) / 10,
      itemIds: items,
      items: items.map((id) => (id ? lolAssetUrl(assets.version, 'item', `${id}.png`) : null)),
      trinketId,
      trinket: trinketId ? lolAssetUrl(assets.version, 'item', `${trinketId}.png`) : null,
      spells: spells.map((spell) =>
        spell ? lolAssetUrl(assets.version, 'spell', spell.file) : null,
      ),
      spellNames: spells.map((spell) => spell?.name || 'Hechizo no disponible'),
      totalDamage: requiredInteger(data.totalDamageDealtToChampions),
      gold: requiredInteger(data.goldEarned),
      win: data.win,
      role: string(data.teamPosition, 24),
    };
  });
  const player = participants.find((participant) => participant.puuid === puuid);
  if (!player) throw new Error('Riot player missing from match');
  const matchId = string(metadata.matchId, 40);
  if (!/^[A-Z0-9]+_\d+$/.test(matchId)) throw new Error('Invalid Riot match ID');
  const start = number(info.gameStartTimestamp);
  const end = number(info.gameEndTimestamp) || (start > 0 ? start + seconds * 1000 : 0);
  if (!Number.isFinite(end) || end <= 0 || end > 8640000000000000)
    throw new Error('Invalid Riot timestamp');
  return {
    matchId,
    gameMode: lolQueueName(queueId, string(info.gameMode)),
    queueId,
    gameDurationMinutes: minutes,
    gameEndTimestamp: end,
    player,
    participants,
    team100: participants.filter((p) => p.teamId === 100),
    team200: participants.filter((p) => p.teamId === 200),
  };
}
