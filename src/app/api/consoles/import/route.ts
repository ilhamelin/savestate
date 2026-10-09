import { mutation } from '@/lib/http';
import { consoleImportMutation } from '@/services/console-import';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return mutation(request, consoleImportMutation, 220000);
}
