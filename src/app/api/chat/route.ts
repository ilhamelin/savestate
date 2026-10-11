import { errorResponse, mutation } from '@/lib/http';
import { friendHistory, sendFriendMessage } from '@/services/friend-chat';
export async function GET(request: Request) {
  try {
    return Response.json(
      { data: await friendHistory(new URL(request.url).searchParams.get('friendId')) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(request, sendFriendMessage, 4096);
}
