import { authenticated } from '@/lib/session';
import { mutation } from '@/lib/http';
import { inspectCompetitive } from '@/services/competitive-tracker';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      await authenticated();
      return inspectCompetitive(input);
    },
    2048,
  );
}
