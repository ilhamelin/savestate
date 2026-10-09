import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { dbCheck, AppError } from '@/lib/http';
import { XP_ACTIONS, type XpAction } from '@/domain/progression';
import { uuid } from '@/domain/validation';
import type { Database } from '@/lib/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  return result.data;
}
export async function grantCompletionXp(
  db: SupabaseClient<Database>,
  userId: string,
  gameId: string,
) {
  const result = await db
    .from('user_games')
    .select('status')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .single();
  dbCheck(result.error);
  const state = result.data?.status;
  if (state === 'cleared' || state === 'platinum')
    await grantXp(userId, XP_ACTIONS[state], state, gameId);
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
