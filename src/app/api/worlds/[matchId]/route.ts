import { fetchWorldsMatchDetail } from '@/services/worlds-esports';
import { errorResponse } from '@/lib/http';
export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    return Response.json(await fetchWorldsMatchDetail(matchId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
