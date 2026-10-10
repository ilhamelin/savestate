import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authenticated } from '@/lib/session';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid } from '@/domain/validation';
import { trackerForDisplay, validateItchEdits, type ItchTrackerRow } from '@/domain/itch-tracker';
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
    throw new AppError(
      'Aplica las migraciones 022 y 023 para activar Indie Tracker y su monitor.',
      503,
    );
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
  if (data.action === 'acknowledge-installer') {
    if (
      !Array.isArray(data.uploadIds) ||
      data.uploadIds.length > 100 ||
      data.uploadIds.some((id) => typeof id !== 'string' || !/^\d{1,20}$/.test(id))
    )
      throw new AppError('Identificadores de instalador inválidos.', 400);
    const result = await trackerAdmin().rpc('acknowledge_itch_installer', {
      p_id: id,
      p_user_id: user.id,
      p_upload_ids: [...new Set(data.uploadIds as string[])].sort(),
    });
    check(result.error);
    if (!result.data)
      throw new AppError(
        'El instalador cambió mientras lo confirmabas. Sincroniza y vuelve a intentarlo.',
        409,
      );
    const refreshed = await db
      .from('itch_trackers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    check(refreshed.error);
    return trackerForDisplay(refreshed.data!);
  }
  if (data.action !== 'check-updates') throw new AppError('Operación de tracker inválida.', 400);
  const admin = trackerAdmin();
  const result = await checkTracker(admin, owned.data);
  if (!result) throw new AppError('Espera 30 segundos entre comprobaciones de este juego.', 429);
  revalidatePath('/notifications');
  return result;
}
async function checkTracker(
  admin: ReturnType<typeof trackerAdmin>,
  row: ItchTrackerRow,
  announced?: Set<string>,
) {
  const slot = await admin.rpc('claim_itch_check', { p_id: row.id, p_user_id: row.user_id });
  check(slot.error);
  if (!slot.data) return null;
  const metadata = await inspectItch(row.url);
  const applied = await admin.rpc('apply_itch_check_v2', {
    p_id: row.id,
    p_user_id: row.user_id,
    p_metadata: metadata,
  });
  check(applied.error);
  const eventKey = `${metadata.url}:${applied.data?.reason}:${metadata.releaseDevlog?.url}:${metadata.downloads
    ?.map((item) => item.uploadId)
    .sort()
    .join(',')}`;
  if (applied.data?.updated && !announced?.has(eventKey)) {
    announced?.add(eventKey);
    scheduleDiscordCheckpoint({
      type: 'itch',
      username: 'itch.io',
      details: `${metadata.title} · ${applied.data.reason === 'installer' ? 'Nuevo archivo instalador subido a itch.io' : (metadata.releaseDevlog?.title ?? 'Nueva actualización')}\nDescargar desde la página oficial: ${metadata.url}`,
    });
  }
  const refreshed = await admin
    .from('itch_trackers')
    .select('*')
    .eq('user_id', row.user_id)
    .eq('id', row.id)
    .single();
  check(refreshed.error);
  return {
    tracker: trackerForDisplay(refreshed.data!),
    updated: applied.data?.updated ?? false,
    partial: !metadata.devlogAvailable || !metadata.downloadsAvailable,
    message: applied.data?.updated
      ? applied.data.reason === 'installer'
        ? 'Nuevo archivo instalador detectado. Alerta creada.'
        : 'Nueva versión detectada. Alerta creada.'
      : !metadata.devlogAvailable || !metadata.downloadsAvailable
        ? 'Comprobación parcial. Se conservan las fuentes que no están disponibles.'
        : 'Sin releases ni instaladores nuevos. Las noticias no activan la alarma.',
  };
}
export async function itchMonitorStatus() {
  const configured =
    process.env.VERCEL_ENV === 'production' && (process.env.CRON_SECRET?.length ?? 0) >= 32;
  if (!configured) return { configured: false, healthy: false, lastRunAt: null };
  const result = await trackerAdmin()
    .from('itch_monitor_state')
    .select('last_success_at,last_run_at')
    .eq('id', true)
    .single();
  return {
    configured,
    healthy:
      !result.error &&
      Boolean(
        result.data?.last_success_at &&
        Date.now() - Date.parse(result.data.last_success_at) < 26 * 3600000,
      ),
    lastRunAt: result.data?.last_run_at ?? null,
  };
}
export async function runItchMonitor() {
  const admin = trackerAdmin();
  const lease = await admin.rpc('claim_itch_monitor', {});
  check(lease.error);
  if (!lease.data) throw new AppError('Ya hay una comprobación automática en curso.', 409);
  const deadline = Date.now() + 250000;
  const dueBefore = new Date(Date.now() - 23 * 3600000).toISOString();
  const announced = new Set<string>();
  let checked = 0,
    updated = 0,
    failed = 0,
    remaining = 0,
    success = false;
  try {
    // Bounded batches keep requests modest and let the oldest unchecked rows run first.
    for (let batch = 0; batch < 100 && Date.now() < deadline; batch++) {
      const rows = await admin
        .from('itch_trackers')
        .select('*')
        .lte('last_checked_at', dueBefore)
        .order('last_checked_at')
        .order('id')
        .limit(3);
      check(rows.error);
      if (!rows.data?.length) break;
      const outcomes = await Promise.allSettled(
        rows.data.map((row) => checkTracker(admin, row, announced)),
      );
      for (const outcome of outcomes) {
        checked++;
        if (outcome.status === 'rejected') {
          failed++;
          console.warn('Indie monitor check failed');
        } else {
          if (outcome.value?.updated) updated++;
          if (outcome.value?.partial) failed++;
        }
      }
    }
    const count = await admin
      .from('itch_trackers')
      .select('id', { count: 'exact', head: true })
      .lte('last_checked_at', dueBefore);
    check(count.error);
    remaining = count.count ?? 0;
    success = failed === 0 && remaining === 0;
    return { checked, updated, failed, remaining, complete: success };
  } finally {
    const finished = await admin.rpc('finish_itch_monitor', {
      p_token: lease.data,
      p_success: success,
    });
    check(finished.error);
  }
}
