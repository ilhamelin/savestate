import { timingSafeEqual } from 'node:crypto';
import { errorResponse, AppError } from '@/lib/http';
import { runItchMonitor } from '@/services/itch-tracker';

export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32)
      throw new AppError('El monitor automático aún no está configurado.', 503);
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(request.headers.get('authorization') ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new AppError('No autorizado.', 401);
    const result = await runItchMonitor();
    return Response.json(result, {
      status: result.complete ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
