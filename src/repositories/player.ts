import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck } from '@/lib/http';
export async function libraryHoursFor(userId: string) {
  const db = await serverClient();
  let total = 0;
  // Page every log, including games outside the visible 500-entry library window.
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .from('play_logs')
      .select('hours_played,user_games!inner(user_id)')
      .eq('user_games.user_id', userId)
      .order('id')
      .range(offset, offset + 999);
    dbCheck(result.error);
    for (const log of result.data ?? []) total += Math.round(Number(log.hours_played) * 100);
    if ((result.data?.length ?? 0) < 1000) break;
  }
  return total / 100;
}
export async function libraryFor(userId: string) {
  const db = await serverClient();
  const {
    data: rows,
    error,
    count,
  } = await db
    .from('user_games')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(500);
  dbCheck(error);
  const { data: favorites, error: favoriteError } = await db
    .from('user_games')
    .select('*')
    .eq('user_id', userId)
    .not('favorite_position', 'is', null)
    .order('favorite_position');
  dbCheck(favoriteError);
  const entries = [
    ...new Map([...(rows ?? []), ...(favorites ?? [])].map((entry) => [entry.id, entry])).values(),
  ];
  const ids = entries.map((row) => row.id),
    gameIds = entries.map((row) => row.game_id);
  if (!entries.length) return { entries: [], games: [], logs: [], reviews: [], count: count ?? 0 };
  const [games, logs, reviews] = await Promise.all([
    db.from('games').select('*').in('id', gameIds),
    db
      .from('play_logs')
      .select('*')
      .in('user_game_id', ids)
      .order('created_at', { ascending: false }),
    db.from('reviews').select('*').in('user_game_id', ids),
  ]);
  dbCheck(games.error);
  dbCheck(logs.error);
  dbCheck(reviews.error);
  return {
    entries,
    games: games.data ?? [],
    logs: logs.data ?? [],
    reviews: reviews.data ?? [],
    count: count ?? 0,
  };
}
export async function profileByName(name: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('username_normalized', name.toLowerCase())
    .maybeSingle();
  dbCheck(error);
  return data;
}
