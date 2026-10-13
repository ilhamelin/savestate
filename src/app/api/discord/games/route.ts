import { authenticated } from '@/lib/session';
import { dbCheck, errorResponse } from '@/lib/http';
import { text } from '@/domain/validation';
export async function GET(request: Request) {
  try {
    const { db } = await authenticated();
    const query = text(new URL(request.url).searchParams.get('q'), 'Búsqueda', 80, 2);
    const literal = query.replace(/[\\%_]/g, '\\$&');
    const result = await db
      .from('games')
      .select('id,title,slug')
      .ilike('title', `%${literal}%`)
      .order('title')
      .limit(6)
      .abortSignal(request.signal);
    dbCheck(result.error);
    return Response.json(
      { games: result.data ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
