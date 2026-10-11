import { object, text } from '@/domain/validation';
import { mutation } from '@/lib/http';
import { authenticated } from '@/lib/session';
import { fetchGameLiveTelemetry } from '@/services/game-live-telemetry';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      await authenticated();
      const data = object(input);
      return fetchGameLiveTelemetry(text(data.title, 'Título del juego', 100, 2));
    },
    2048,
  );
}
