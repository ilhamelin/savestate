import { parseFilters } from '@/integrations/igdb/query';
import { catalogue } from '@/services/catalogue';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const result = await catalogue(parseFilters(new URL(request.url).searchParams));
    return Response.json(result, {
      headers: {
        // IGDB metadata has a 24h server cache; community scores must reflect privacy changes.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
