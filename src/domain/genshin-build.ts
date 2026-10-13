import { record, nonnegative } from './game-live-telemetry.ts';
export type EnkaStore = {
  characters: Record<string, unknown>;
  locEs: Record<string, unknown>;
  locEn: Record<string, unknown>;
  pfps?: Record<string, unknown>;
  namecards?: Record<string, unknown>;
};
export type GenshinArtifactPiece = {
  slot: string;
  slotLabel: string;
  name: string;
  setName: string;
  iconUrl: string;
  level: number;
  rarity: number;
  mainStat: string;
  mainStatLabel: string;
  mainStatValue: string;
  mainStatHighlight: boolean;
  substats: { propId: string; label: string; valueText: string; isHighlight: boolean }[];
};
export type GenshinWeaponSummary = {
  name: string;
  iconUrl: string | null;
  level: number;
  refinement: number;
  rarity: number;
  baseAtk: number | null;
  substat: string | null;
};
export type GenshinShowcaseCharacter = {
  avatarId: number;
  name: string;
  iconUrl: string | null;
  splashUrl: string | null;
  rarity: 4 | 5;
  level: number;
  element: string;
  elementCode: 'pyro' | 'electro' | 'dendro' | 'hydro' | 'cryo' | 'geo' | 'anemo' | 'neutral';
  constellations: number;
  friendship: number | null;
  friendshipLevel: number | null;
  talents: number[];
  constellationsList: { index: number; iconUrl: string; unlocked: boolean }[];
  talentsList: { id: string; level: number; boosted: boolean; iconUrl: string | null }[];
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    baseHp: number;
    bonusHp: number;
    baseAtk: number;
    bonusAtk: number;
    baseDef: number;
    bonusDef: number;
    critRate: number;
    critDmg: number;
    critDamage: number;
    energyRecharge: number;
    elementalMastery: number;
    healingBonus: number;
    incomingHealingBonus: number;
    physicalDmgBonus: number;
    elementalDmgBonus: { label: string; value: number };
  } | null;
  weapon: GenshinWeaponSummary | null;
  artifacts: GenshinArtifactPiece[];
  activeArtifactSets: { setName: string; count: number }[];
};
export type GenshinCharacterBuild = GenshinShowcaseCharacter;
export type GenshinTrackerData = import('./competitive-tracker.ts').GenshinProfile;
export function enkaIcon(icon: unknown): string | null {
  return typeof icon === 'string' && /^(?:UI_|Skill_)[A-Za-z0-9_]{1,150}$/.test(icon)
    ? `https://enka.network/ui/${icon}.png`
    : null;
}
export function resolveGenshinProfileIconUrl(
  profilePicture: { id?: number; avatarId?: number } | undefined,
  store: EnkaStore,
) {
  const preset = enkaIcon(record(store.pfps?.[String(profilePicture?.id)]).iconPath);
  if (preset) return preset;
  const side = record(store.characters[String(profilePicture?.avatarId)]).SideIconName;
  return enkaIcon(
    typeof side === 'string' ? side.replace('UI_AvatarIcon_Side_', 'UI_AvatarIcon_') : null,
  );
}
export function resolveGenshinNameCardUrl(nameCardId: number | undefined, store: EnkaStore) {
  return enkaIcon(record(store.namecards?.[String(nameCardId)]).icon);
}
export function resolveGenshinRegionLabel(uid: string): string | null {
  if (uid.startsWith('18') || uid.startsWith('8')) return 'Asia Server';
  return (
    (
      { '6': 'America Server', '7': 'Europe Server', '9': 'TW/HK/MO Server' } as Record<
        string,
        string
      >
    )[uid[0] ?? ''] ?? null
  );
}
export function resolveCharacterSplashUrl(sideIconName?: string) {
  return enkaIcon(sideIconName?.replace('UI_AvatarIcon_Side_', 'UI_Gacha_AvatarImg_'));
}
export function resolveConstellationList(metaConsts: string[] | undefined, unlockedCount: number) {
  return Array.from({ length: 6 }, (_, i) => ({
    index: i + 1,
    iconUrl: enkaIcon(metaConsts?.[i]) ?? '',
    unlocked: i < Math.max(0, Math.min(6, unlockedCount)),
  }));
}
export function resolveTalentList(
  avatarInfo: Record<string, unknown> | undefined,
  meta: Record<string, unknown>,
) {
  if (!avatarInfo) return [];
  const levels = record(avatarInfo.skillLevelMap),
    skills = record(meta.Skills),
    proud = record(meta.ProudMap),
    extras = record(avatarInfo.proudSkillExtraLevelMap);
  const order = Array.isArray(meta.SkillOrder) ? meta.SkillOrder : Object.keys(levels);
  return order.slice(0, 3).map((id) => {
    const extraLevel = nonnegative(extras[String(proud[String(id)] ?? id)]) ?? 0;
    return {
      id: String(id),
      level: (nonnegative(levels[String(id)]) ?? 1) + extraLevel,
      extraLevel,
      iconUrl: enkaIcon(skills[String(id)]),
    };
  });
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
const weaponNames: Record<string, string> = {
  Pole_BloodMoon: 'Semblante de la Luna Carmesí',
  Pole_Homa: 'Báculo de Homa',
  Sword_Zephyrus: 'Espada de Favonius',
  Catalyst_MenulisRing: 'Espejo Tejenoches',
  Claymore_Deshret: 'Emblema del Mar de Juncos',
  Sword_Narukami: 'Reflejo de las Tinieblas',
  Bow_Worldbane: 'Aqua Simulacra',
  Pole_Narukami: 'Luz del Segador',
};
const statLabels: Record<string, string> = {
  FIGHT_PROP_BASE_ATTACK: 'ATQ Básico',
  FIGHT_PROP_CRITICAL: 'Prob. CRIT',
  FIGHT_PROP_CRITICAL_HURT: 'Daño CRIT',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'Recarga de Energía',
  FIGHT_PROP_ATTACK_PERCENT: 'ATQ %',
  FIGHT_PROP_HP_PERCENT: 'Vida %',
  FIGHT_PROP_DEFENSE_PERCENT: 'DEF %',
  FIGHT_PROP_ELEMENT_MASTERY: 'Maestría Elemental',
  FIGHT_PROP_HP: 'Vida',
  FIGHT_PROP_ATTACK: 'ATQ',
  FIGHT_PROP_DEFENSE: 'DEF',
  FIGHT_PROP_FIRE_ADD_HURT: 'Bono de Daño Pyro',
  FIGHT_PROP_WATER_ADD_HURT: 'Bono de Daño Hydro',
  FIGHT_PROP_ELEC_ADD_HURT: 'Bono de Daño Electro',
  FIGHT_PROP_ICE_ADD_HURT: 'Bono de Daño Cryo',
  FIGHT_PROP_WIND_ADD_HURT: 'Bono de Daño Anemo',
  FIGHT_PROP_ROCK_ADD_HURT: 'Bono de Daño Geo',
  FIGHT_PROP_GRASS_ADD_HURT: 'Bono de Daño Dendro',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'Bono de Daño Físico',
  FIGHT_PROP_HEAL_ADD: 'Bono de Curación',
};
const highlightProps = new Set([
  'FIGHT_PROP_CRITICAL',
  'FIGHT_PROP_CRITICAL_HURT',
  'FIGHT_PROP_ATTACK_PERCENT',
  'FIGHT_PROP_HP_PERCENT',
  'FIGHT_PROP_CHARGE_EFFICIENCY',
  'FIGHT_PROP_ELEMENT_MASTERY',
]);
export const GENSHIN_ARTIFACT_SLOTS = [
  'EQUIP_BRACER',
  'EQUIP_NECKLACE',
  'EQUIP_SHOES',
  'EQUIP_RING',
  'EQUIP_DRESS',
] as const;
const slots: Record<string, string> = {
  EQUIP_BRACER: 'Flor',
  EQUIP_NECKLACE: 'Pluma',
  EQUIP_SHOES: 'Reloj',
  EQUIP_RING: 'Cáliz',
  EQUIP_DRESS: 'Corona',
};
function statParts(raw: unknown) {
  const stat = record(raw),
    propId = String(stat.appendPropId ?? stat.mainPropId ?? ''),
    value = nonnegative(stat.statValue);
  if (value === null) return null;
  return {
    propId,
    label: statLabels[propId] ?? 'Estadística',
    valueText: `${Math.round(value * 10) / 10}${/PERCENT|ADD_HURT|CRITICAL|CHARGE_EFFICIENCY|HEAL_ADD/.test(propId) ? '%' : ''}`,
    isHighlight: highlightProps.has(propId),
  };
}
function statText(raw: unknown) {
  const stat = statParts(raw);
  return stat ? `${stat.label} ${stat.valueText}` : null;
}
export function genshinBuild(
  avatarId: number,
  detail: Record<string, unknown> | undefined,
  store: EnkaStore,
) {
  const meta = record(
    store.characters[`${avatarId}-${detail?.skillDepotId}`] ?? store.characters[String(avatarId)],
  );
  const fp = record(detail?.fightPropMap),
    number = (key: string) => nonnegative(fp[key]) ?? 0,
    percent = (key: string) => Math.round(number(key) * 1000) / 10;
  const equipment = (Array.isArray(detail?.equipList) ? detail.equipList : []).map(record);
  const equippedWeapon = equipment.find((item) => item.weapon),
    weapon = record(equippedWeapon?.weapon),
    flat = record(equippedWeapon?.flat);
  const weaponStats = (Array.isArray(flat.weaponStats) ? flat.weaponStats : []).map(record);
  const constellations = Math.min(
    6,
    Array.isArray(detail?.talentIdList) ? detail.talentIdList.length : 0,
  );
  const talentDetails = resolveTalentList(detail, meta);
  const damageTypes: [string, string][] = [
    ['40', 'Pyro'],
    ['41', 'Electro'],
    ['42', 'Hydro'],
    ['43', 'Dendro'],
    ['44', 'Anemo'],
    ['45', 'Geo'],
    ['46', 'Cryo'],
  ];
  const element = (
    {
      Fire: 'Pyro',
      Electric: 'Electro',
      Water: 'Hydro',
      Grass: 'Dendro',
      Wind: 'Anemo',
      Rock: 'Geo',
      Ice: 'Cryo',
    } as Record<string, string>
  )[String(meta.Element)];
  const damage = damageTypes.reduce(
    (best, item) => (number(item[0]) > number(best[0]) ? item : best),
    damageTypes.find((item) => item[1] === element) ?? damageTypes[0]!,
  );
  const artifacts: GenshinArtifactPiece[] = GENSHIN_ARTIFACT_SLOTS.flatMap((slot) => {
    const item = equipment.find((item) => item.reliquary && record(item.flat).equipType === slot);
    if (!item) return [];
    const art = record(item.flat),
      reliquary = record(item.reliquary),
      iconUrl = enkaIcon(art.icon),
      main = statParts(art.reliquaryMainstat);
    if (!iconUrl) return [];
    return [
      {
        slot,
        slotLabel: slots[slot]!,
        name: localized(art.nameTextMapHash, slots[slot]!, store),
        setName: localized(art.setNameTextMapHash, '', store),
        iconUrl,
        level: Math.max(0, (nonnegative(reliquary.level) ?? 1) - 1),
        rarity: Math.min(5, nonnegative(art.rankLevel) ?? 5),
        mainStat: statText(art.reliquaryMainstat) ?? 'Estadística no disponible',
        mainStatLabel: main?.label ?? 'Estadística',
        mainStatValue: main?.valueText ?? '—',
        mainStatHighlight: GENSHIN_ARTIFACT_SLOTS.indexOf(slot) >= 2,
        substats: (Array.isArray(art.reliquarySubstats) ? art.reliquarySubstats : [])
          .slice(0, 4)
          .flatMap((raw) => {
            const stat = statParts(raw);
            return stat ? [stat] : [];
          }),
      },
    ];
  });
  const counts = artifacts.reduce<Record<string, number>>((sets, art) => {
    if (art.setName) sets[art.setName] = (sets[art.setName] ?? 0) + 1;
    return sets;
  }, {});
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
    splashUrl: resolveCharacterSplashUrl(
      typeof meta.SideIconName === 'string' ? meta.SideIconName : undefined,
    ),
    rarity: (meta.QualityType === 'QUALITY_ORANGE' ? 5 : 4) as 4 | 5,
    constellations,
    constellationsList: resolveConstellationList(
      Array.isArray(meta.Consts) ? meta.Consts : undefined,
      constellations,
    ),
    friendship: nonnegative(record(detail?.fetterInfo).expLevel),
    friendshipLevel: nonnegative(record(detail?.fetterInfo).expLevel),
    talents: talentDetails.map((t) => t.level),
    talentsList: talentDetails.map(({ extraLevel, ...t }) => ({ ...t, boosted: extraLevel > 0 })),
    stats:
      detail && Object.keys(fp).length
        ? {
            hp: Math.round(number('2000')),
            maxHp: Math.round(number('2000')),
            atk: Math.round(number('2001')),
            def: Math.round(number('2002')),
            baseHp: Math.round(number('1')),
            bonusHp: Math.max(0, Math.round(number('2000') - number('1'))),
            baseAtk: Math.round(number('4')),
            bonusAtk: Math.max(0, Math.round(number('2001') - number('4'))),
            baseDef: Math.round(number('7')),
            bonusDef: Math.max(0, Math.round(number('2002') - number('7'))),
            critRate: percent('20'),
            critDmg: percent('22'),
            critDamage: percent('22'),
            energyRecharge: percent('23'),
            elementalMastery: Math.round(number('28')),
            healingBonus: percent('26'),
            incomingHealingBonus: percent('27'),
            physicalDmgBonus: percent('30'),
            elementalDmgBonus: { label: `Bono de Daño ${damage[1]}`, value: percent(damage[0]) },
          }
        : null,
    weapon: equippedWeapon
      ? {
          name: localized(
            flat.nameTextMapHash,
            weaponNames[String(flat.icon).replace('UI_EquipIcon_', '')] ??
              (cleanIcon(flat.icon, 'UI_EquipIcon_') || 'Arma equipada'),
            store,
          ),
          iconUrl: enkaIcon(flat.icon),
          level: nonnegative(weapon.level) ?? 1,
          refinement: Math.min(
            5,
            (nonnegative(Object.values(record(weapon.affixMap))[0]) ?? 0) + 1,
          ),
          rarity: Math.min(5, nonnegative(flat.rankLevel) ?? 4),
          baseAtk: nonnegative(
            weaponStats.find((stat) => stat.appendPropId === 'FIGHT_PROP_BASE_ATTACK')?.statValue,
          ),
          substat: statText(
            weaponStats.find((stat) => stat.appendPropId !== 'FIGHT_PROP_BASE_ATTACK'),
          ),
        }
      : null,
    artifacts,
    activeArtifactSets: Object.entries(counts)
      .filter(([, count]) => count >= 2)
      .map(([setName, count]) => ({ setName, count })),
    metadataElement: typeof meta.Element === 'string' ? meta.Element : null,
  };
}
