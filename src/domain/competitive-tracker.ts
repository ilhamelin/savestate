import { object, text, ValidationError } from './validation.ts';
import { record, nonnegative } from './game-live-telemetry.ts';
export const VALORANT_REGIONS = ['latam', 'br', 'na', 'eu', 'ap', 'kr'] as const;
export type ValorantRegion = (typeof VALORANT_REGIONS)[number];
export type GenshinProfile = {
  game: 'genshin';
  uid: string;
  nickname: string;
  level: number;
  worldLevel: number;
  signature: string;
  achievements: number;
  abyss: string;
  fetterCount: number;
  showcase: { avatarId: number; level: number; element: string }[];
};
export type ValorantProfile = {
  game: 'valorant';
  gameName: string;
  tagLine: string;
  puuid: string;
  region: ValorantRegion;
  activeShard: string | null;
  verifiedAt: string;
};
export type CompetitiveProfile = GenshinProfile | ValorantProfile;
export function competitiveInput(input: unknown) {
  const data = object(input);
  if (data.game === 'genshin') {
    const uid = text(data.uid, 'UID', 10, 9);
    if (!/^\d{9,10}$/.test(uid)) throw new ValidationError('El UID debe tener 9 o 10 dígitos.');
    return { game: 'genshin' as const, uid };
  }
  if (data.game !== 'valorant') throw new ValidationError('Tracker no permitido.');
  const riotId = text(data.riotId, 'Riot ID', 80);
  const parts = riotId.split('#');
  if (
    parts.length !== 2 ||
    !parts[0]?.trim() ||
    !parts[1]?.trim() ||
    Array.from(riotId).some((char) => char.charCodeAt(0) < 32)
  )
    throw new ValidationError('Usa el formato Nombre#TAG.');
  if (!VALORANT_REGIONS.includes(data.region as ValorantRegion))
    throw new ValidationError('Región inválida.');
  return {
    game: 'valorant' as const,
    gameName: parts[0].trim(),
    tagLine: parts[1].trim(),
    region: data.region as ValorantRegion,
  };
}
export function normalizedGenshin(payload: unknown, uid: string): GenshinProfile {
  const data = record(payload),
    player = record(data.playerInfo);
  if (typeof player.nickname !== 'string')
    throw new ValidationError('Enka no encontró un perfil público para ese UID.');
  const full = Array.isArray(data.avatarInfoList) ? data.avatarInfoList.map(record) : [];
  const elements: Record<string, string> = {
    '70': 'Pyro 🔥',
    '71': 'Electro ⚡',
    '72': 'Hydro 💧',
    '73': 'Dendro 🌿',
    '74': 'Anemo 🌪️',
    '75': 'Cryo ❄️',
    '76': 'Geo 🪨',
  };
  const energyTypes: Record<string, string> = {
    '1': 'Pyro 🔥',
    '2': 'Hydro 💧',
    '3': 'Dendro 🌿',
    '4': 'Electro ⚡',
    '5': 'Cryo ❄️',
    '7': 'Anemo 🌪️',
    '8': 'Geo 🪨',
  };
  const showcase = (Array.isArray(player.showAvatarInfoList) ? player.showAvatarInfoList : [])
    .slice(0, 16)
    .flatMap((raw) => {
      const item = record(raw);
      if (!Number.isSafeInteger(item.avatarId) || Number(item.avatarId) <= 0) return [];
      const detail = full.find((avatar) => avatar.avatarId === item.avatarId);
      const energy = record(detail?.fightPropMap);
      const element = Object.keys(elements).find((key) => Number(energy[key]) > 0);
      return [
        {
          avatarId: Number(item.avatarId),
          level: nonnegative(item.level) ?? 0,
          element: element
            ? elements[element]!
            : (energyTypes[String(item.energyType)] ?? 'Elemento no disponible'),
        },
      ];
    });
  return {
    game: 'genshin',
    uid,
    nickname: player.nickname.slice(0, 100),
    level: nonnegative(player.level) ?? 0,
    worldLevel: nonnegative(player.worldLevel) ?? 0,
    signature: String(player.signature ?? '').slice(0, 400),
    achievements: nonnegative(player.finishAchievementNum) ?? 0,
    abyss: player.towerFloorIndex
      ? `${player.towerFloorIndex}-${player.towerLevelIndex ?? 1}`
      : 'Sin registro',
    fetterCount: nonnegative(player.fetterCount) ?? 0,
    showcase,
  };
}
