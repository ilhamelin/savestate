import { saveScreenProgress } from '@/services/screen';
import { mutation } from '@/lib/http';
export async function POST(request: Request) {
  return mutation(request, saveScreenProgress, 65000);
}
