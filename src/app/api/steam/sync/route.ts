import { mutation, errorResponse } from '@/lib/http';
import { steamQuickSync, steamSyncStatus } from '@/services/steam-sync';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const response = await mutation(request, steamQuickSync);
  if (response.status === 429) {
    const now = new Date();
    const reset = new Date(now);
    reset.setUTCHours(24, 0, 0, 0);
    response.headers.set(
      'Retry-After',
      String(Math.ceil((reset.getTime() - now.getTime()) / 1000)),
    );
  }
  return response;
}
export async function GET() {
  try {
    return Response.json(await steamSyncStatus(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
