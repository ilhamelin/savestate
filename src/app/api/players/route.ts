import { serverClient } from '@/integrations/supabase/server';
import { dbCheck, errorResponse } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const query = (new URL(request.url).searchParams.get('q') ?? '')
      .trim()
      .replace(/^@/, '')
      .slice(0, 30);
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(query)) return Response.json({ players: [] });
    const db = await serverClient();
    const { data, error } = await db
      .from('profiles')
      .select('id,username')
      .ilike('username', `%${query.replace(/_/g, '\\_')}%`)
      .order('username')
      .limit(8);
    dbCheck(error);
    return Response.json({ players: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
