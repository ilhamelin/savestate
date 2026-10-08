import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck, AppError } from '@/lib/http';
import { profileDossier } from '@/domain/dossier';
async function pages<T>(
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
    'El dossier supera el volumen disponible. No se mostrarán métricas parciales.',
    503,
  );
}
export async function dossierFor(userId: string) {
  const db = await serverClient();
  const access = await db.rpc('can_view_library', { owner_id: userId });
  dbCheck(access.error);
  if (!access.data) return null;
  const [entries, logs] = await Promise.all([
    pages((from, to) =>
      db.from('user_games').select('id,status').eq('user_id', userId).order('id').range(from, to),
    ),
    pages((from, to) =>
      db
        .from('play_logs')
        .select(
          'user_game_id,hours_played,platform_played,play_method,start_date,finish_date,user_games!inner(user_id)',
        )
        .eq('user_games.user_id', userId)
        .order('id')
        .range(from, to),
    ),
  ]);
  return profileDossier(entries, logs);
}
