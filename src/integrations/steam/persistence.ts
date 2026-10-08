import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv } from '@/lib/env';
import { AppError } from '@/lib/http';
import type { SteamGame } from '@/domain/steam';
// Restricted integration boundary: this client is never returned to a caller.
// The service authenticates the owner before submitting Valve's validated snapshot.
export async function applySteamSnapshot(userId: string, steamId: string, games: SteamGame[]) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('La sincronización requiere configuración de servidor.', 503);
  const db = createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return db
    .rpc('apply_steam_sync', {
      p_user_id: userId,
      p_steam_id: steamId,
      p_games: games.map(({ appid, minutes }) => ({ appid, minutes })),
    })
    .retry(false);
}
