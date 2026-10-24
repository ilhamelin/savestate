import { authenticatedAdmin } from '@/lib/session';
import { sameOrigin, body, errorResponse } from '@/lib/http';
import { defconInput } from '@/domain/threat-shield';
import { setDefconLevel } from '@/services/threat-shield-service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const admin = await authenticatedAdmin();
    const { level, reason } = defconInput(await body(request, 2048));
    await setDefconLevel(level, admin.id, reason);
    return Response.json({ success: true, level }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
