import { mutation } from '@/lib/http';
import { libraryMutation } from '@/services/library';
import { profileMutation } from '@/services/profile';
import { socialMutation } from '@/services/social';
import { listMutation } from '@/services/lists';
import { communityMutation } from '@/services/community';
import { partyMutation } from '@/services/arcade';
const handlers: Record<string, (input: unknown) => Promise<unknown>> = {
  library: libraryMutation,
  profile: profileMutation,
  social: socialMutation,
  lists: listMutation,
  community: communityMutation,
  parties: partyMutation,
};
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const handler = handlers[resource];
  if (!handler) return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 });
  return mutation(request, handler);
}
