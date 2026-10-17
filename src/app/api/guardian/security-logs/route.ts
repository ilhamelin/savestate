import { errorResponse } from '@/lib/http';
import { guardianSecurityLogs } from '@/services/guardian-suite';
export async function GET() {
  try {
    return Response.json(await guardianSecurityLogs(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
