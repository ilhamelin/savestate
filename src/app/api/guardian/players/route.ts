import { authenticatedAdmin } from '@/lib/session';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck, errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    await authenticatedAdmin();
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    const page = Math.max(0, Math.min(10000, Number(url.searchParams.get('page')) || 0));
    const db = await serverClient();
    let query = db
      .from('profiles')
      .select(
        'id,username,avatar_url,level,terminal_status,created_at,access_locked,access_locked_at',
        { count: 'exact' },
      );
    if (q) query = query.ilike('username', `%${q.replace(/_/g, '\\_')}%`);
    const [result, total] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .order('id')
        .range(Math.floor(page) * 50, Math.floor(page) * 50 + 49),
      q ? db.from('profiles').select('id', { count: 'exact', head: true }) : Promise.resolve(null),
    ]);
    const { data, error, count } = result;
    dbCheck(error);
    dbCheck(total?.error ?? null);
    return Response.json(
      { players: data ?? [], count: count ?? 0, total: total?.count ?? count ?? 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
