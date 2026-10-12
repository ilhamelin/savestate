import { createClient } from '@supabase/supabase-js';
import { authenticated } from '@/lib/session';
import { publicEnv } from '@/lib/env';
import { AppError, body, errorResponse, sameOrigin } from '@/lib/http';
import {
  bannerExtension,
  BANNER_MIME_EXTENSIONS,
  MAX_BANNER_BYTES,
  BANNER_MEDIA_ERROR,
} from '@/domain/banner-media';
export const runtime = 'nodejs';
async function boundedFormData(request: Request) {
  const limit = MAX_BANNER_BYTES + 65536;
  if (Number(request.headers.get('content-length')) > limit)
    throw new AppError(BANNER_MEDIA_ERROR, 413);
  const reader = request.body?.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  if (reader)
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) {
          await reader.cancel();
          throw new AppError(BANNER_MEDIA_ERROR, 413);
        }
        parts.push(new Uint8Array(value));
      }
    } finally {
      reader.releaseLock();
    }
  try {
    return await new Response(new Blob(parts), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    throw new AppError('Formulario de banner inválido.', 400);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticated();
    let file: File | null = null;
    let mimeType: string;
    let size: number;
    if (request.headers.get('content-type')?.includes('application/json')) {
      const input = await body(request, 4096);
      if (
        !input ||
        typeof input !== 'object' ||
        !('action' in input) ||
        input.action !== 'prepare' ||
        !('contentType' in input) ||
        typeof input.contentType !== 'string' ||
        !('size' in input) ||
        typeof input.size !== 'number'
      )
        throw new AppError('Solicitud de banner inválida.', 400);
      mimeType = input.contentType;
      size = input.size;
    } else {
      const entry = (await boundedFormData(request)).get('file');
      if (!(entry instanceof File)) throw new AppError(BANNER_MEDIA_ERROR, 400);
      file = entry;
      mimeType = file.type;
      size = file.size;
    }
    let extension: string;
    try {
      extension = bannerExtension(mimeType, size);
    } catch {
      throw new AppError(BANNER_MEDIA_ERROR, 400);
    }
    const path = `${user.id}/banner.${extension}`;
    // Service credentials remain in this authenticated endpoint, restricted to profiles/user/banner.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const storage = key
      ? createClient(publicEnv().url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        }).storage
      : db.storage;
    if (key) {
      const configured = await storage.updateBucket('profiles', {
        public: true,
        fileSizeLimit: MAX_BANNER_BYTES,
        allowedMimeTypes: Object.keys(BANNER_MIME_EXTENSIONS),
      });
      if (configured.error) throw new AppError('No se pudo configurar la subida del banner.', 503);
    }
    const bucket = storage.from('profiles');
    const url = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    if (!file) {
      // Large files go straight to Storage: Vercel Functions accept at most 4.5 MB.
      const signed = await bucket.createSignedUploadUrl(path, { upsert: true });
      if (signed.error || !signed.data)
        throw new AppError('No se pudo autorizar la subida del banner.', 503);
      return Response.json(
        { url, path, contentType: mimeType, token: signed.data.token },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    const uploaded = await bucket.upload(path, file, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '0',
    });
    if (uploaded.error) throw new AppError('No se pudo subir el banner. Reintenta guardar.', 503);
    return Response.json(
      { url, path, contentType: mimeType },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
