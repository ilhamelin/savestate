import { authenticated } from '@/lib/session';
import { AppError, dbCheck, errorResponse, mutation } from '@/lib/http';
import { object } from '@/domain/validation';
import { discordContent } from '@/domain/discord';
import { discordConfigured, fetchDiscordMessages, sendDiscordMessage } from '@/services/discord';
export async function GET() {
  try {
    await authenticated();
    return Response.json(
      { messages: await fetchDiscordMessages() },
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
      const content = discordContent(object(input).content);
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
      return { message: await sendDiscordMessage(profile.data.username, content) };
    },
    4096,
  );
}
