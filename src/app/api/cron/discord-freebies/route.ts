import { timingSafeEqual } from 'node:crypto';
import { AppError, errorResponse } from '@/lib/http';
import { announceNewFreebiesToDiscord, announceGta6CountdownToDiscord } from '@/services/discord';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32)
      throw new AppError('El cron de juegos gratis no está configurado.', 503);
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(request.headers.get('authorization') ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new AppError('No autorizado.', 401);
    const [freebies, gta6] = await Promise.allSettled([
      announceNewFreebiesToDiscord(),
      announceGta6CountdownToDiscord(),
    ]);
    if (freebies.status === 'rejected') throw freebies.reason;
    if (gta6.status === 'rejected') throw gta6.reason;
    return Response.json(
      { ...freebies.value, gta6: gta6.value },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export const POST = GET;
