import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { authenticated, authenticatedAdmin } from '@/lib/session';
import { publicEnv } from '@/lib/env';
import { AppError, dbCheck } from '@/lib/http';
import type { Database } from '@/lib/database.types';
import {
  validateVaultFile,
  vaultHasSpace,
  vaultPublicUrl,
  VAULT_PUBLIC_ORIGIN,
  type VaultMedia,
} from '@/domain/vault';
import { uuid } from '@/domain/validation';

function configuration() {
  const {
    R2_ACCOUNT_ID: account,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET_NAME: bucket,
    R2_PUBLIC_URL: publicUrl,
  } = process.env;
  if (
    !account ||
    !/^[a-f\d]{32}$/.test(account) ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !publicUrl
  )
    throw new AppError('La bóveda R2 todavía no está configurada.', 503);
  return {
    bucket,
    publicUrl,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  };
}
// Administrative cleanup uses an immutable UUID prefix, never a client-supplied object key.
export async function purgePlayerVault(targetId: string) {
  const admin = await authenticatedAdmin();
  const id = uuid(targetId).toLowerCase();
  if (id === admin.id.toLowerCase())
    throw new AppError('No puedes eliminar tu propia bóveda desde Guardian.', 403);
  const { client, bucket } = configuration();
  const prefix = `${id}/`;
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    const objects = (page.Contents ?? []).map(({ Key }) => {
      if (!Key?.startsWith(prefix))
        throw new AppError('Objeto fuera de la bóveda del jugador.', 503);
      return { Key };
    });
    if (objects.length) {
      const deleted = await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }),
      );
      if (deleted.Errors?.length)
        throw new AppError(
          'No se pudo limpiar la bóveda. Reintenta antes de eliminar la cuenta.',
          503,
        );
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}
// Dedicated vault writer. Every caller must prove the session owner before obtaining it.
function vaultWriter() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('Falta la configuración del servidor de la bóveda.', 503);
  return createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function vaultItem(row: VaultMedia) {
  return {
    ...row,
    publicUrl: vaultPublicUrl(process.env.R2_PUBLIC_URL || VAULT_PUBLIC_ORIGIN, row.r2_key),
  };
}
export async function vaultSnapshot() {
  const { db, user } = await authenticated();
  const [rows, storage] = await Promise.all([
    db
      .from('user_vault_media')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000),
    db.rpc('get_user_vault_storage', { p_user_id: user.id }),
  ]);
  dbCheck(rows.error);
  dbCheck(storage.error);
  if (!storage.data?.[0]) throw new AppError('Aplica la migración 032 de la bóveda.', 503);
  const items = (rows.data ?? []).map(vaultItem);
  return {
    items: items.filter((item) => item.status === 'ready'),
    pending: items.filter((item) => item.status === 'pending'),
    storage: storage.data[0],
  };
}
export async function ownedVaultItem(id: unknown, readyOnly = false) {
  const { db, user } = await authenticated();
  const row = await db
    .from('user_vault_media')
    .select('*')
    .eq('id', uuid(id))
    .eq('user_id', user.id)
    .maybeSingle();
  dbCheck(row.error);
  if (!row.data || (readyOnly && row.data.status !== 'ready'))
    throw new AppError('Archivo de bóveda no encontrado.', 404);
  return row.data;
}
export async function generateVaultPresignedUploadUrl(
  userId: string,
  fileName: unknown,
  fileSize: unknown,
  mimeType: unknown,
) {
  const { user, db } = await authenticated();
  if (user.id !== userId) throw new AppError('Acceso denegado.', 403);
  const file = validateVaultFile(fileName, fileSize, mimeType);
  const config = configuration();
  const storage = await db.rpc('get_user_vault_storage', { p_user_id: user.id });
  dbCheck(storage.error);
  const quotaError = () =>
    new AppError('Cuota de almacenamiento excedida (100 MB). Libera espacio para continuar.', 403);
  if (!storage.data?.[0]) throw new AppError('Aplica la migración 032 de la bóveda.', 503);
  if (!vaultHasSpace(storage.data[0], file.fileSize)) throw quotaError();
  const r2Key = `${user.id}/${crypto.randomUUID()}-${file.fileName}`;
  const writer = vaultWriter();
  const reserved = await writer.rpc('reserve_vault_upload', {
    p_user_id: user.id,
    p_key: r2Key,
    p_name: file.fileName,
    p_size: file.fileSize,
    p_mime: file.mimeType,
  });
  if (reserved.error?.message.includes('VAULT_QUOTA_EXCEEDED')) throw quotaError();
  if (reserved.error?.message.includes('VAULT_ITEM_LIMIT'))
    throw new AppError('Máximo 1000 archivos por bóveda. Elimina alguno para continuar.', 403);
  dbCheck(reserved.error);
  if (!reserved.data) throw new AppError('No se pudo reservar la subida.', 503);
  try {
    const presignedUrl = await getSignedUrl(
      config.client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: r2Key,
        ContentType: file.mimeType,
        ContentLength: file.fileSize,
        IfNoneMatch: '*',
      }),
      {
        expiresIn: 300,
        signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']),
      },
    );
    return {
      id: reserved.data.id,
      presignedUrl,
      r2Key,
      publicUrl: vaultPublicUrl(config.publicUrl, r2Key),
      headers: { 'Content-Type': file.mimeType, 'If-None-Match': '*' },
    };
  } catch {
    await writer
      .from('user_vault_media')
      .delete()
      .eq('id', reserved.data.id)
      .eq('user_id', user.id);
    throw new AppError('No se pudo preparar la subida a R2.', 503);
  }
}
export async function confirmVaultUpload(id: unknown) {
  const row = await ownedVaultItem(id);
  if (row.status === 'ready') return vaultItem(row);
  const config = configuration();
  let head;
  try {
    head = await config.client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: row.r2_key }),
    );
  } catch {
    throw new AppError('El archivo aún no está en R2. Reintenta la confirmación.', 409);
  }
  if (head.ContentLength !== row.file_size || head.ContentType !== row.mime_type)
    throw new AppError(
      'El archivo subido no coincide con el tamaño y tipo autorizados. Elimina la subida.',
      400,
    );
  const result = await vaultWriter()
    .from('user_vault_media')
    .update({ status: 'ready' })
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .select('*')
    .maybeSingle();
  dbCheck(result.error);
  if (!result.data) throw new AppError('La subida ya fue eliminada.', 409);
  return vaultItem(result.data);
}
export async function deleteVaultObject(r2Key: string) {
  const { user, db } = await authenticated();
  const row = await db
    .from('user_vault_media')
    .select('*')
    .eq('r2_key', r2Key)
    .eq('user_id', user.id)
    .maybeSingle();
  dbCheck(row.error);
  if (!row.data) throw new AppError('Archivo de bóveda no encontrado.', 404);
  // Do not free quota while a signed PUT can still recreate this key.
  if (Date.now() - Date.parse(row.data.created_at) < 310000)
    throw new AppError(
      'La autorización de subida sigue activa. Podrás eliminar este archivo cinco minutos después de iniciar su subida.',
      409,
    );
  const config = configuration();
  await config.client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: r2Key }));
  const removed = await vaultWriter()
    .from('user_vault_media')
    .delete()
    .eq('id', row.data.id)
    .eq('user_id', user.id);
  dbCheck(removed.error);
}
