import { errorResponse } from '@/lib/http';
import { guardianTelemetry } from '@/services/guardian-suite';
export async function GET() {
  try {
    return Response.json(await guardianTelemetry(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
