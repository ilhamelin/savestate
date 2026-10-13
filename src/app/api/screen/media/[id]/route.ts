import { screenDetailWithProgress } from '@/services/screen';
import { screenId, screenType } from '@/domain/screen';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    return Response.json(
      await screenDetailWithProgress(
        screenId(id),
        screenType(query.get('type') ?? 'tv'),
        query.get('region') ?? 'CL',
        Number(query.get('season') ?? 1),
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
