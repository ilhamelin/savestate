import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authenticated } from '@/lib/session';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid } from '@/domain/validation';
import { trackerForDisplay, validateItchEdits } from '@/domain/itch-tracker';
import { inspectItch } from '@/integrations/itch/server';
import { scheduleDiscordCheckpoint } from '@/services/discord';
import { revalidatePath } from 'next/cache';
function trackerAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new AppError('El tracker requiere la configuración de servidor de Supabase.', 503);
  return createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function check(error: { code?: string; message: string } | null) {
  if (error && ['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error.code ?? ''))
    throw new AppError('Aplica la migración 022 para activar Indie Tracker.', 503);
  dbCheck(error);
}
export async function itchTrackerList() {
  const { db, user } = await authenticated();
  const result = await db
    .from('itch_trackers')
    .select('*')
    .eq('user_id', user.id)
    .order('id')
    .limit(50);
  check(result.error);
  return (result.data ?? []).map(trackerForDisplay);
}
export async function itchTrackerMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  if (data.action === 'inspect') return inspectItch(data.url);
  if (data.action === 'add') {
    const metadata = await inspectItch(data.url);
    const result = await trackerAdmin()
      .from('itch_trackers')
      .insert({ user_id: user.id, url: metadata.url, metadata })
      .select('*')
      .single();
    check(result.error);
    revalidatePath('/players/[username]', 'page');
    return trackerForDisplay(result.data!);
  }
  const id = uuid(data.id);
  const owned = await db
    .from('itch_trackers')
    .select('*')
    .eq('user_id', user.id)
    .eq('id', id)
    .maybeSingle();
  check(owned.error);
  if (!owned.data) throw new AppError('Tracker no encontrado.', 404);
  if (data.action === 'save') {
    const result = await db
      .from('itch_trackers')
      .update(validateItchEdits(data))
      .eq('user_id', user.id)
      .eq('id', id)
      .select('*')
      .single();
    check(result.error);
    return trackerForDisplay(result.data!);
  }
  if (data.action === 'remove') {
    const result = await db.from('itch_trackers').delete().eq('id', id).eq('user_id', user.id);
    check(result.error);
    return { removed: true };
  }
  if (data.action !== 'check-updates') throw new AppError('Operación de tracker inválida.', 400);
  const admin = trackerAdmin();
  const slot = await admin.rpc('claim_itch_check', { p_id: id, p_user_id: user.id });
  check(slot.error);
  if (!slot.data) throw new AppError('Espera 30 segundos entre comprobaciones de este juego.', 429);
  const metadata = await inspectItch(owned.data.url);
  const applied = await admin.rpc('apply_itch_check', {
    p_id: id,
    p_user_id: user.id,
    p_metadata: metadata,
  });
  check(applied.error);
  if (applied.data && metadata.devlog)
    scheduleDiscordCheckpoint({
      type: 'itch',
      username: 'itch.io',
      details: `${metadata.title} · ${metadata.devlog.title}\nDevlog: ${metadata.devlog.url}\nDescargar desde la página oficial: ${metadata.url}`,
    });
  const refreshed = await db
    .from('itch_trackers')
    .select('*')
    .eq('user_id', user.id)
    .eq('id', id)
    .single();
  check(refreshed.error);
  revalidatePath('/notifications');
  return {
    tracker: trackerForDisplay(refreshed.data!),
    updated: applied.data,
    message: metadata.devlogAvailable
      ? applied.data
        ? 'Nuevo devlog detectado. Notificación enviada.'
        : 'No hay un devlog nuevo.'
      : 'El devlog no está disponible. Se conserva la última actualización conocida.',
  };
}
