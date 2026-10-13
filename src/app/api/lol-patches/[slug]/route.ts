import { fetchLolPatchDetail } from '@/services/lol-patch-notes';
import { errorResponse } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    return Response.json(
      { patch: await fetchLolPatchDetail(slug) },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=1800' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
