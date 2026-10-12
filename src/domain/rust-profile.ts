import { record, nonnegative } from './game-live-telemetry.ts';
import { ValidationError } from './validation.ts';
export type RustBreakdownItem = {
  id: string;
  label: string;
  icon: string;
  count: number;
  percent: number;
  color: string;
};
export function buildBreakdown(entries: Array<[string, string, string, number, string]>): {
  total: number;
  items: RustBreakdownItem[];
} {
  const total = entries.reduce((sum, entry) => sum + entry[3], 0);
  return {
    total,
    items: entries.map(([id, label, icon, count, color]) => ({
      id,
      label,
      icon,
      count,
      color,
      percent: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
    })),
  };
}
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
    totalKills: number;
    deaths: number;
    kdRatio: number;
    headshots: number;
    headshotRatePercent: number;
    bulletsFired: number;
    bulletsHitPlayer: number;
    accuracyPercent: number;
    scientistsKilled: number;
    animalsKilled: number;
  } | null;
  breakdowns: {
    totalBulletHits: number;
    bulletHits: RustBreakdownItem[];
    totalKills: number;
    kills: RustBreakdownItem[];
    totalResources: number;
    resources: RustBreakdownItem[];
  } | null;
  modules: {
    building: { blocksPlaced: number; blocksUpgraded: number; blueprintsStudied: number };
    horse: { kilometersRidden: number; milesRidden: number; woundedHealed: number };
    melee: { strikes: number; throws: number; rocketsFired: number };
    consumption: { calories: number; water: number; woundedTimes: number };
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
  const scientists = get('kill_scientist'),
    bears = get('kill_bear'),
    boars = get('kill_boar'),
    deer = get('kill_stag'),
    wolves = get('kill_wolf'),
    chickens = get('kill_chicken'),
    horses = get('kill_horse'),
    dwellers = get('kill_tunneldweller');
  const animalsKilled = bears + boars + deer + wolves + chickens + horses;
  const pveKills = scientists + animalsKilled + dwellers;
  const rawKillPlayer = get('kill_player');
  const killsPvp = rawKillPlayer > pveKills ? rawKillPlayer - pveKills : rawKillPlayer;
  const totalKills = killsPvp + pveKills;
  const deaths = get('deaths'),
    bulletsFired = get('bullet_fired'),
    bulletsHitPlayer = get('bullet_hit_player');
  const bulletHits = buildBreakdown([
    ['players', 'Jugadores', '👤', bulletsHitPlayer, '#ff5500'],
    [
      'corpses',
      'Jugadores abatidos',
      '💀',
      get('bullet_hit_playercorpse') + get('bullet_hit_corpse'),
      '#f59e0b',
    ],
    ['buildings', 'Estructuras', '🏢', get('bullet_hit_building'), '#00f0ff'],
    ['bears', 'Osos', '🐻', get('bullet_hit_bear'), '#a855f7'],
    ['boars', 'Jabalíes', '🐗', get('bullet_hit_boar'), '#22c55e'],
    ['wolves', 'Lobos', '🐺', get('bullet_hit_wolf'), '#38bdf8'],
    ['deer', 'Ciervos', '🦌', get('bullet_hit_stag'), '#ec4899'],
    ['horses', 'Caballos', '🐎', get('bullet_hit_horse'), '#eab308'],
    ['signs', 'Señales', '🪧', get('bullet_hit_sign'), '#64748b'],
    ['other', 'Otros', '📦', get('bullet_hit_entity'), '#94a3b8'],
  ]);
  const kills = buildBreakdown([
    ['players', 'Jugadores (PvP)', '👤', killsPvp, '#ff5500'],
    ['scientists', 'Científicos', '🧪', scientists, '#00f0ff'],
    ['boars', 'Jabalíes', '🐗', boars, '#22c55e'],
    ['bears', 'Osos', '🐻', bears, '#a855f7'],
    ['deer', 'Ciervos', '🦌', deer, '#f59e0b'],
    ['wolves', 'Lobos', '🐺', wolves, '#38bdf8'],
    ['chickens', 'Pollos', '🐔', chickens, '#ec4899'],
    ['dwellers', 'Moradores', '🚇', dwellers, '#eab308'],
    ['horses', 'Caballos', '🐎', horses, '#64748b'],
  ]);
  const resources = buildBreakdown([
    ['metal', 'Mineral de Metal', '⚙️', Math.round(get('acquired_metal.ore')), '#00f0ff'],
    ['scrap', 'Chatarra (Scrap)', '🔩', Math.round(get('acquired_scrap')), '#f59e0b'],
    ['fuel', 'Combustible Bajo Grado', '⛽', Math.round(get('acquired_lowgradefuel')), '#ff5500'],
    ['wood', 'Madera', '🪵', Math.round(get('harvested_wood')), '#22c55e'],
    ['stone', 'Piedra', '🪨', Math.round(get('harvested_stones')), '#94a3b8'],
    ['sulfur', 'Mineral de Azufre', '🧨', Math.round(get('acquired_sulfur.ore')), '#eab308'],
    ['cloth', 'Tela', '👕', Math.round(get('harvested_cloth')), '#a855f7'],
    ['leather', 'Cuero', '🧥', Math.round(get('harvested_leather')), '#ec4899'],
  ]);
  const km = Math.round(get('horse_distance_ridden_km') || get('horse_distance_ridden') / 1000);
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
          totalKills,
          deaths,
          kdRatio: Number((killsPvp / Math.max(1, deaths)).toFixed(2)),
          headshots: get('headshot'),
          headshotRatePercent:
            bulletsHitPlayer > 0
              ? Math.min(100, Number(((get('headshot') / bulletsHitPlayer) * 100).toFixed(2)))
              : 0,
          bulletsFired,
          bulletsHitPlayer,
          accuracyPercent:
            bulletsFired > 0
              ? Math.min(100, Number(((bulletsHitPlayer / bulletsFired) * 100).toFixed(2)))
              : 0,
          scientistsKilled: scientists,
          animalsKilled,
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
    breakdowns: statsPublic
      ? {
          totalBulletHits: bulletHits.total,
          bulletHits: bulletHits.items,
          totalKills: kills.total,
          kills: kills.items,
          totalResources: resources.total,
          resources: resources.items,
        }
      : null,
    modules: statsPublic
      ? {
          building: {
            blocksPlaced: Math.round(get('placed_blocks')),
            blocksUpgraded: Math.round(get('upgraded_blocks')),
            blueprintsStudied: Math.round(get('blueprint_studied')),
          },
          horse: {
            kilometersRidden: km,
            milesRidden: Number((km * 0.621371).toFixed(2)),
            woundedHealed: Math.round(get('wounded_healed')),
          },
          melee: {
            strikes: Math.round(get('melee_strikes')),
            throws: Math.round(get('melee_throws')),
            rocketsFired: Math.round(get('rockets_fired')),
          },
          consumption: {
            calories: Math.round(get('calories_consumed')),
            water: Math.round(get('water_consumed')),
            woundedTimes: Math.round(get('wounded')),
          },
        }
      : null,
  };
}
