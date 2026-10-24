import { authenticatedAdmin } from '@/lib/session';
import { sameOrigin, body, errorResponse } from '@/lib/http';
import { quarantineInput } from '@/domain/threat-shield';
import { changeQuarantine } from '@/services/threat-shield-service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const admin = await authenticatedAdmin();
    const input = quarantineInput(await body(request, 2048));
    await changeQuarantine(input.ip, input.action, input.reason, admin.id);
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
