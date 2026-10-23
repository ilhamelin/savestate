import { authenticatedAdmin } from '@/lib/session';
import { errorResponse } from '@/lib/http';
import { fetchCloudObserverFeed } from '@/services/cloud-observer-service';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function GET() {
  try {
    await authenticatedAdmin();
    return Response.json(await fetchCloudObserverFeed(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
