import { record, nonnegative } from './game-live-telemetry.ts';
import { ValidationError } from './validation.ts';
export type HsrEnkaStore = {
  avatars: Record<string, unknown>;
  weapons: Record<string, unknown>;
  locEs: Record<string, unknown>;
  locEn: Record<string, unknown>;
};
export type HsrShowcaseCharacter = {
  avatarId: number;
  name: string;
  iconUrl: string | null;
  rarity: 4 | 5;
  level: number;
  eidolons: number;
  element: string;
  elementCode: 'pyro' | 'cryo' | 'electro' | 'anemo' | 'geo' | 'neutral';
  path: string;
  stats: {
    hp: number;
    atk: number;
    def: number;
    speed: number;
    critRate: number;
    critDmg: number;
  } | null;
  lightCone: {
    name: string;
    iconUrl: string | null;
    level: number;
    superimposition: number;
    rarity: number;
  } | null;
  relicsCount: number;
};
export type HsrProfile = {
  game: 'hsr';
  uid: string;
  nickname: string;
  level: number;
  worldLevel: number;
  signature: string;
  platform: string;
  achievements: number;
  avatarCount: number;
  lightConeCount: number;
  showcase: HsrShowcaseCharacter[];
};
const EMPTY_STORE: HsrEnkaStore = { avatars: {}, weapons: {}, locEs: {}, locEn: {} };
const elements: Record<string, [string, HsrShowcaseCharacter['elementCode']]> = {
  Fire: ['Fuego 🔥', 'pyro'],
  Ice: ['Hielo ❄️', 'cryo'],
  Thunder: ['Rayo ⚡', 'electro'],
  Wind: ['Viento 🌪️', 'anemo'],
  Quantum: ['Cuántico 🌌', 'electro'],
  Imaginary: ['Imaginario ✨', 'geo'],
  Physical: ['Físico ⚔️', 'neutral'],
};
const paths: Record<string, string> = {
  Warrior: 'Destrucción',
  Rogue: 'Cacería',
  Mage: 'Erudición',
  Shaman: 'Armonía',
  Warlock: 'Nihilidad',
  Knight: 'Conservación',
  Priest: 'Abundancia',
  Memory: 'Reminiscencia',
};
function localized(store: HsrEnkaStore, hash: unknown, fallback: string) {
  const value = store.locEs[String(hash)] ?? store.locEn[String(hash)];
  return typeof value === 'string' && value.trim() ? value.slice(0, 150) : fallback;
}
function hsrImage(path: unknown) {
  if (typeof path !== 'string' || !path.startsWith('/ui/hsr/') || path.includes('..')) return null;
  const url = new URL(path, 'https://enka.network');
  return url.origin === 'https://enka.network' && !url.search && !url.hash ? url.href : null;
}
function number(value: unknown) {
  return nonnegative(value) ?? 0;
}
function bounded(value: unknown, fallback: number, max: number) {
  return Math.min(max, Math.floor(nonnegative(value) ?? fallback));
}
function characterStats(
  item: Record<string, unknown>,
  meta: Record<string, unknown>,
  weapon: Record<string, unknown>,
) {
  const promotion = record(record(meta.Promotion)[String(item.promotion ?? 0)]);
  if (!Object.keys(promotion).length) return null;
  const equipment = record(item.equipment),
    level = Math.max(1, bounded(item.level, 1, 80));
  const props: Record<string, number> = {};
  const add = (input: unknown) => {
    for (const [name, raw] of Object.entries(record(input))) {
      if (typeof raw === 'number' && Number.isFinite(raw)) props[name] = (props[name] ?? 0) + raw;
    }
  };
  const weaponFlat = record(record(equipment._flat).props);
  if (Object.keys(weaponFlat).length) add(weaponFlat);
  else {
    const wp = record(record(weapon.Promotion)[String(equipment.promotion ?? 0)]);
    const wl = Math.max(1, bounded(equipment.level, 1, 80));
    for (const key of ['BaseHP', 'BaseAttack', 'BaseDefence'])
      props[key] = number(wp[key]) + number(wp[`${key}Add`]) * (wl - 1);
  }
  for (const relic of (Array.isArray(item.relicList) ? item.relicList : []).slice(0, 6))
    add(record(record(relic)._flat).props);
  const calc = (base: string, addKey: string, weaponKey: string, ratio: string, delta: string) =>
    Math.max(
      0,
      (number(promotion[base]) +
        number(promotion[addKey]) * (level - 1) +
        (props[weaponKey] ?? 0)) *
        (1 + (props[ratio] ?? 0)) +
        (props[delta] ?? 0),
    );
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    hp: Math.round(calc('HPBase', 'HPAdd', 'BaseHP', 'HPAddedRatio', 'HPDelta')),
    atk: Math.round(
      calc('AttackBase', 'AttackAdd', 'BaseAttack', 'AttackAddedRatio', 'AttackDelta'),
    ),
    def: Math.round(
      calc('DefenceBase', 'DefenceAdd', 'BaseDefence', 'DefenceAddedRatio', 'DefenceDelta'),
    ),
    speed: round(
      Math.max(
        0,
        number(promotion.SpeedBase) * (1 + (props.SpeedAddedRatio ?? 0)) + (props.SpeedDelta ?? 0),
      ),
    ),
    critRate: round(
      Math.max(
        0,
        number(promotion.CriticalChance) +
          (props.CriticalChanceBase ?? 0) +
          (props.CriticalChance ?? 0),
      ) * 100,
    ),
    critDmg: round(
      Math.max(
        0,
        number(promotion.CriticalDamage) +
          (props.CriticalDamageBase ?? 0) +
          (props.CriticalDamage ?? 0),
      ) * 100,
    ),
  };
}
export function normalizedHsr(
  payload: unknown,
  uid: string,
  store: HsrEnkaStore = EMPTY_STORE,
): HsrProfile {
  const detail = record(record(payload).detailInfo),
    info = record(detail.recordInfo);
  if (typeof detail.nickname !== 'string' || !detail.nickname.trim())
    throw new ValidationError('Enka no encontró un perfil público de Star Rail para ese UID.');
  if (detail.uid !== undefined && String(detail.uid) !== uid)
    throw new ValidationError('El perfil de Enka no coincide con el UID solicitado.');
  const seen = new Set<number>();
  const showcase = (Array.isArray(detail.avatarDetailList) ? detail.avatarDetailList : [])
    .slice(0, 8)
    .flatMap((raw): HsrShowcaseCharacter[] => {
      const item = record(raw),
        id = Number(item.avatarId);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) return [];
      seen.add(id);
      const meta = record(store.avatars[String(id)]),
        eq = record(item.equipment),
        weapon = record(store.weapons[String(eq.tid)]);
      const [element, elementCode] = elements[String(meta.Element)] ?? [
        'Elemento no disponible',
        'neutral',
      ];
      return [
        {
          avatarId: id,
          name: localized(
            store,
            record(meta.AvatarName).Hash,
            id >= 8001 && id <= 8008
              ? localized(store, 'trailblazer', 'Trazacaminos')
              : `Personaje #${id}`,
          ),
          iconUrl: hsrImage(meta.AvatarSideIconPath),
          rarity: meta.Rarity === 5 ? 5 : 4,
          level: Math.max(1, bounded(item.level, 1, 80)),
          eidolons: bounded(item.rank, 0, 6),
          element,
          elementCode,
          path: paths[String(meta.AvatarBaseType)] ?? 'Vía no disponible',
          stats: characterStats(item, meta, weapon),
          relicsCount: Math.min(6, Array.isArray(item.relicList) ? item.relicList.length : 0),
          lightCone:
            Number.isSafeInteger(eq.tid) && Number(eq.tid) > 0
              ? {
                  name: localized(
                    store,
                    record(eq._flat).name,
                    localized(store, record(weapon.EquipmentName).Hash, `Cono #${eq.tid}`),
                  ),
                  iconUrl: hsrImage(weapon.ImagePath),
                  level: Math.max(1, bounded(eq.level, 1, 80)),
                  superimposition: Math.max(1, bounded(eq.rank, 1, 5)),
                  rarity: Math.max(3, bounded(weapon.Rarity, 4, 5)),
                }
              : null,
        },
      ];
    });
  return {
    game: 'hsr',
    uid,
    nickname: detail.nickname.slice(0, 100),
    level: bounded(detail.level, 0, 70),
    worldLevel: bounded(detail.worldLevel, 0, 6),
    signature: typeof detail.signature === 'string' ? detail.signature.slice(0, 400) : '',
    platform: typeof detail.platform === 'string' ? detail.platform.slice(0, 30) : 'Enka.Network',
    achievements: number(info.achievementCount),
    avatarCount: number(info.avatarCount),
    lightConeCount: number(info.equipmentCount),
    showcase,
  };
}
