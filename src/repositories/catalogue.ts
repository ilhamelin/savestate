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
export async function localCatalogue(filters: CatalogueFilters, igdbIds?: number[]) {
  const db = publicCatalogueClient();
  let query = db
    .from('games')
    .select('*')
    .order('release_year', { ascending: false, nullsFirst: false })
    .order('id');
  if (igdbIds) {
    if (!igdbIds.length) return [];
    query = query.in('igdb_id', igdbIds);
  } else {
    query = query.range(filters.offset, filters.offset + 23);
    if (filters.sort === 'classics') query = query.lt('release_year', 2010);
    if (filters.sort === 'recent') query = query.lte('release_year', new Date().getUTCFullYear());
  }
  // Remove PostgREST structural characters. External IGDB uses independently escaped strings.
  if (!igdbIds && filters.q) {
    const q = filters.q.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
    if (q)
      query = query.or(
        ['title', 'developer', 'publisher', 'series']
          .map((field) => `${field}.ilike.%${q}%`)
          .join(','),
      );
  }
  if (!igdbIds && filters.platform) query = query.contains('platforms', [filters.platform]);
  if (!igdbIds && filters.genre) query = query.contains('genres', [filters.genre]);
  if (!igdbIds && filters.year) query = query.eq('release_year', filters.year);
  const { data, error } = await query;
  dbCheck(error);
  const { data: stats, error: statsError } = data?.length
    ? await db.rpc('community_ratings', { p_game_ids: data.map((game) => game.id) })
    : { data: [], error: null };
  dbCheck(statsError);
  const byGame = new Map(stats?.map((stat) => [stat.game_id, stat]) ?? []);
  const ordered = igdbIds
    ? [...(data ?? [])].sort((a, b) => igdbIds.indexOf(a.igdb_id) - igdbIds.indexOf(b.igdb_id))
    : (data ?? []);
  const games = ordered.map((game) => ({
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
