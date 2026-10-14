import { randomUUID } from 'node:crypto';
import { authenticated } from '@/lib/session';
import { AppError, mutation } from '@/lib/http';
import { object } from '@/domain/validation';
import { validateChatFile } from '@/domain/global-chat';
import { discordPrivateChatAccess } from '@/services/discord';
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      const { db, user } = await authenticated();
      const access = await discordPrivateChatAccess(db, user.id);
      if (!access.canAttach)
        throw new AppError('No tienes permiso para adjuntar archivos en esta frecuencia.', 403);
      const value = object(input);
      if (typeof value.size !== 'number' || typeof value.contentType !== 'string')
        throw new AppError('Archivo inválido.', 400);
      validateChatFile(value.size, value.contentType);
      const extension = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
      }[value.contentType];
      const path = `${user.id}/${randomUUID()}.${extension}`;
      const { data, error } = await db.storage
        .from('discord-private-media')
        .createSignedUploadUrl(path);
      if (error || !data)
        throw new AppError(
          'No se pudo autorizar el adjunto privado. Comprueba la migración 031.',
          503,
        );
      return { path, token: data.token, bucket: 'discord-private-media' };
    },
    2048,
  );
}
