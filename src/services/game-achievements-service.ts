import 'server-only';
import {
  achievementPercentageForKey,
  normalizeUnlockPercentage,
} from '@/domain/game-detail-resilience';
import { unstable_cache } from 'next/cache';
import { metaRecord, normalizedMetaTitle } from '@/domain/game-meta';
import {
  AchievementRaritySummary,
  calculateAchievementSummary,
  cleanText,
  GameAchievementItem,
  GameAchievementsReport,
  getAchievementTier,
  sanitizeSteamImageUrl,
} from '@/domain/game-achievements';

const EMPTY_SUMMARY: AchievementRaritySummary = {
  total: 0,
  platinoCount: 0,
  oroCount: 0,
  plataCount: 0,
  bronceCount: 0,
  hiddenCount: 0,
  averageUnlockRate: 0,
  rarestAchievement: null,
};

const EMPTY_REPORT: GameAchievementsReport = {
  appId: null,
  communityUrl: null,
  hasAchievements: false,
  totalAchievements: 0,
  summary: EMPTY_SUMMARY,
  achievements: [],
};

async function fetchJson(
  url: string,
  signal: AbortSignal,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function searchSteamAppId(title: string): Promise<number | null> {
  try {
    const signal = AbortSignal.timeout(8000);
    const search = metaRecord(
      await fetchJson(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=US`,
        signal,
      ),
    );

    const items = Array.isArray(search.items) ? search.items : [];
    const normalizedTarget = normalizedMetaTitle(title);

    const game = items
      .map(metaRecord)
      .find(
        (item) =>
          typeof item.name === 'string' &&
          normalizedMetaTitle(item.name) === normalizedTarget &&
          Number.isSafeInteger(item.id) &&
          Number(item.id) > 0 &&
          Number(item.id) <= 4294967295 &&
          (item.type === undefined || item.type === 'app'),
      );

    return game ? Number(game.id) : null;
  } catch {
    return null;
  }
}

interface RawQueryItem {
  queryKey?: unknown[];
  state?: {
    data?: Record<string, unknown>;
  };
}

interface RawValveSsr {
  renderContext?: {
    queryData?: string;
  };
}

export async function fetchCommunityAchievements(
  appId: number,
): Promise<GameAchievementItem[] | null> {
  try {
    const res = await fetch(`https://steamcommunity.com/stats/${appId}/achievements/?l=spanish`, {
      headers: {
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SaveState/1.0',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(
      /<script type="application\/json" id="valve-ssr-data"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!match?.[1]) return null;

    const rawSsr = JSON.parse(match[1]) as RawValveSsr;
    if (!rawSsr.renderContext?.queryData) return null;

    const queryData = JSON.parse(rawSsr.renderContext.queryData) as {
      queries?: RawQueryItem[];
    };
    const queries = Array.isArray(queryData.queries) ? queryData.queries : [];

    const schemaQuery = queries.find(
      (q) => Array.isArray(q.queryKey) && q.queryKey[2] === 'schema',
    );
    const percentQuery = queries.find(
      (q) => Array.isArray(q.queryKey) && q.queryKey[2] === 'globalpercentages',
    );

    const groups = Array.isArray(schemaQuery?.state?.data?.groups)
      ? (schemaQuery?.state?.data?.groups as Array<{ achievements?: unknown[] }>)
      : [];

    const rawAchievements: Array<Record<string, unknown>> = [];
    for (const rawGroup of groups) {
      const group = metaRecord(rawGroup);
      if (Array.isArray(group.achievements)) {
        for (const item of group.achievements) {
          rawAchievements.push(metaRecord(item));
        }
      }
    }

    if (!rawAchievements.length) return null;

    const percentagesMap = metaRecord(percentQuery?.state?.data?.percentages);

    const items: GameAchievementItem[] = rawAchievements.map((a, index) => {
      const internalKey = String(a.internal_key ?? a.api_name ?? '');
      const parsedPct = achievementPercentageForKey(percentagesMap, internalKey);

      const name = cleanText(a.name) || cleanText(a.api_name) || 'Logro';
      const description = cleanText(a.description);
      const isMaster =
        name.toLowerCase().includes('todos los logros') ||
        description.toLowerCase().includes('todos los logros') ||
        description.toLowerCase().includes('all achievements');

      const tier = getAchievementTier(parsedPct, isMaster);

      return {
        id: internalKey || `achievement-${index + 1}`,
        apiName: cleanText(a.api_name),
        name,
        description,
        hidden: Boolean(a.hidden),
        iconUrl:
          sanitizeSteamImageUrl(a.icon_achieved) || sanitizeSteamImageUrl(a.icon_unachieved) || '',
        iconLockedUrl: sanitizeSteamImageUrl(a.icon_unachieved),
        unlockedPercentage: parsedPct,
        tier,
      };
    });

    return items;
  } catch {
    return null;
  }
}

async function fetchStoreDetailsFallback(appId: number): Promise<GameAchievementItem[] | null> {
  try {
    const signal = AbortSignal.timeout(8000);
    const detailsRaw = metaRecord(
      await fetchJson(
        `https://store.steampowered.com/api/appdetails?appids=${appId}&l=spanish`,
        signal,
      ),
    );

    const entry = metaRecord(detailsRaw[String(appId)]);
    if (entry.success !== true) return null;

    const data = metaRecord(entry.data);
    const achievementsObj = metaRecord(data.achievements);
    const highlighted = Array.isArray(achievementsObj.highlighted)
      ? achievementsObj.highlighted
      : [];

    if (!highlighted.length) return null;

    // Fetch percentages from public Web API
    let apiPercentages: Record<string, number> = {};
    try {
      const pctRes = metaRecord(
        await fetchJson(
          `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appId}`,
          signal,
        ),
      );
      const pctContainer = metaRecord(pctRes.achievementpercentages);
      const pctList = Array.isArray(pctContainer.achievements) ? pctContainer.achievements : [];
      for (const item of pctList) {
        const row = metaRecord(item);
        if (typeof row.name === 'string' && typeof row.percent === 'number') {
          apiPercentages[row.name] = normalizeUnlockPercentage(row.percent);
        }
      }
    } catch {
      apiPercentages = {};
    }

    const items: GameAchievementItem[] = highlighted.map((item, idx) => {
      const rec = metaRecord(item);
      const name = cleanText(rec.name) || cleanText(rec.localized_name) || `Logro ${idx + 1}`;
      const percent = normalizeUnlockPercentage(apiPercentages[name]);
      const isMaster = name.toLowerCase().includes('todos los logros');

      return {
        id: String(idx + 1),
        apiName: cleanText(rec.name),
        name,
        description: '',
        hidden: Boolean(rec.hidden),
        iconUrl: sanitizeSteamImageUrl(rec.path),
        unlockedPercentage: percent,
        tier: getAchievementTier(percent, isMaster),
      };
    });

    return items;
  } catch {
    return null;
  }
}

export async function fetchGameAchievements(title: string): Promise<GameAchievementsReport> {
  if (!title || !title.trim()) return EMPTY_REPORT;

  const appId = await searchSteamAppId(title);
  if (!appId) return EMPTY_REPORT;

  const communityUrl = `https://steamcommunity.com/stats/${appId}/achievements`;

  let items = await fetchCommunityAchievements(appId);
  if (!items || !items.length) {
    items = await fetchStoreDetailsFallback(appId);
  }

  if (!items || !items.length) {
    return {
      appId,
      communityUrl,
      hasAchievements: false,
      totalAchievements: 0,
      summary: EMPTY_SUMMARY,
      achievements: [],
    };
  }

  // Sort: lowest unlock percentage first (rarest trophies top)
  items.sort((a, b) => a.unlockedPercentage - b.unlockedPercentage);

  const summary = calculateAchievementSummary(items);

  return {
    appId,
    communityUrl,
    hasAchievements: true,
    totalAchievements: items.length,
    summary,
    achievements: items,
  };
}

export const getCachedGameAchievements = unstable_cache(
  async (title: string): Promise<GameAchievementsReport> => {
    return fetchGameAchievements(title);
  },
  ['game-achievements-v2'],
  { revalidate: 86400 },
);
