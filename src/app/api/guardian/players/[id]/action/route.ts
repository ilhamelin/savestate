import { mutation } from '@/lib/http';
import { moderatePlayer } from '@/services/player-moderation';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutation(request, async (input) => moderatePlayer((await context.params).id, input), 2048);
}
