import { getScreenTrending } from '@/services/screen';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(
      {
        items: await getScreenTrending(
          params.get('filter') ?? 'popular',
          params.get('region') ?? 'CL',
        ),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
