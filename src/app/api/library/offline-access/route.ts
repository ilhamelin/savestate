import { authenticated } from '@/lib/session';
import { errorResponse } from '@/lib/http';

export async function GET() {
  try {
    const { user } = await authenticated();
    return Response.json({ userId: user.id }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
