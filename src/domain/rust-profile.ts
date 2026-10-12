import { record, nonnegative } from './game-live-telemetry.ts';
import { ValidationError } from './validation.ts';
export type RustProfile = {
  game: 'rust';
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  hoursPlayed: number | null;
  recentHours2Weeks: number | null;
  statsPublic: boolean;
  achievementsUnlocked: number | null;
  combat: {
    killsPvp: number;
    deaths: number;
    kdRatio: number;
    headshots: number;
    bulletsFired: number;
    bulletsHitPlayer: number;
    accuracyPercent: number;
    scientistsKilled: number;
    animalsKilled: number;
  } | null;
  survival: {
    woodHarvested: number;
    stoneHarvested: number;
    metalOre: number;
    sulfurOre: number;
    rocketsFired: number;
    blueprintsStudied: number;
    woundedHealed: number;
  } | null;
};
export function steamAvatar(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        'avatars.steamstatic.com',
        'avatars.akamai.steamstatic.com',
        'steamcdn-a.akamaihd.net',
      ].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function normalizedRust(
  summaryPayload: unknown,
  ownedPayload: unknown,
  statsPayload: unknown,
  steamId: string,
  achievementsPayload: unknown = null,
): RustProfile {
  const players = record(record(summaryPayload).response).players;
  const player = Array.isArray(players)
    ? players.map(record).find((p) => p.steamid === steamId)
    : null;
  if (!player || typeof player.personaname !== 'string')
    throw new ValidationError('Steam no encontró ese perfil público.');
  const games = record(record(ownedPayload).response).games;
  const rust = Array.isArray(games) ? games.map(record).find((g) => g.appid === 252490) : null;
  const hours = (value: unknown) => {
    const n = nonnegative(value);
    return n === null ? null : Math.round((n / 60) * 10) / 10;
  };
  const playerstats = record(record(statsPayload).playerstats);
  const matchesAccount = !playerstats.steamID || String(playerstats.steamID) === steamId;
  const statsPublic = matchesAccount && Array.isArray(playerstats.stats);
  const stats = new Map<string, number>();
  if (statsPublic)
    for (const raw of playerstats.stats as unknown[]) {
      const row = record(raw);
      if (typeof row.name === 'string' && nonnegative(row.value) !== null)
        stats.set(row.name, nonnegative(row.value)!);
    }
  const get = (name: string) => stats.get(name) ?? 0;
  const killsPvp = get('kill_player'),
    deaths = get('deaths'),
    bulletsFired = get('bullet_fired'),
    bulletsHitPlayer = get('bullet_hit_player');
  const achievements = record(record(achievementsPayload).playerstats);
  const achievementsMatch = !achievements.steamID || String(achievements.steamID) === steamId;
  const achievementList =
    achievements.success !== false && achievementsMatch && Array.isArray(achievements.achievements)
      ? achievements.achievements
      : matchesAccount && Array.isArray(playerstats.achievements)
        ? playerstats.achievements
        : null;
  return {
    game: 'rust',
    steamId,
    personaName: player.personaname.slice(0, 100),
    avatarUrl: steamAvatar(player.avatarfull),
    profileUrl: `https://steamcommunity.com/profiles/${steamId}/`,
    hoursPlayed: rust ? hours(rust.playtime_forever) : null,
    recentHours2Weeks: rust ? hours(rust.playtime_2weeks ?? 0) : null,
    statsPublic,
    achievementsUnlocked: achievementList
      ? achievementList.filter((raw) => {
          const row = record(raw);
          return row.achieved === 1 || (row.achieved === undefined && typeof row.name === 'string');
        }).length
      : null,
    combat: statsPublic
      ? {
          killsPvp,
          deaths,
          kdRatio: Number((killsPvp / Math.max(1, deaths)).toFixed(2)),
          headshots: get('headshot'),
          bulletsFired,
          bulletsHitPlayer,
          accuracyPercent:
            bulletsFired > 0
              ? Math.min(100, Number(((bulletsHitPlayer / bulletsFired) * 100).toFixed(1)))
              : 0,
          scientistsKilled: get('kill_scientist'),
          animalsKilled: [
            'kill_bear',
            'kill_boar',
            'kill_wolf',
            'kill_stag',
            'kill_chicken',
          ].reduce((total, key) => total + get(key), 0),
        }
      : null,
    survival: statsPublic
      ? {
          woodHarvested: Math.round(get('harvested_wood')),
          stoneHarvested: Math.round(get('harvested_stones')),
          metalOre: Math.round(get('acquired_metal.ore')),
          sulfurOre: Math.round(get('acquired_sulfur.ore')),
          rocketsFired: Math.round(get('rockets_fired')),
          blueprintsStudied: Math.round(get('blueprint_studied')),
          woundedHealed: Math.round(get('wounded_healed')),
        }
      : null,
  };
}
