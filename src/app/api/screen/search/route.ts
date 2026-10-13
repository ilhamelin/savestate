import { searchScreenMedia } from '@/services/screen';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(
      { items: await searchScreenMedia(params.get('q') ?? '', params.get('region') ?? 'CL') },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
