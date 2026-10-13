import {
  globalChatMessage,
  listGlobalChatMessages,
  postGlobalChatMessage,
} from '@/services/global-chat';
import { errorResponse, mutation } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const data = params.has('id')
      ? { message: await globalChatMessage(params.get('id')!) }
      : await listGlobalChatMessages({
          before: params.get('before') ?? undefined,
          limit: params.has('limit') ? Number(params.get('limit')) : 50,
        });
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, postGlobalChatMessage, 8000);
}
