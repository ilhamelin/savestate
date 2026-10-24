import 'server-only';
import { unstable_cache } from 'next/cache';
import { twitchAccessToken } from '@/integrations/igdb/server';
import { catalogueAdmin } from '@/integrations/supabase/admin';
import {
  metaRecord,
  normalizedMetaTitle,
  parseSteamRequirements,
  parseReviewQuotes,
  getCriticTier,
  sanitizeMetacriticUrl,
  type GameCriticAndSpecsReport,
  type CriticScoreReport,
  type GameHardwareSpecs,
} from '@/domain/game-specs';

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
  if (!response.ok) throw new Error('Specs metadata unavailable');
  return response.json() as Promise<unknown>;
}

async function fetchSteamSpecs(title: string): Promise<{
  critic: CriticScoreReport | null;
  hardware: GameHardwareSpecs | null;
  found: boolean;
}> {
  const signal = AbortSignal.timeout(9000);
  const search = metaRecord(
    await fetchJson(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=US`,
      signal,
    ),
  );

  const game = (Array.isArray(search.items) ? search.items : [])
    .map(metaRecord)
    .find(
      (item) =>
        typeof item.name === 'string' &&
        normalizedMetaTitle(item.name) === normalizedMetaTitle(title) &&
        Number.isSafeInteger(item.id) &&
        Number(item.id) > 0 &&
        Number(item.id) <= 4294967295 &&
        (item.type === undefined || item.type === 'app'),
    );

  if (!game) return { critic: null, hardware: null, found: false };

  const appId = Number(game.id);
  const detailsRaw = metaRecord(
    await fetchJson(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&l=spanish`,
      signal,
    ),
  );

  const entry = metaRecord(detailsRaw[String(appId)]);
  if (entry.success !== true) return { critic: null, hardware: null, found: false };

  const data = metaRecord(entry.data);
  const pcReqs = metaRecord(data.pc_requirements);

  const minimum = parseSteamRequirements(
    typeof pcReqs.minimum === 'string' ? pcReqs.minimum : undefined,
  );
  const recommended = parseSteamRequirements(
    typeof pcReqs.recommended === 'string' ? pcReqs.recommended : undefined,
  );

  const platforms = metaRecord(data.platforms);
  const isPcAvailable = Boolean(
    platforms.windows || platforms.linux || platforms.mac || minimum || recommended,
  );

  const hardware: GameHardwareSpecs = {
    minimum,
    recommended,
    isPcAvailable,
  };

  const metacritic = metaRecord(data.metacritic);
  const score =
    typeof metacritic.score === 'number' && Number.isFinite(metacritic.score)
      ? metacritic.score
      : null;
  const metacriticUrl = sanitizeMetacriticUrl(
    typeof metacritic.url === 'string' ? metacritic.url : null,
  );
  const reviewQuotes = parseReviewQuotes(
    typeof data.reviews === 'string' ? data.reviews : undefined,
  );

  const critic: CriticScoreReport | null =
    score !== null || reviewQuotes.length > 0
      ? {
          score,
          tier: getCriticTier(score),
          provider: score !== null ? 'metacritic' : null,
          url: metacriticUrl,
          reviewQuotes,
        }
      : null;

  return { critic, hardware, found: true };
}

async function fetchIgdbCriticFallback(
  title: string,
  igdbId?: number | null,
): Promise<CriticScoreReport | null> {
  if (
    !process.env.TWITCH_CLIENT_ID ||
    !process.env.TWITCH_CLIENT_SECRET ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }

  const signal = AbortSignal.timeout(9000);
  const bearer = await twitchAccessToken(signal);

  let allowed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await catalogueAdmin().rpc('claim_igdb_request').abortSignal(signal);
    if (!error && data) {
      allowed = true;
      break;
    }
    if (signal.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!allowed) return null;

  let gameId: number | null =
    typeof igdbId === 'number' && Number.isSafeInteger(igdbId) && igdbId > 0 ? igdbId : null;

  if (!gameId) {
    const searchBody = `search ${JSON.stringify(title)}; fields id,name; where version_parent = null; limit 5;`;
    const searchResult = await fetchJson('https://api.igdb.com/v4/games', signal, {
      method: 'POST',
      body: searchBody,
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'text/plain',
      },
    });

    const match = Array.isArray(searchResult)
      ? searchResult
          .map(metaRecord)
          .find(
            (item) =>
              typeof item.name === 'string' &&
              normalizedMetaTitle(item.name) === normalizedMetaTitle(title) &&
              typeof item.id === 'number' &&
              Number.isSafeInteger(item.id) &&
              item.id > 0,
          )
      : null;

    if (!match) return null;
    gameId = Number(match.id);
  }

  let budgetSlot = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await catalogueAdmin().rpc('claim_igdb_request').abortSignal(signal);
    if (!error && data) {
      budgetSlot = true;
      break;
    }
    if (signal.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!budgetSlot) return null;

  const ratingBody = `fields aggregated_rating,aggregated_rating_count; where id = ${gameId}; limit 1;`;
  const ratingResult = await fetchJson('https://api.igdb.com/v4/games', signal, {
    method: 'POST',
    body: ratingBody,
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: 'Bearer ' + bearer,
      'Content-Type': 'text/plain',
    },
  });

  const row = Array.isArray(ratingResult) ? metaRecord(ratingResult[0]) : null;
  if (!row) return null;

  const scoreRaw = row.aggregated_rating;
  if (typeof scoreRaw !== 'number' || !Number.isFinite(scoreRaw) || scoreRaw <= 0) return null;

  const roundedScore = Math.round(scoreRaw);
  return {
    score: roundedScore,
    tier: getCriticTier(roundedScore),
    provider: 'igdb',
    url: null,
    reviewQuotes: [],
  };
}

export const fetchGameCriticAndSpecs = unstable_cache(
  async (title: string, igdbId?: number | null): Promise<GameCriticAndSpecsReport> => {
    const empty: GameCriticAndSpecsReport = { critic: null, hardware: null };
    const clean = typeof title === 'string' ? title.trim().replace(/[\r\n\t]+/g, ' ') : '';
    if (!clean || clean.length > 200 || !normalizedMetaTitle(clean)) return empty;

    let steamData: {
      critic: CriticScoreReport | null;
      hardware: GameHardwareSpecs | null;
      found: boolean;
    } = {
      critic: null,
      hardware: null,
      found: false,
    };

    try {
      steamData = await fetchSteamSpecs(clean);
    } catch {
      /* steam unavailable */
    }

    let critic = steamData.critic;
    if (!critic || critic.score === null) {
      try {
        const igdbCritic = await fetchIgdbCriticFallback(clean, igdbId);
        if (igdbCritic) {
          critic = {
            score: igdbCritic.score,
            tier: igdbCritic.tier,
            provider: igdbCritic.provider,
            url: critic?.url ?? null,
            reviewQuotes: critic?.reviewQuotes ?? [],
          };
        }
      } catch {
        /* igdb fallback unavailable */
      }
    }

    return {
      critic,
      hardware: steamData.hardware,
    };
  },
  ['game-critic-specs-v1'],
  { revalidate: 86400 },
);
