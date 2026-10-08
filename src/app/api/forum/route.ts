import { mutation } from '@/lib/http';
import { forumMutation } from '@/services/forum';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return mutation(request, forumMutation, 64000);
}
