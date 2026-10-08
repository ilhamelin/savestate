import { mutation, errorResponse, AppError } from '@/lib/http';
import { highlightMutation, highlightComments } from '@/services/highlights';
export async function POST(request: Request) {
  return mutation(request, highlightMutation);
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams,
      page = Number(params.get('page') ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 1000)
      throw new AppError('Página inválida.', 400);
    return Response.json(await highlightComments(params.get('post') ?? '', page), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
