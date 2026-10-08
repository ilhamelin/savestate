import { mutation } from '@/lib/http';
import { steamMutation } from '@/services/steam';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return mutation(request, steamMutation);
}
