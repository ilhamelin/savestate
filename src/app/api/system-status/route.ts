import { getSystemSwitches, getActiveSystemBroadcast } from '@/services/system-state';
import { errorResponse } from '@/lib/http';
export async function GET() {
  try {
    const [switches, broadcast] = await Promise.all([
      getSystemSwitches(),
      getActiveSystemBroadcast(),
    ]);
    return Response.json({ switches, broadcast }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
