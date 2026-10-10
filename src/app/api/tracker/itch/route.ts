import { mutation, errorResponse } from '@/lib/http';
import { itchTrackerList, itchTrackerMutation, itchMonitorStatus } from '@/services/itch-tracker';
export async function GET() {
  try {
    return Response.json(
      { trackers: await itchTrackerList(), monitor: await itchMonitorStatus() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, itchTrackerMutation);
}
