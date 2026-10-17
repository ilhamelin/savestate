import { mutation } from '@/lib/http';
import { sendOperatorSignal } from '@/services/operator-signals';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutation(
    request,
    async () => sendOperatorSignal((await context.params).id, 'operator_kick'),
    1024,
  );
}
