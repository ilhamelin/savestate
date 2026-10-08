import { duelSummary, arcadeMutation } from '@/services/arcade';
import { errorResponse, mutation } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('duel') ?? undefined;
    return Response.json(
      { data: await duelSummary(id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, arcadeMutation);
}
