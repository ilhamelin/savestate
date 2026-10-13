import 'server-only';
import { randomUUID } from 'node:crypto';
import { publicClient } from '@/integrations/supabase/public';
import { authenticated } from '@/lib/session';
import { publicEnv } from '@/lib/env';
import { AppError, dbCheck } from '@/lib/http';
import { uuid, ValidationError } from '@/domain/validation';
import {
  chatCursor,
  chatFileSignature,
  detectMediaType,
  safeChatMediaUrl,
  validateChatFile,
  validateChatMessagePayload,
  type GlobalChatMessage,
  type GlobalChatRow,
} from '@/domain/global-chat';

const selection = '*, profiles(id, username, avatar_url)' as const;
function normalize(
  row: GlobalChatRow & {
    profiles: { id: string; username: string; avatar_url: string | null } | null;
  },
): GlobalChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    mediaUrl: safeChatMediaUrl(row.media_url, publicEnv().url),
    mediaType: row.media_type,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.profiles?.username ?? 'jugador',
      avatarUrl: row.profiles?.avatar_url ?? null,
    },
  };
}
export async function listGlobalChatMessages({
  before,
  limit = 50,
}: { before?: string; limit?: number } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ValidationError('El límite debe estar entre 1 y 50.');
  const cursor = chatCursor(before);
  let query = publicClient()
    .from('global_chat_messages')
    .select(selection)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursor?.id)
    query = query.or(
      `created_at.lt.${cursor.date},and(created_at.eq.${cursor.date},id.lt.${cursor.id})`,
    );
  else if (cursor) query = query.lt('created_at', cursor.date);
  const { data, error } = await query;
  dbCheck(error);
  const rows = (data ?? []).slice(0, limit);
  const last = rows.at(-1);
  return {
    messages: rows.map(normalize).reverse(),
    nextCursor: data && data.length > limit && last ? `${last.created_at}|${last.id}` : null,
  };
}
export async function globalChatMessage(id: string) {
  const { data, error } = await publicClient()
    .from('global_chat_messages')
    .select(selection)
    .eq('id', uuid(id))
    .maybeSingle();
  dbCheck(error);
  if (!data) throw new AppError('Mensaje no encontrado.', 404);
  return normalize(data);
}
export async function postGlobalChatMessage(input: unknown) {
  const { db, user } = await authenticated();
  const payload = validateChatMessagePayload(input, user.id, publicEnv().url);
  const { data, error } = await db
    .from('global_chat_messages')
    .insert(payload)
    .select(selection)
    .single();
  if (error?.code === 'P0001' && error.message.includes('global_chat_rate_limit'))
    throw new AppError('Espera 1,5 segundos antes de enviar otro mensaje.', 429);
  dbCheck(error);
  if (!data) throw new AppError('No se pudo enviar el mensaje.', 503);
  return normalize(data);
}
export async function prepareChatMedia(size: number, mime: string) {
  const { db, user } = await authenticated();
  validateChatFile(size, mime);
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[
    mime
  ];
  const path = `${user.id}/${Date.now()}_${randomUUID()}.${ext}`;
  const bucket = db.storage.from('chat-media');
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) throw new AppError('No se pudo autorizar el archivo.', 503);
  return {
    path,
    token: data.token,
    url: bucket.getPublicUrl(path).data.publicUrl,
    mediaType: detectMediaType(mime),
  };
}
export async function uploadChatMedia(file: File, userId: string) {
  const { db, user } = await authenticated();
  if (userId !== user.id) throw new AppError('Archivo no autorizado.', 403);
  validateChatFile(file.size, file.type);
  if (!chatFileSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type))
    throw new ValidationError('El contenido no corresponde a una imagen válida.');
  const prepared = await prepareChatMedia(file.size, file.type);
  const { error } = await db.storage
    .from('chat-media')
    .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
  if (error) throw new AppError('No se pudo subir la imagen.', 503);
  return { url: prepared.url, mediaType: prepared.mediaType };
}
