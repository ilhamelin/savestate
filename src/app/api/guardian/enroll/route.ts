import { authenticatedAdmin } from '@/lib/session';
import { mutation } from '@/lib/http';
import { configuredGateSecret } from '@/services/gatekeeper';
export async function POST(request: Request) {
  return mutation(
    request,
    async () => {
      await authenticatedAdmin();
      return { secret: configuredGateSecret(), stepSeconds: 20 };
    },
    256,
  );
}
