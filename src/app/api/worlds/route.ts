import { fetchWorldsSchedule } from '@/services/worlds-esports';
import { errorResponse } from '@/lib/http';
export async function GET() {
  try {
    return Response.json(await fetchWorldsSchedule(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
