import { timingSafeEqual } from 'node:crypto';
import { AppError, errorResponse } from '@/lib/http';
import { retrySupportQueue } from '@/services/jira-support-service';
export const runtime = 'nodejs';
export const maxDuration = 40;
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) throw new AppError('Cron de soporte sin configurar.', 503);
    const actual = Buffer.from(request.headers.get('authorization') ?? '');
    const expected = Buffer.from('Bearer ' + secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new AppError('No autorizado.', 401);
    return Response.json(await retrySupportQueue(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
