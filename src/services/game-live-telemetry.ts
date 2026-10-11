import 'server-only';
import { unstable_cache } from 'next/cache';
import { twitchAccessToken } from '@/integrations/igdb/server';
import {
  mapDeals,
  mapStreams,
  mapHistoricalLow,
  nonnegative,
  record,
  type GameLiveTelemetry,
} from '@/domain/game-live-telemetry';
export type {
  GameDealItem,
  TwitchStreamItem,
  GameLiveTelemetry,
} from '@/domain/game-live-telemetry';
async function json(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SaveState/1.0 (+https://savestate.app)', ...headers },
    signal: AbortSignal.timeout(4500),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Telemetry unavailable');
  return (await response.json()) as unknown;
}
export const fetchGameLiveTelemetry = unstable_cache(
  async (title: string): Promise<GameLiveTelemetry> => {
    const result: GameLiveTelemetry = {
      steamAppId: null,
      steamCurrentPlayers: null,
      historicalLow: null,
      deals: [],
      twitchStreams: [],
      twitchTotalTopViewers: 0,
    };
    const steam = (async () => {
      const data = record(
        await json(
          `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=US`,
        ),
      );
      const first = record(Array.isArray(data.items) ? data.items[0] : null);
      // Avoid attaching another game's prices or player count to a fuzzy first result.
      const normalized = (name: string) =>
        name.normalize('NFKC').replace(/[™®©]/g, '').toLowerCase().trim();
      result.steamAppId =
        normalized(String(first.name ?? '')) === normalized(title) &&
        Number.isSafeInteger(first.id) &&
        Number(first.id) > 0
          ? Number(first.id)
          : null;
      return result.steamAppId;
    })().catch(() => null);
    await Promise.allSettled([
      (async () => {
        const id = await steam;
        if (id)
          result.steamCurrentPlayers = nonnegative(
            record(
              record(
                await json(
                  `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${id}`,
                ),
              ).response,
            ).player_count,
          );
      })(),
      (async () => {
        const id = await steam;
        const data = await json(
          `https://www.cheapshark.com/api/1.0/deals?${id ? `steamAppID=${id}` : `title=${encodeURIComponent(title)}&exact=1`}&pageSize=6`,
        );
        result.deals = mapDeals(data);
        const first = record(Array.isArray(data) ? data[0] : null);
        if (typeof first.gameID === 'string')
          result.historicalLow = mapHistoricalLow(
            await json(
              `https://www.cheapshark.com/api/1.0/games?id=${encodeURIComponent(first.gameID)}`,
            ),
          );
      })(),
      (async () => {
        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return;
        const token = await twitchAccessToken();
        const headers = {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        };
        const games = record(
          await json(
            `https://api.twitch.tv/helix/games?name=${encodeURIComponent(title)}`,
            headers,
          ),
        );
        const game = record(Array.isArray(games.data) ? games.data[0] : null);
        if (typeof game.id !== 'string') return;
        const streams = record(
          await json(
            `https://api.twitch.tv/helix/streams?game_id=${encodeURIComponent(game.id)}&first=4`,
            headers,
          ),
        );
        result.twitchStreams = mapStreams(streams.data);
        result.twitchTotalTopViewers = result.twitchStreams.reduce(
          (sum, stream) => sum + stream.viewerCount,
          0,
        );
      })(),
    ]);
    return result;
  },
  ['game-live-telemetry-v1'],
  { revalidate: 300 },
);
