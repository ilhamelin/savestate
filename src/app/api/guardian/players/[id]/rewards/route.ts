import { mutation, errorResponse, dbCheck } from '@/lib/http';
import { authenticatedAdmin } from '@/lib/session';
import { guardianAdminClient } from '@/services/guardian-admin';
import { rewardGuardianPlayer } from '@/services/guardian-suite';
export async function GET() {
  try {
    await authenticatedAdmin();
    const result = await guardianAdminClient().from('badges').select('id,name').order('name');
    dbCheck(result.error);
    return Response.json(
      { badges: result.data ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutation(
    request,
    async (input) => rewardGuardianPlayer((await context.params).id, input),
    2048,
  );
}
