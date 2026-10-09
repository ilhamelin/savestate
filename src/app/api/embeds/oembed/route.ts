import { fetchSocialEmbed } from '@/services/embeds';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    return Response.json(
      await fetchSocialEmbed(new URL(request.url).searchParams.get('url') ?? ''),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
