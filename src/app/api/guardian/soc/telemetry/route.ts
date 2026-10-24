import { authenticatedAdmin } from '@/lib/session';
import { errorResponse } from '@/lib/http';
import { getSocTelemetryReport } from '@/services/threat-shield-service';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await authenticatedAdmin();
    return Response.json(await getSocTelemetryReport(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
