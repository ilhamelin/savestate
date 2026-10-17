import { authenticatedAdmin } from '@/lib/session';
import { mutation, errorResponse } from '@/lib/http';
import { getSystemSwitches } from '@/services/system-state';
import { changeGuardianSwitch } from '@/services/guardian-suite';
export async function GET() {
  try {
    await authenticatedAdmin();
    return Response.json(await getSystemSwitches(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, changeGuardianSwitch, 2048);
}
