import { getSystemSwitches, getActiveSystemBroadcast } from '@/services/system-state';
import { getSystemHealthReport } from '@/services/dependency-monitor-service';
export const runtime = 'nodejs';
export async function GET(request?: Request) {
  const healthOnly = request && new URL(request.url).searchParams.get('healthOnly') === '1';
  const [switches, broadcast, health] = await Promise.allSettled([
    healthOnly ? Promise.resolve(null) : getSystemSwitches(),
    healthOnly ? Promise.resolve(null) : getActiveSystemBroadcast(),
    getSystemHealthReport(false),
  ]);
  return Response.json(
    {
      switches: switches.status === 'fulfilled' ? switches.value : null,
      broadcast: broadcast.status === 'fulfilled' ? broadcast.value : null,
      stateAvailable:
        switches.status === 'fulfilled' && broadcast.status === 'fulfilled' && !healthOnly,
      health: health.status === 'fulfilled' ? health.value : null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
