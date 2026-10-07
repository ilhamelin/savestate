import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import type { CatalogueFilters } from '@/integrations/igdb/query';
import { dbCheck } from '@/lib/http';
export function publicCatalogueClient() {
  const { url, key } = publicEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function localCatalogue(filters: CatalogueFilters) {
  const db = publicCatalogueClient();
  let query = db
    .from('games')
    .select('*')
    .order('release_year', { ascending: false, nullsFirst: false })
    .limit(24);
  // Remove PostgREST structural characters. External IGDB uses independently escaped strings.
  if (filters.q) {
    const q = filters.q.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
    if (q)
      query = query.or(
        ['title', 'developer', 'publisher', 'series']
          .map((field) => `${field}.ilike.%${q}%`)
          .join(','),
      );
  }
  if (filters.platform) query = query.contains('platforms', [filters.platform]);
  if (filters.genre) query = query.contains('genres', [filters.genre]);
  if (filters.year) query = query.eq('release_year', filters.year);
  const { data, error } = await query;
  dbCheck(error);
  const { data: stats, error: statsError } = data?.length
    ? await db.rpc('community_ratings', { p_game_ids: data.map((game) => game.id) })
    : { data: [], error: null };
  dbCheck(statsError);
  const byGame = new Map(stats?.map((stat) => [stat.game_id, stat]) ?? []);
  const games = (data ?? []).map((game) => ({
    ...game,
    community_rating: byGame.get(game.id)?.average ?? null,
    rating_count: byGame.get(game.id)?.total ?? 0,
  }));
  return filters.minRating
    ? games.filter(
        (game) => game.community_rating !== null && game.community_rating >= filters.minRating!,
      )
    : games;
}
