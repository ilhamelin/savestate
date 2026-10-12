'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bannerExtension } from '@/domain/banner-media';
import { readJsonResponse } from '@/lib/api-response';
type UploadedBanner = { url: string; path: string; contentType: string; token?: string };
export async function uploadProfileBanner(
  db: SupabaseClient,
  userId: string,
  blob: Blob,
): Promise<UploadedBanner> {
  const extension = bannerExtension(blob.type, blob.size),
    path = `${userId}/banner.${extension}`;
  const large = blob.size > 4 * 1024 * 1024;
  const form = new FormData();
  form.set('file', blob, `banner.${extension}`);
  let fallback = false;
  let response: Response | undefined;
  try {
    response = await fetch('/api/profile/banner', {
      method: 'POST',
      ...(large
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'prepare', contentType: blob.type, size: blob.size }),
          }
        : { body: form }),
    });
  } catch {
    fallback = true;
  }
  if (response) {
    fallback = [404, 413].includes(response.status) || response.status >= 500;
    if (!fallback) {
      const result = await readJsonResponse<UploadedBanner>(response);
      if (
        result.path !== path ||
        result.contentType !== blob.type ||
        typeof result.url !== 'string'
      )
        throw new Error('El servidor devolvió una respuesta incompleta.');
      if (large) {
        if (!result.token) throw new Error('No se pudo autorizar la subida del banner.');
        const uploaded = await db.storage
          .from('profiles')
          .uploadToSignedUrl(path, result.token, blob, {
            contentType: blob.type,
            cacheControl: '0',
          });
        if (uploaded.error)
          throw new Error('No se pudo subir el banner. Tu borrador sigue disponible.');
      }
      return result;
    }
  }
  const uploaded = await db.storage
    .from('profiles')
    .upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '0' });
  if (uploaded.error)
    throw new Error(
      'No se pudo subir el banner. Revisa la migración 027 y vuelve a guardar; tu borrador se conserva.',
    );
  return {
    url: `${db.storage.from('profiles').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`,
    path,
    contentType: blob.type,
  };
}
