import { authenticated } from '@/lib/session';
import { dbCheck, errorResponse, AppError } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated();
    const params = new URL(request.url).searchParams;
    const query = (params.get('q') ?? '').trim();
    const offset = Number(params.get('offset') ?? 0);
    if (query.length > 80 || !Number.isInteger(offset) || offset < 0 || offset > 50000)
      throw new AppError('Búsqueda inválida.', 400);
    let selection = db
      .from('user_games')
      .select('game:games!inner(id,title,cover_url)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('title', { referencedTable: 'games' })
      .order('id');
    if (query) selection = selection.ilike('games.title', `%${query.replace(/[\\%_]/g, '\\$&')}%`);
    const { data, error, count } = await selection.range(offset, offset + 23);
    dbCheck(error);
    return Response.json(
      {
        games: (data ?? []).map((row) => row.game),
        nextOffset: offset + 24 < (count ?? 0) ? offset + 24 : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
