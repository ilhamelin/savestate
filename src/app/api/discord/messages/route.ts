import { authenticated } from '@/lib/session';
import { AppError, dbCheck, errorResponse, mutation } from '@/lib/http';
import { object } from '@/domain/validation';
import { privateDiscordAttachmentPath } from '@/domain/discord-private-access';
import { validateChatFile, chatFileSignature } from '@/domain/global-chat';
import { discordComposerPayload, discordSendOptions } from '@/domain/discord';
import { discordFrequency } from '@/domain/discord-channels';
import {
  discordConfigured,
  fetchDiscordMessages,
  fetchDiscordPresence,
  sendDiscordMessage,
  scheduleDiscordFreebies,
  discordPrivateChatAccess,
} from '@/services/discord';
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated();
    const channel = discordFrequency(
      new URL(request.url).searchParams.get('channel') ?? 'web-chat',
    );
    if (!channel) throw new AppError('Frecuencia de Discord no válida.', 400);
    const privateChatAccess = await discordPrivateChatAccess(db, user.id);
    if (channel === 'chat-privado' && !privateChatAccess.canRead)
      throw new AppError('No tienes acceso a esta frecuencia privada.', 403);
    const [messages, presence, profile] = await Promise.all([
      fetchDiscordMessages(30, channel),
      fetchDiscordPresence(),
      db.from('profiles').select('username').eq('id', user.id).single(),
    ]);
    if (channel === 'announcements') scheduleDiscordFreebies();
    return Response.json(
      {
        messages,
        presence,
        channel,
        viewerUsername: profile.data?.username ?? null,
        privateChatAccess,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      const { db, user } = await authenticated();
      const body = object(input);
      const channel = discordFrequency(body.channel ?? 'web-chat');
      if (channel !== 'web-chat' && channel !== 'chat-privado')
        throw new AppError('Esta frecuencia es de solo lectura.', 403);
      const privateChatAccess =
        channel === 'chat-privado' ? await discordPrivateChatAccess(db, user.id) : null;
      if (privateChatAccess && !privateChatAccess.canSend)
        throw new AppError('No tienes permiso para enviar a esta frecuencia privada.', 403);
      if (privateChatAccess && body.mediaUrl && !privateChatAccess.canAttach)
        throw new AppError(
          'No tienes permiso para adjuntar medios en esta frecuencia privada.',
          403,
        );
      const attachmentPath = privateDiscordAttachmentPath(body.privateAttachmentPath, user.id);
      if (attachmentPath && (channel !== 'chat-privado' || !privateChatAccess?.canAttach))
        throw new AppError('Adjunto privado no autorizado.', 403);
      const { content, mediaUrl } = discordComposerPayload(
        attachmentPath &&
          (body.content == null || (typeof body.content === 'string' && !body.content.trim()))
          ? '📎'
          : body.content,
        body.mediaUrl,
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        user.id,
      );
      const options = discordSendOptions(body);
      if (!discordConfigured())
        throw new AppError('El chat de Discord aún no está configurado.', 503);
      const profile = await db.from('profiles').select('username').eq('id', user.id).single();
      dbCheck(profile.error);
      if (!profile.data) throw new AppError('Perfil no encontrado.', 404);
      const slot = await db.rpc('claim_discord_message_slot');
      if (slot.error?.code === 'PGRST202')
        throw new AppError('Aplica la migración 021 para activar el envío a Discord.', 503);
      dbCheck(slot.error);
      if ((slot.data ?? 3) > 0)
        throw new AppError(`Espera ${slot.data ?? 3} segundos antes de enviar otro mensaje.`, 429);
      let attachment: { data: Blob; name: string } | undefined;
      if (attachmentPath) {
        const file = await db.storage.from('discord-private-media').download(attachmentPath);
        if (file.error || !file.data)
          throw new AppError('No se pudo leer el adjunto privado. Vuelve a subirlo.', 503);
        validateChatFile(file.data.size, file.data.type);
        if (
          !chatFileSignature(
            new Uint8Array(await file.data.slice(0, 12).arrayBuffer()),
            file.data.type,
          )
        )
          throw new AppError('El adjunto no contiene una imagen válida.', 400);
        attachment = { data: file.data, name: attachmentPath.split('/').at(-1)! };
      }
      const message = await sendDiscordMessage(
        profile.data.username,
        content,
        options,
        mediaUrl,
        channel,
        attachment,
      );
      if (attachmentPath)
        await db.storage
          .from('discord-private-media')
          .remove([attachmentPath])
          .catch(() => null);
      return { message };
    },
    8192,
  );
}
