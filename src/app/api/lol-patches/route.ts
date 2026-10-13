import { fetchLolPatches2026 } from '@/services/lol-patch-notes';
import { errorResponse } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return Response.json(await fetchLolPatches2026(), {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=900' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
