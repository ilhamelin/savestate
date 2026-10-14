import { authenticated } from '@/lib/session';
import { AppError, dbCheck, mutation } from '@/lib/http';
import { object } from '@/domain/validation';
import {
  screenFollowedMedia,
  screenId,
  screenProgress,
  screenRegion,
  screenType,
} from '@/domain/screen';
import { getScreenMediaDetail } from '@/services/screen';
import { announceScreenUpcomingToDiscord } from '@/services/discord';
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      const { db, user } = await authenticated();
      const value = object(input),
        id = screenId(value.tmdbId),
        type = screenType(value.mediaType),
        region = screenRegion(value.region ?? 'CL');
      const entry = await db
        .from('user_screen_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('tmdb_id', id)
        .eq('media_type', type)
        .maybeSingle();
      dbCheck(entry.error);
      if (!entry.data?.followed)
        throw new AppError('Sigue este título en tu radar antes de anunciarlo.', 403);
      const slot = await db.rpc('claim_discord_message_slot');
      dbCheck(slot.error);
      if ((slot.data ?? 3) > 0)
        throw new AppError(`Espera ${slot.data ?? 3} segundos antes de enviar otro aviso.`, 429);
      const detail = await getScreenMediaDetail(id, type, region, entry.data.current_season);
      const item = screenFollowedMedia(detail, screenProgress(entry.data));
      if (
        detail.source === 'demo' ||
        !item.nextAirDate ||
        item.nextAirDate < new Date().toISOString().slice(0, 10)
      )
        throw new AppError('No hay un próximo estreno confirmado para anunciar.', 400);
      return announceScreenUpcomingToDiscord({
        tmdbId: id,
        mediaType: type,
        title: detail.title,
        nextAirDate: item.nextAirDate,
        season: item.nextSeasonNumber ?? undefined,
        episode: item.nextEpisodeNumber ?? undefined,
        providerName: item.providers.find((provider) => provider.offer === 'subscription')?.name,
        posterUrl: detail.posterUrl ?? undefined,
      });
    },
    2048,
  );
}
