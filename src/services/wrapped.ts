import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { AppError, dbCheck } from '@/lib/http';
import { annualWrapped } from '@/domain/wrapped';
import type { Game, PlayLog } from '@/domain/model';

async function allRows<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; from < 50000; from += 500) {
    const result = await query(from, from + 499);
    dbCheck(result.error);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
  throw new AppError(
    'Este resumen supera el volumen disponible. No se mostrarán estadísticas parciales.',
    503,
  );
}
export async function playerWrapped(userId: string, year: number) {
  const db = await serverClient();
  const permission = await db.rpc('can_view_library', { owner_id: userId });
  dbCheck(permission.error);
  if (!permission.data) return null;
  const start = `${year}-01-01T00:00:00Z`,
    end = `${year + 1}-01-01T00:00:00Z`;
  const [entries, activities, posts] = await Promise.all([
    allRows((from, to) =>
      db.from('user_games').select('*').eq('user_id', userId).order('id').range(from, to),
    ),
    allRows((from, to) =>
      db
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'library_updated')
        .lt('created_at', end)
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
    allRows((from, to) =>
      db
        .from('posts')
        .select('id,title,created_at')
        .eq('user_id', userId)
        .eq('is_private', false)
        .gte('created_at', start)
        .lt('created_at', end)
        .order('id')
        .range(from, to),
    ),
  ]);
  const games: Game[] = [],
    logs: PlayLog[] = [];
  const gameIds = [
    ...new Set([
      ...entries.map((entry) => entry.game_id),
      ...activities.map((activity) => activity.target_game_id),
    ]),
  ];
  for (let index = 0; index < gameIds.length; index += 200) {
    const result = await db
      .from('games')
      .select('*')
      .in('id', gameIds.slice(index, index + 200));
    dbCheck(result.error);
    games.push(...(result.data ?? []));
  }
  for (let index = 0; index < entries.length; index += 200)
    logs.push(
      ...(await allRows((from, to) =>
        db
          .from('play_logs')
          .select('*')
          .in(
            'user_game_id',
            entries.slice(index, index + 200).map((entry) => entry.id),
          )
          .order('id')
          .range(from, to),
      )),
    );
  const summary = annualWrapped(year, entries, games, logs, activities);
  const counts = new Map<string, number>();
  for (let index = 0; index < posts.length; index += 200) {
    const reactions = await allRows((from, to) =>
      db
        .from('post_reactions')
        .select('post_id,user_id')
        .in(
          'post_id',
          posts.slice(index, index + 200).map((post) => post.id),
        )
        .order('post_id')
        .order('user_id')
        .range(from, to),
    );
    for (const reaction of reactions)
      counts.set(reaction.post_id, (counts.get(reaction.post_id) ?? 0) + 1);
  }
  const moment = [...posts].sort(
    (a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )[0];
  if (moment)
    summary.moment = { id: moment.id, title: moment.title, reactions: counts.get(moment.id) ?? 0 };
  return summary;
}
