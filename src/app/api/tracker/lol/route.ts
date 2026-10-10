import { authenticated } from '@/lib/session';
import { body, errorResponse, sameOrigin } from '@/lib/http';
import { object } from '@/domain/validation';
import { inspectLol, RiotRateLimitError } from '@/integrations/riot/server';

export const runtime = 'nodejs';
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    await authenticated();
    sameOrigin(request);
    const input = object(await body(request, 2048));
    const data = await inspectLol(input.riotId, input.platform);
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof RiotRateLimitError)
      response.headers.set('Retry-After', String(error.retryAfter));
    return response;
  }
}
