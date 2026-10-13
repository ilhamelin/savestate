import { resolveSkinSpotlightVideo } from '@/services/lol-patch-notes';
import { errorResponse } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    return Response.json(
      await resolveSkinSpotlightVideo(new URL(request.url).searchParams.get('title') ?? ''),
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
