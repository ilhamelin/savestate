import { getFollowedScreenRadar } from '@/services/screen';
import { authenticated } from '@/lib/session';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    await authenticated();
    const items = await getFollowedScreenRadar(
      new URL(request.url).searchParams.get('region') ?? 'CL',
    );
    return Response.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
