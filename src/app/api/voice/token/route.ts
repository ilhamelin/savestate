import { authenticated } from '@/lib/session';
import { AppError, body, dbCheck, errorResponse, sameOrigin } from '@/lib/http';
import { object } from '@/domain/validation';
import { createVoiceToken } from '@/services/voice';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { db, user } = await authenticated();
    sameOrigin(request);
    const input = object(await body(request, 1024));
    const profile = await db
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', user.id)
      .single();
    dbCheck(profile.error);
    if (!profile.data) throw new AppError('Perfil no encontrado.', 404);
    return Response.json(await createVoiceToken(input.channelId, profile.data), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
