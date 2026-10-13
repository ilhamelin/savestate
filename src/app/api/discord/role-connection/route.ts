import { mutation, errorResponse, AppError } from '@/lib/http';
import { object } from '@/domain/validation';
import {
  authorizeDiscordRoles,
  discordRoleStatus,
  syncDiscordRoles,
} from '@/services/discord-roles';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return Response.json(
      { data: await discordRoleStatus() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      const data = object(input);
      if (data.action === 'authorize') return authorizeDiscordRoles();
      if (data.action === 'sync') return syncDiscordRoles();
      throw new AppError('Acción de roles no permitida.', 400);
    },
    2048,
  );
}
