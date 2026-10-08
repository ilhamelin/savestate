import { notificationSummary } from '@/services/notifications';
import { errorResponse } from '@/lib/http';
export async function GET() {
  try {
    return Response.json(
      { data: await notificationSummary() },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
