import 'server-only';
import { unstable_cache } from 'next/cache';
import { twitchAccessToken } from '@/integrations/igdb/server';
import { catalogueAdmin } from '@/integrations/supabase/admin';
import {
  hasUnsafeUrlCharacters,
  metaRecord,
  normalizedMetaTitle,
  mapIgdbDuration,
  mapProtonDbReport,
  mapSpeedrunRecord,
  type GameMetaReport,
  type GameDuration,
  type ProtonDbReport,
  type SpeedrunRecord,
} from '@/domain/game-meta';

async function json(url: string, signal: AbortSignal, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
  });
  if (!response.ok) throw new Error('Game metadata unavailable');
  return response.json() as Promise<unknown>;
}
async function duration(title: string): Promise<GameDuration | null> {
  if (
    !process.env.TWITCH_CLIENT_ID ||
    !process.env.TWITCH_CLIENT_SECRET ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return null;
  const signal = AbortSignal.timeout(10000);
  const bearer = await twitchAccessToken(signal);
  async function igdb(path: 'games' | 'game_time_to_beats', body: string) {
    const { data, error } = await catalogueAdmin().rpc('claim_igdb_request').abortSignal(signal);
    if (error || !data) throw new Error('IGDB quota unavailable');
    return json('https://api.igdb.com/v4/' + path, signal, {
      method: 'POST',
      body,
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID!,
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'text/plain',
      },
    });
  }
  const games = await igdb(
    'games',
    `search ${JSON.stringify(title)}; fields id,name; where version_parent = null; limit 5;`,
  );
  const game = Array.isArray(games)
    ? games
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
  if (!game) return null;
  const times = await igdb(
    'game_time_to_beats',
    `fields game_id,hastily,normally,completely; where game_id = ${game.id}; limit 1;`,
  );
  const row = Array.isArray(times)
    ? times.find((item) => metaRecord(item).game_id === game.id)
    : null;
  return mapIgdbDuration(row);
}
async function proton(title: string): Promise<ProtonDbReport | null> {
  const signal = AbortSignal.timeout(9000);
  const search = metaRecord(
    await json(
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
  if (!game) return null;
  const appId = Number(game.id);
  return mapProtonDbReport(
    await json(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`, signal),
    appId,
  );
}
async function speedrun(title: string): Promise<SpeedrunRecord | null> {
  const signal = AbortSignal.timeout(10000);
  const search = metaRecord(
    await json(
      `https://www.speedrun.com/api/v1/games?name=${encodeURIComponent(title)}&max=1`,
      signal,
    ),
  );
  const game = metaRecord(Array.isArray(search.data) ? search.data[0] : null);
  const name = metaRecord(game.names).international;
  if (
    typeof name !== 'string' ||
    normalizedMetaTitle(name) !== normalizedMetaTitle(title) ||
    typeof game.id !== 'string' ||
    !/^[a-zA-Z0-9]+$/.test(game.id)
  )
    return null;
  const response = metaRecord(
    await json(`https://www.speedrun.com/api/v1/games/${game.id}/categories`, signal),
  );
  const categories = (Array.isArray(response.data) ? response.data : [])
    .map(metaRecord)
    .filter(
      (item) =>
        item.type === 'per-game' &&
        typeof item.id === 'string' &&
        /^[a-zA-Z0-9]+$/.test(item.id) &&
        typeof item.name === 'string',
    );
  const category = categories.find((item) => /^any\s*%$/i.test(String(item.name))) ?? categories[0];
  if (!category) return null;
  const board = await json(
    `https://www.speedrun.com/api/v1/leaderboards/${game.id}/category/${category.id}?top=1&embed=players`,
    signal,
  );
  const result = mapSpeedrunRecord(board, String(category.name), game.id, String(category.id));
  // Only trust an upstream webpage URL when it is an exact public Speedrun.com URL.
  const link = metaRecord(metaRecord(board).data).weblink;
  if (result && typeof link === 'string') {
    try {
      const url = new URL(link);
      if (
        url.protocol === 'https:' &&
        ['www.speedrun.com', 'speedrun.com'].includes(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        !hasUnsafeUrlCharacters(link)
      )
        result.speedrunUrl = url.href;
    } catch {
      /* Keep the safe API leaderboard link. */
    }
  }
  return result;
}
export const fetchGameMeta = unstable_cache(
  async (title: string): Promise<GameMetaReport> => {
    const empty: GameMetaReport = { duration: null, proton: null, speedrun: null };
    const clean = typeof title === 'string' ? title.trim().replace(/[\r\n\t]+/g, ' ') : '';
    if (!clean || clean.length > 200 || !normalizedMetaTitle(clean)) return empty;
    const [time, compatibility, record] = await Promise.allSettled([
      duration(clean),
      proton(clean),
      speedrun(clean),
    ]);
    return {
      duration: time.status === 'fulfilled' ? time.value : null,
      proton: compatibility.status === 'fulfilled' ? compatibility.value : null,
      speedrun: record.status === 'fulfilled' ? record.value : null,
    };
  },
  ['game-meta-v1'],
  { revalidate: 86400 },
);
