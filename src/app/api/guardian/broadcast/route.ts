import { authenticatedAdmin } from '@/lib/session';
import { mutation, errorResponse } from '@/lib/http';
import { getActiveSystemBroadcast } from '@/services/system-state';
import { changeGuardianBroadcast } from '@/services/guardian-suite';
export async function GET() {
  try {
    await authenticatedAdmin();
    return Response.json(
      { broadcast: await getActiveSystemBroadcast() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, changeGuardianBroadcast, 4096);
}
