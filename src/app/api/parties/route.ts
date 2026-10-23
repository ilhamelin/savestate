import { partyFeed, partyMutation } from '@/services/arcade';
import { partyFeedFilters } from '@/domain/arcade';
import { errorResponse, mutation } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const feed = await partyFeed(partyFeedFilters(new URL(request.url).searchParams));
    return Response.json({ data: feed }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, partyMutation);
}
