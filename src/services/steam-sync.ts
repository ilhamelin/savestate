import 'server-only';
import { authenticated } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object } from '@/domain/validation';
import { steamSyncQuota, type SteamSyncState } from '@/domain/steam-sync';
import { ownedSteamLibrary } from '@/integrations/steam/server';
import { applySteamSnapshot } from '@/integrations/steam/persistence';

export async function steamSyncStatus(): Promise<SteamSyncState> {
  const { db, user } = await authenticated();
  const result = await db
    .from('profiles')
    .select('steam_id,steam_sync_count,steam_last_sync_at')
    .eq('id', user.id)
    .single();
  const configured = Boolean(process.env.STEAM_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (result.error?.code === '42703' || result.error?.code === 'PGRST204')
    return {
      linked: false,
      ...steamSyncQuota(0, null),
      configured,
      available: false,
      message: 'Aplica la migración 014 para activar la sincronización rápida.',
    };
  dbCheck(result.error);
  if (!result.data) throw new AppError('Perfil no encontrado.', 404);
  return {
    linked: Boolean(result.data.steam_id),
    ...steamSyncQuota(result.data.steam_sync_count, result.data.steam_last_sync_at),
    configured,
    available: true,
    message: configured
      ? null
      : 'La sincronización requiere STEAM_API_KEY y la configuración de Supabase en el servidor.',
  };
}
export async function steamQuickSync(input: unknown) {
  object(input);
  const { db, user } = await authenticated();
  if (!process.env.STEAM_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new AppError(
      'La sincronización requiere STEAM_API_KEY y la configuración de Supabase en el servidor.',
      503,
    );
  const profile = await db.from('profiles').select('steam_id').eq('id', user.id).single();
  dbCheck(profile.error);
  if (!profile.data?.steam_id)
    throw new AppError('Vincula una cuenta desde el importador de Steam.', 400);
  // A lost response must not cause an automatic second quota consumption.
  const claim = await db.rpc('claim_steam_sync_slot').retry(false);
  if (claim.error?.code === 'PGRST202')
    throw new AppError('Aplica la migración 014 para activar la sincronización rápida.', 503);
  dbCheck(claim.error);
  const slot = claim.data?.[0];
  if (!slot) throw new AppError('No se pudo verificar la cuota diaria.', 503);
  if (!slot.allowed) throw new AppError(slot.message, 429);
  const snapshot = await ownedSteamLibrary(profile.data.steam_id);
  const updated = await applySteamSnapshot(user.id, snapshot.steamid, snapshot.games);
  if (updated.error?.message === 'Steam account changed')
    throw new AppError(
      'La cuenta de Steam cambió durante la sincronización. Revisa la cuenta vinculada.',
      409,
    );
  dbCheck(updated.error);
  const result = updated.data?.[0];
  if (!result) throw new AppError('No se pudo confirmar la actualización de horas.', 503);
  const state = await steamSyncStatus();
  return {
    success: true,
    updatedCount: result.updated_count,
    hoursAdded: Number(result.hours_added),
    remainingSlots: state.remainingSlots,
    resetAt: state.resetAt,
  };
}
