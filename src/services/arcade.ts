import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { authenticated, currentUser } from '@/lib/session';
import { dbCheck, AppError } from '@/lib/http';
import { object, uuid } from '@/domain/validation';
import {
  partyInput,
  type DuelSummary,
  type PartyCardData,
  type PartyPlatform,
  type PartyStyle,
} from '@/domain/arcade';
export async function duelSummary(id?: string): Promise<DuelSummary | null> {
  const db = await serverClient();
  let query = db.from('game_duels').select('*').eq('is_active', true);
  if (id) query = query.eq('id', uuid(id));
  const duel = await query
    .order('created_at', { ascending: false })
    .order('id')
    .limit(1)
    .maybeSingle();
  dbCheck(duel.error);
  if (!duel.data) return null;
  const row = duel.data,
    user = await currentUser();
  const [games, totals, own] = await Promise.all([
    db.from('games').select('id,title,slug,cover_url').in('id', [row.game_a_id, row.game_b_id]),
    db.rpc('duel_results', { p_duel_id: row.id }),
    user
      ? db
          .from('duel_votes')
          .select('chosen_game_id')
          .eq('duel_id', row.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  [games, totals, own].forEach((result) => dbCheck(result.error));
  return {
    duel: row,
    games: games.data ?? [],
    votes: Object.fromEntries((totals.data ?? []).map((v) => [v.chosen_game_id, Number(v.total)])),
    ownVote: own.data?.chosen_game_id ?? null,
  };
}
export async function arcadeMutation(input: unknown) {
  const { db, user } = await authenticated(),
    data = object(input);
  if (data.action !== 'vote') throw new AppError('Acción inválida.', 400);
  const duelId = uuid(data.duel_id),
    gameId = uuid(data.game_id);
  const result = await db
    .from('duel_votes')
    .insert({ duel_id: duelId, user_id: user.id, chosen_game_id: gameId });
  // Retries of the same vote are safe. A different second vote is rejected.
  if (result.error?.code === '23505') {
    const own = await db
      .from('duel_votes')
      .select('chosen_game_id')
      .eq('duel_id', duelId)
      .eq('user_id', user.id)
      .single();
    dbCheck(own.error);
    if (own.data?.chosen_game_id !== gameId) throw new AppError('Ya votaste en este duelo.', 409);
  } else dbCheck(result.error);
  return duelSummary(duelId);
}
export async function partyMutation(input: unknown) {
  const { db, user } = await authenticated(),
    data = object(input);
  if (data.action === 'delete') {
    const result = await db
      .from('party_requests')
      .delete()
      .eq('id', uuid(data.id))
      .eq('user_id', user.id)
      .select('id');
    dbCheck(result.error);
    if (!result.data?.length) throw new AppError('Convocatoria no encontrada.', 404);
    return { deleted: true };
  }
  if (data.action !== 'create') throw new AppError('Acción inválida.', 400);
  const result = await db.from('party_requests').insert({ ...partyInput(data), user_id: user.id });
  dbCheck(result.error);
  return { created: true };
}
export async function partyFeed(filters: {
  platform?: PartyPlatform;
  playstyle?: PartyStyle;
  page: number;
}) {
  const db = await serverClient();
  const generatedAt = Date.now();
  let query = db
    .from('party_requests')
    .select('*')
    .gt('expires_at', new Date(generatedAt).toISOString());
  if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.playstyle) query = query.eq('playstyle', filters.playstyle);
  const result = await query
    .order('created_at', { ascending: false })
    .order('id')
    .range((filters.page - 1) * 12, filters.page * 12);
  dbCheck(result.error);
  const rows = (result.data ?? []).slice(0, 12);
  if (!rows.length) return { items: [], hasMore: false, generatedAt };
  const [games, authors] = await Promise.all([
    db
      .from('games')
      .select('id,title,slug,cover_url')
      .in('id', [...new Set(rows.map((r) => r.game_id))]),
    db
      .from('profiles')
      .select('id,username,avatar_url,level')
      .in('id', [...new Set(rows.map((r) => r.user_id))]),
  ]);
  dbCheck(games.error);
  dbCheck(authors.error);
  const gameMap = new Map(games.data?.map((g) => [g.id, g])),
    authorMap = new Map(authors.data?.map((a) => [a.id, a]));
  const items: PartyCardData[] = [];
  for (const row of rows) {
    const game = gameMap.get(row.game_id),
      author = authorMap.get(row.user_id);
    if (game && author) items.push({ ...row, game, author });
  }
  return { items, hasMore: (result.data?.length ?? 0) > 12, generatedAt };
}
