export const ACHIEVEMENT_TIERS = ['platino', 'oro', 'plata', 'bronce'] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];

export interface GameAchievementItem {
  id: string;
  apiName: string;
  name: string;
  description: string;
  hidden: boolean;
  iconUrl: string;
  iconLockedUrl?: string;
  unlockedPercentage: number;
  tier: AchievementTier;
}

export interface AchievementRaritySummary {
  total: number;
  platinoCount: number;
  oroCount: number;
  plataCount: number;
  bronceCount: number;
  hiddenCount: number;
  averageUnlockRate: number;
  rarestAchievement: GameAchievementItem | null;
}

export interface GameAchievementsReport {
  appId: number | null;
  communityUrl: string | null;
  hasAchievements: boolean;
  totalAchievements: number;
  summary: AchievementRaritySummary;
  achievements: GameAchievementItem[];
}

export function getAchievementTier(
  percent: number,
  isMasterOrCompletionist: boolean = false,
): AchievementTier {
  if (isMasterOrCompletionist || percent < 10) return 'platino';
  if (percent < 25) return 'oro';
  if (percent < 50) return 'plata';
  return 'bronce';
}

export function getTierLabel(tier: AchievementTier): string {
  switch (tier) {
    case 'platino':
      return 'Platino (Ultra Raro)';
    case 'oro':
      return 'Oro (Muy Raro)';
    case 'plata':
      return 'Plata (Raro)';
    case 'bronce':
      return 'Bronce (Común)';
  }
}

export function cleanText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

const ALLOWED_STEAM_IMG_HOSTS = [
  'shared.fastly.steamstatic.com',
  'shared.akamai.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'cdn.fastly.steamstatic.com',
  'community.cloudflare.steamstatic.com',
  'avatars.steamstatic.com',
];

export function sanitizeSteamImageUrl(url: unknown): string {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_STEAM_IMG_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
    return isAllowed ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function calculateAchievementSummary(
  items: GameAchievementItem[],
): AchievementRaritySummary {
  if (!items.length) {
    return {
      total: 0,
      platinoCount: 0,
      oroCount: 0,
      plataCount: 0,
      bronceCount: 0,
      hiddenCount: 0,
      averageUnlockRate: 0,
      rarestAchievement: null,
    };
  }

  let platinoCount = 0;
  let oroCount = 0;
  let plataCount = 0;
  let bronceCount = 0;
  let hiddenCount = 0;
  let totalPercent = 0;
  let rarest: GameAchievementItem | null = null;

  for (const item of items) {
    if (item.hidden) hiddenCount++;
    totalPercent += item.unlockedPercentage;

    switch (item.tier) {
      case 'platino':
        platinoCount++;
        break;
      case 'oro':
        oroCount++;
        break;
      case 'plata':
        plataCount++;
        break;
      case 'bronce':
        bronceCount++;
        break;
    }

    if (!rarest || item.unlockedPercentage < rarest.unlockedPercentage) {
      rarest = item;
    }
  }

  const averageUnlockRate =
    items.length > 0 ? Math.round((totalPercent / items.length) * 10) / 10 : 0;

  return {
    total: items.length,
    platinoCount,
    oroCount,
    plataCount,
    bronceCount,
    hiddenCount,
    averageUnlockRate,
    rarestAchievement: rarest,
  };
}
