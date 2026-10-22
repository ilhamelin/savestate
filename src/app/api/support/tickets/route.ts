import { body, sameOrigin, errorResponse } from '@/lib/http';
import { currentViewerProfile, authenticatedAdmin } from '@/lib/session';
import { sanitizeSupportTicket } from '@/services/support-sanitize';
import { claimSupportAttempt } from '@/services/support-store';
import { createSupportTicket, supportDashboard } from '@/services/jira-support-service';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await claimSupportAttempt(request, 'support');
    const input = sanitizeSupportTicket(await body(request, 24000));
    const viewer = await currentViewerProfile();
    input.username = viewer?.username ?? null;
    const data = await createSupportTicket(input);
    return Response.json({ data }, {
      status: data.status === 'synced_jira' ? 201 : 202,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) { return errorResponse(error); }
}
export async function GET() {
  try {
    await authenticatedAdmin();
    return Response.json(await supportDashboard(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
