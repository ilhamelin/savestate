import { record, nonnegative } from './game-live-telemetry.ts';
export type EnkaStore = {
  characters: Record<string, unknown>;
  locEs: Record<string, unknown>;
  locEn: Record<string, unknown>;
};
export type GenshinShowcaseCharacter = {
  avatarId: number;
  name: string;
  iconUrl: string | null;
  rarity: 4 | 5;
  level: number;
  element: string;
  elementCode: 'pyro' | 'electro' | 'dendro' | 'hydro' | 'cryo' | 'geo' | 'anemo' | 'neutral';
  constellations: number;
  friendship: number | null;
  talents: number[];
  stats: {
    hp: number;
    atk: number;
    def: number;
    critRate: number;
    critDmg: number;
    energyRecharge: number;
    elementalMastery: number;
  } | null;
  weapon: {
    name: string;
    iconUrl: string | null;
    level: number;
    refinement: number;
    rarity: number;
    baseAtk: number | null;
    substat: string | null;
  } | null;
  artifacts: { iconUrl: string; level: number; rarity: number; mainStat: string }[];
};
export function enkaIcon(icon: unknown): string | null {
  return typeof icon === 'string' && /^UI_[A-Za-z0-9_]{1,150}$/.test(icon)
    ? `https://enka.network/ui/${icon}.png`
    : null;
}
function localized(hash: unknown, fallback: string, store: EnkaStore) {
  const name = store.locEs[String(hash)] || store.locEn[String(hash)];
  return typeof name === 'string' && name.trim() ? name.slice(0, 150) : fallback;
}
function cleanIcon(icon: unknown, prefix: string) {
  return typeof icon === 'string'
    ? icon.replace(prefix, '').replaceAll('_', ' ').slice(0, 150)
    : '';
}
const statLabels: Record<string, string> = {
  FIGHT_PROP_BASE_ATTACK: 'ATQ Base',
  FIGHT_PROP_CRITICAL: 'Prob. CRIT',
  FIGHT_PROP_CRITICAL_HURT: 'Daño CRIT',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'Recarga',
  FIGHT_PROP_ATTACK_PERCENT: 'ATQ',
  FIGHT_PROP_HP_PERCENT: 'VIDA',
  FIGHT_PROP_DEFENSE_PERCENT: 'DEF',
  FIGHT_PROP_ELEMENT_MASTERY: 'Maestría',
  FIGHT_PROP_HP: 'VIDA',
  FIGHT_PROP_ATTACK: 'ATQ',
  FIGHT_PROP_DEFENSE: 'DEF',
  FIGHT_PROP_FIRE_ADD_HURT: 'Bono Pyro',
  FIGHT_PROP_WATER_ADD_HURT: 'Bono Hydro',
  FIGHT_PROP_ELEC_ADD_HURT: 'Bono Electro',
  FIGHT_PROP_ICE_ADD_HURT: 'Bono Cryo',
  FIGHT_PROP_WIND_ADD_HURT: 'Bono Anemo',
  FIGHT_PROP_ROCK_ADD_HURT: 'Bono Geo',
  FIGHT_PROP_GRASS_ADD_HURT: 'Bono Dendro',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'Bono físico',
};
function statText(raw: unknown): string | null {
  const stat = record(raw);
  const id = String(stat.appendPropId ?? stat.mainPropId ?? '');
  const value = nonnegative(stat.statValue);
  if (value === null) return null;
  const percentage = /PERCENT|ADD_HURT|CRITICAL|CHARGE_EFFICIENCY/.test(id);
  return `${statLabels[id] ?? 'Estadística'} ${value}${percentage ? '%' : ''}`;
}
export function genshinBuild(
  avatarId: number,
  detail: Record<string, unknown> | undefined,
  store: EnkaStore,
) {
  const variant = store.characters[`${avatarId}-${detail?.skillDepotId}`];
  const meta = record(variant ?? store.characters[String(avatarId)]);
  const fp = record(detail?.fightPropMap);
  const number = (key: string) => nonnegative(fp[key]) ?? 0;
  const percent = (key: string) => Math.round(number(key) * 1000) / 10;
  const equipment = (Array.isArray(detail?.equipList) ? detail.equipList : []).map(record);
  const equippedWeapon = equipment.find((item) => item.weapon);
  const weapon = record(equippedWeapon?.weapon),
    flat = record(equippedWeapon?.flat);
  const weaponStats = (Array.isArray(flat.weaponStats) ? flat.weaponStats : []).map(record);
  return {
    name: localized(
      meta.NameTextMapHash,
      cleanIcon(meta.SideIconName, 'UI_AvatarIcon_Side_') || `Personaje #${avatarId}`,
      store,
    ),
    iconUrl: enkaIcon(
      typeof meta.SideIconName === 'string'
        ? meta.SideIconName.replace('UI_AvatarIcon_Side_', 'UI_AvatarIcon_')
        : null,
    ),
    rarity: (meta.QualityType === 'QUALITY_ORANGE' ? 5 : 4) as 4 | 5,
    constellations: Math.min(
      6,
      Array.isArray(detail?.talentIdList) ? detail.talentIdList.length : 0,
    ),
    friendship: nonnegative(record(detail?.fetterInfo).expLevel),
    talents: detail
      ? (Array.isArray(meta.SkillOrder) ? meta.SkillOrder : [])
          .slice(0, 3)
          .map((id) => nonnegative(record(detail.skillLevelMap)[String(id)]) ?? 1)
      : [],
    stats:
      detail && Object.keys(fp).length
        ? {
            hp: Math.round(number('2000')),
            atk: Math.round(number('2001')),
            def: Math.round(number('2002')),
            critRate: percent('20'),
            critDmg: percent('22'),
            energyRecharge: percent('23'),
            elementalMastery: Math.round(number('28')),
          }
        : null,
    weapon: equippedWeapon
      ? {
          name: localized(
            flat.nameTextMapHash,
            cleanIcon(flat.icon, 'UI_EquipIcon_') || 'Arma equipada',
            store,
          ),
          iconUrl: enkaIcon(flat.icon),
          level: nonnegative(weapon.level) ?? 1,
          refinement: Math.min(
            5,
            (nonnegative(Object.values(record(weapon.affixMap))[0]) ?? 0) + 1,
          ),
          rarity: nonnegative(flat.rankLevel) ?? 4,
          baseAtk: nonnegative(
            weaponStats.find((stat) => stat.appendPropId === 'FIGHT_PROP_BASE_ATTACK')?.statValue,
          ),
          substat: statText(weaponStats[1]),
        }
      : null,
    artifacts: equipment
      .filter((item) => item.reliquary)
      .slice(0, 5)
      .flatMap((item) => {
        const art = record(item.flat),
          reliquary = record(item.reliquary),
          iconUrl = enkaIcon(art.icon);
        return iconUrl
          ? [
              {
                iconUrl,
                level: Math.max(0, (nonnegative(reliquary.level) ?? 1) - 1),
                rarity: nonnegative(art.rankLevel) ?? 5,
                mainStat: statText(art.reliquaryMainstat) ?? 'Estadística no disponible',
              },
            ]
          : [];
      }),
    metadataElement: typeof meta.Element === 'string' ? meta.Element : null,
  };
}
