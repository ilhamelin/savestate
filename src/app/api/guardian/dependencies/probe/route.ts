import { authenticatedAdmin } from '@/lib/session';
import { sameOrigin, AppError, errorResponse } from '@/lib/http';
import { getSystemHealthReport } from '@/services/dependency-monitor-service';
export const runtime = 'nodejs';
let lastProbe = 0;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authenticatedAdmin();
    // Per-runtime cooldown supplements shared in-flight deduplication. No cross-region guarantee.
    if (Date.now() - lastProbe < 5000) throw new AppError('Espera 5 segundos antes de repetir la sonda.', 429);
    lastProbe = Date.now();
    return Response.json({ health: await getSystemHealthReport(true) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
