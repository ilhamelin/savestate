import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv } from '@/lib/env';
import { authenticatedAdmin } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid } from '@/domain/validation';
import { configuredGateSecret } from '@/services/gatekeeper';
import { purgePlayerVault } from '@/services/r2';

function moderationClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('Falta la configuración administrativa del servidor.', 503);
  return createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Called only after validating a fresh TOTP; timestamp comparison prevents a concurrent lock being cleared.
export async function acknowledgePlayerGate(userId: string, lockedAt: string) {
  const { data, error } = await moderationClient().rpc('acknowledge_player_gate', {
    p_target_id: userId,
    p_locked_at: lockedAt,
  });
  dbCheck(error);
  if (!data) throw new AppError('El acceso cambió. Solicita una nueva clave de Guardian.', 409);
}

async function removeStoredFiles(
  db: ReturnType<typeof moderationClient>,
  userId: string,
  all: boolean,
) {
  const recent = await db
    .from('user_vault_media')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 310000).toISOString())
    .limit(1);
  dbCheck(recent.error);
  if (recent.data?.length)
    throw new AppError(
      'Hay subidas recientes en la bóveda. Espera cinco minutos antes de continuar.',
      409,
    );
  const vault = await db.from('user_vault_media').select('id').eq('user_id', userId).limit(1);
  dbCheck(vault.error);
  if (vault.data?.length || process.env.R2_ACCOUNT_ID) await purgePlayerVault(userId);
  if (!all) return;
  const buckets = await db.storage.listBuckets();
  dbCheck(buckets.error);
  async function removePrefix(bucket: string, prefix: string) {
    while (true) {
      const result = await db.storage.from(bucket).list(prefix, { limit: 100 });
      dbCheck(result.error);
      if (!result.data?.length) return;
      const files: string[] = [];
      for (const item of result.data) {
        if (!item.name || item.name.includes('/') || item.name === '.' || item.name === '..')
          throw new AppError('Ruta de almacenamiento inválida.', 503);
        const path = `${prefix}/${item.name}`;
        if (item.id) files.push(path);
        else await removePrefix(bucket, path);
      }
      if (files.length) dbCheck((await db.storage.from(bucket).remove(files)).error);
      // Empty folders are virtual and disappear after their last file is removed.
    }
  }
  for (const bucket of buckets.data ?? []) await removePrefix(bucket.id, userId);
}

export async function moderatePlayer(targetId: string, raw: unknown) {
  const admin = await authenticatedAdmin();
  const id = uuid(targetId).toLowerCase();
  if (id === admin.id.toLowerCase())
    throw new AppError('No puedes administrar tu propia cuenta.', 403);
  const input = object(raw);
  const action = input.action;
  if (!['lock', 'unlock', 'reset', 'delete'].includes(String(action)))
    throw new AppError('Acción no válida.', 400);
  const db = moderationClient();
  const target = await db
    .from('profiles')
    .select('id,username,level,access_locked,access_locked_at')
    .eq('id', id)
    .maybeSingle();
  dbCheck(target.error);
  if (!target.data) throw new AppError('No se encontró al jugador.', 404);
  if (action === 'reset' || action === 'delete') {
    if (input.confirmation !== target.data.username)
      throw new AppError('Escribe el nombre de usuario exacto para confirmar.', 400);
    await removeStoredFiles(db, id, action === 'delete');
    if (action === 'reset') {
      const reset = await db.rpc('reset_player_account', { p_target_id: id });
      dbCheck(reset.error);
      if (!reset.data) throw new AppError('El jugador ya no existe.', 409);
    } else {
      dbCheck((await db.auth.admin.deleteUser(id)).error);
    }
  } else {
    if (action === 'lock') configuredGateSecret();
    const result = await db
      .from('profiles')
      .update({
        access_locked: action === 'lock',
        access_locked_at: action === 'lock' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    dbCheck(result.error);
  }
  return { id, action };
}
