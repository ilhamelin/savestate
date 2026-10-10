import { mutation } from '@/lib/http';
import { object } from '@/domain/validation';
import { itchTrackerMutation } from '@/services/itch-tracker';
export async function POST(request: Request) {
  return mutation(
    request,
    (input) => itchTrackerMutation({ ...object(input), action: 'check-updates' }),
    4096,
  );
}
