import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { dbCheck, AppError } from '@/lib/http';
import { XP_ACTIONS, type XpAction } from '@/domain/progression';
import { uuid } from '@/domain/validation';
import type { Database } from '@/lib/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scheduleDiscordCheckpoint } from '@/services/discord';

// This privileged client is confined to the XP RPC; caller identity comes from authenticated services.
export async function grantXp(
  userId: string,
  amount: number,
  action: XpAction,
  referenceId?: string,
) {
  uuid(userId);
  if (amount !== XP_ACTIONS[action] || !referenceId)
    throw new AppError('Evento de XP inválido.', 400);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('La progresión requiere configuración del servidor.', 503);
  const db = createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await db.rpc('award_xp', {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
    p_reference_id: referenceId,
  });
  if (result.error?.code === 'PGRST202')
    throw new AppError('Aplica la migración 017 para activar la progresión.', 503);
  dbCheck(result.error);
  if (result.data?.success && result.data.leveled_up && process.env.DISCORD_WEBHOOK_URL) {
    const profile = await db.from('profiles').select('username').eq('id', userId).maybeSingle();
    if (!profile.error && profile.data)
      scheduleDiscordCheckpoint({
        type: 'levelup',
        username: profile.data.username,
        details: `alcanzó el nivel ${result.data.level}.`,
        path: `/players/${encodeURIComponent(profile.data.username)}`,
      });
  }
  return result.data;
}
export async function grantCompletionXp(
  db: SupabaseClient<Database>,
  userId: string,
  gameId: string,
) {
  const result = await db
    .from('user_games')
    .select('id,status')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .single();
  dbCheck(result.error);
  const state = result.data?.status;
  if (state === 'cleared' || state === 'platinum') {
    const award = await grantXp(userId, XP_ACTIONS[state], state, gameId);
    if (state === 'platinum' && award?.success && process.env.DISCORD_WEBHOOK_URL) {
      const [profile, game, logs] = await Promise.all([
        db.from('profiles').select('username,library_private').eq('id', userId).maybeSingle(),
        db.from('games').select('title').eq('id', gameId).maybeSingle(),
        db.from('play_logs').select('hours_played').eq('user_game_id', result.data!.id),
      ]);
      if (
        !profile.error &&
        !game.error &&
        !logs.error &&
        profile.data &&
        !profile.data.library_private &&
        game.data
      )
        scheduleDiscordCheckpoint({
          type: 'platinum',
          username: profile.data.username,
          details: `platinó ${game.data.title} (${(logs.data ?? []).reduce((sum, log) => sum + Number(log.hours_played), 0).toFixed(2)} horas registradas).`,
          path: `/players/${encodeURIComponent(profile.data.username)}#achievements-showcase-heading`,
        });
    }
  }
}
export async function grantSessionXp(
  db: SupabaseClient<Database>,
  userId: string,
  entryId: string,
  logId: string,
  hours: number,
) {
  if (!(hours > 0)) return;
  const result = await db
    .from('user_games')
    .select('game_id')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single();
  dbCheck(result.error);
  if (result.data) await grantXp(userId, 10, 'session', `${result.data.game_id}:${logId}:${hours}`);
}
