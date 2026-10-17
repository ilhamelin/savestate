import 'server-only';
import { tmdbConfigured, tmdbRequest } from '@/integrations/tmdb/server';
import { currentUser, authenticated } from '@/lib/session';
import { serverClient } from '@/integrations/supabase/server';
import { AppError, dbCheck } from '@/lib/http';
import { object, ValidationError } from '@/domain/validation';
import { GAME_ADAPTATIONS_MATRIX, screenAdaptation } from '@/domain/game-adaptations';
import {
  normalizeScreenMedia,
  extractTmdbTrailerId,
  normalizeScreenProviders,
  screenType,
  screenId,
  screenRegion,
  screenFilter,
  screenProgress,
  validateScreenProgress,
  screenEpisodeKey,
  screenAirDate,
  screenFollowedMedia,
  screenRuntimeMinutes,
  type ScreenMediaItem,
  type ScreenDetail,
  type ScreenMediaType,
  type ScreenEntryRow,
} from '@/domain/screen';
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function demoMedia(id: number, type: ScreenMediaType): ScreenDetail {
  const link = screenAdaptation(id, type);
  if (!link) throw new AppError('Este título no está incluido en el catálogo demo.', 404);
  const episodes =
    type === 'tv'
      ? Array.from({ length: 10 }, (_, index) => ({
          seasonNumber: 1,
          episodeNumber: index + 1,
          title: `Episodio de muestra ${index + 1}`,
          overview:
            'Contenido de demostración. TMDB aportará la sinopsis oficial al configurar la clave.',
          airDate: null,
          watched: false,
        }))
      : [];
  return {
    id: `${type}:${id}`,
    tmdbId: id,
    mediaType: type,
    title: link.title,
    overview: `Explora la adaptación de ${link.gameTitle} y registra tu avance. Este catálogo es una demostración; episodios y datos de estreno no están verificados.`,
    posterUrl: null,
    backdropUrl: id === 94605 ? '/wallpapers/rift_arcane.jpg' : null,
    releaseYear: null,
    rating: null,
    voteCount: 0,
    providers: [],
    source: 'demo',
    trailerVideoId: id === 106379 && type === 'tv' ? '0kAAqslOS64' : null,
    seasons:
      type === 'tv' ? [{ number: 1, name: 'Temporada de demostración', episodeCount: 10 }] : [],
    episodes,
    totalEpisodes: type === 'tv' ? 10 : 1,
    credits: [],
    providerLink: null,
  };
}
async function mapBatches<T, R>(values: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = [];
  for (let i = 0; i < values.length; i += 4)
    result.push(...(await Promise.all(values.slice(i, i + 4).map(fn))));
  return result;
}
export async function getScreenMediaDetail(
  tmdbId: number,
  mediaType: ScreenMediaType,
  region = 'CL',
  season = 1,
): Promise<ScreenDetail> {
  const id = screenId(tmdbId),
    type = screenType(mediaType),
    country = screenRegion(region);
  if (!Number.isInteger(season) || season < 1 || season > 999)
    throw new ValidationError('Temporada inválida.');
  if (!tmdbConfigured()) return demoMedia(id, type);
  const raw = await tmdbRequest(`${type}/${id}`, {
    append_to_response: 'credits,watch/providers,videos',
    include_video_language: 'es-MX,es,en',
  });
  const media = normalizeScreenMedia(raw, type);
  if (!media) throw new AppError('Este título no está disponible.', 404);
  const availability = normalizeScreenProviders(raw['watch/providers'], country);
  const seasons = (Array.isArray(raw.seasons) ? raw.seasons : []).flatMap((item) => {
    const data = record(item);
    return typeof data.season_number === 'number' &&
      Number.isInteger(data.season_number) &&
      data.season_number >= 1 &&
      data.season_number <= 999 &&
      typeof data.episode_count === 'number' &&
      data.episode_count >= 0 &&
      data.episode_count < 10000
      ? [
          {
            number: data.season_number,
            name: typeof data.name === 'string' ? data.name : 'Temporada ' + data.season_number,
            episodeCount: Math.floor(data.episode_count),
          },
        ]
      : [];
  });
  let episodes: ScreenDetail['episodes'] = [];
  let runtimeMinutes = screenRuntimeMinutes(raw, type);
  if (type === 'tv' && seasons.some((item) => item.number === season)) {
    const data = await tmdbRequest(`tv/${id}/season/${season}`);
    runtimeMinutes ??= screenRuntimeMinutes(
      {
        episode_run_time: Array.isArray(data.episodes)
          ? data.episodes.map((item) => record(item).runtime)
          : [],
      },
      'tv',
    );
    episodes = (Array.isArray(data.episodes) ? data.episodes : []).flatMap((item) => {
      const entry = record(item);
      return typeof entry.episode_number === 'number' &&
        Number.isInteger(entry.episode_number) &&
        entry.episode_number > 0 &&
        entry.episode_number < 10000
        ? [
            {
              episodeNumber: entry.episode_number,
              seasonNumber: season,
              title:
                typeof entry.name === 'string' ? entry.name : 'Episodio ' + entry.episode_number,
              overview: typeof entry.overview === 'string' ? entry.overview : '',
              airDate: typeof entry.air_date === 'string' ? entry.air_date : null,
              watched: false,
            },
          ]
        : [];
    });
  }
  const credits = (
    Array.isArray(record(raw.credits).cast) ? (record(raw.credits).cast as unknown[]) : []
  )
    .slice(0, 8)
    .flatMap((item) => {
      const data = record(item);
      return typeof data.name === 'string'
        ? [{ name: data.name, character: typeof data.character === 'string' ? data.character : '' }]
        : [];
    });
  return {
    ...media,
    providers: availability.providers,
    providerLink: availability.link,
    seasons,
    episodes,
    totalEpisodes:
      type === 'movie' ? 1 : seasons.reduce((total, item) => total + item.episodeCount, 0),
    credits,
    trailerVideoId: extractTmdbTrailerId(raw.videos),
    runtimeMinutes,
    releaseDate: screenAirDate(raw.release_date),
    releaseStatus: typeof raw.status === 'string' ? raw.status : null,
    nextEpisodeToAir: (() => {
      const next = record(raw.next_episode_to_air);
      return type === 'tv' &&
        Number.isInteger(next.season_number) &&
        Number.isInteger(next.episode_number) &&
        Number(next.season_number) > 0 &&
        Number(next.season_number) <= 999 &&
        Number(next.episode_number) > 0 &&
        Number(next.episode_number) < 10000
        ? {
            season: Number(next.season_number),
            episode: Number(next.episode_number),
            title: typeof next.name === 'string' ? next.name : '',
            airDate: screenAirDate(next.air_date),
          }
        : null;
    })(),
  };
}
export async function getRadarFeaturedMedia(region = 'CL') {
  return await mapBatches(
    GAME_ADAPTATIONS_MATRIX.filter((item) => item.featuredOrder).sort(
      (a, b) => a.featuredOrder! - b.featuredOrder!,
    ),
    async (item) => {
      try {
        return await getScreenMediaDetail(item.tmdbId, item.mediaType, region);
      } catch {
        return demoMedia(item.tmdbId, item.mediaType);
      }
    },
  );
}
export async function getScreenAdaptations(region = 'CL'): Promise<ScreenDetail[]> {
  const country = screenRegion(region);
  return mapBatches(GAME_ADAPTATIONS_MATRIX, (item) =>
    getScreenMediaDetail(item.tmdbId, item.mediaType, country).catch(() =>
      demoMedia(item.tmdbId, item.mediaType),
    ),
  );
}
export async function getScreenTrending(
  filter = 'popular',
  region = 'CL',
): Promise<ScreenMediaItem[]> {
  const mode = screenFilter(filter),
    country = screenRegion(region);
  if (!tmdbConfigured())
    return GAME_ADAPTATIONS_MATRIX.filter(
      (item) => (mode !== 'tv' && mode !== 'movie') || item.mediaType === mode,
    ).map((item) => demoMedia(item.tmdbId, item.mediaType));
  if (mode === 'adaptations') return getScreenAdaptations(country);
  const path =
    mode === 'movie'
      ? 'movie/popular'
      : mode === 'tv'
        ? 'tv/popular'
        : mode === 'upcoming'
          ? 'movie/upcoming'
          : mode === 'top'
            ? 'movie/top_rated'
            : 'trending/all/week';
  const raw = await tmdbRequest(path, { region: country });
  const items = (Array.isArray(raw.results) ? raw.results : [])
    .flatMap((item) => {
      const media = normalizeScreenMedia(
        item,
        mode === 'tv' ? 'tv' : ['movie', 'upcoming', 'top'].includes(mode) ? 'movie' : undefined,
      );
      return media ? [media] : [];
    })
    .slice(0, 16);
  return mapBatches(items, async (item) => {
    try {
      const providers = await tmdbRequest(`${item.mediaType}/${item.tmdbId}/watch/providers`);
      return { ...item, providers: normalizeScreenProviders(providers, country).providers };
    } catch {
      return item;
    }
  });
}
export async function searchScreenMedia(query: string, region = 'CL'): Promise<ScreenMediaItem[]> {
  const q = query.trim();
  const country = screenRegion(region);
  if (q.length < 2 || q.length > 100) throw new ValidationError('Busca entre 2 y 100 caracteres.');
  if (!tmdbConfigured())
    return GAME_ADAPTATIONS_MATRIX.filter((item) =>
      item.title.toLowerCase().includes(q.toLowerCase()),
    ).map((item) => demoMedia(item.tmdbId, item.mediaType));
  const raw = await tmdbRequest('search/multi', {
    query: q,
    include_adult: 'false',
    region: country,
  });
  return (Array.isArray(raw.results) ? raw.results : [])
    .flatMap((item) => {
      const media = normalizeScreenMedia(item);
      return media ? [media] : [];
    })
    .slice(0, 20);
}
export async function screenEntries() {
  const user = await currentUser();
  if (!user) return { entries: [] as ScreenEntryRow[], available: true };
  const db = await serverClient();
  const { data, error } = await db
    .from('user_screen_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error?.code === 'PGRST205' || error?.code === '42P01')
    return { entries: [] as ScreenEntryRow[], available: false };
  dbCheck(error);
  return { entries: data ?? [], available: true };
}
export async function screenDetailWithProgress(
  id: number,
  type: ScreenMediaType,
  region = 'CL',
  season = 1,
) {
  const user = await currentUser();
  const detail = await getScreenMediaDetail(id, type, region, season);
  let row: ScreenEntryRow | null = null;
  let available = true;
  if (user) {
    const db = await serverClient();
    const result = await db
      .from('user_screen_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('tmdb_id', id)
      .eq('media_type', type)
      .maybeSingle();
    if (['PGRST205', '42P01'].includes(result.error?.code ?? '')) available = false;
    else dbCheck(result.error);
    row = result.data;
  }
  const progress = screenProgress(row);
  progress.totalEpisodes = detail.totalEpisodes;
  return {
    detail: {
      ...detail,
      episodes: detail.episodes.map((episode) => ({
        ...episode,
        watched: progress.watchedEpisodes.includes(
          screenEpisodeKey(episode.seasonNumber, episode.episodeNumber),
        ),
      })),
    },
    progress,
    available,
  };
}
export async function getFollowedScreenRadar(region = 'CL') {
  const country = screenRegion(region);
  const { entries } = await screenEntries();
  return await mapBatches(
    entries.filter((row) => row.followed === true),
    async (row) => {
      try {
        return screenFollowedMedia(
          await getScreenMediaDetail(row.tmdb_id, row.media_type, country, row.current_season),
          screenProgress(row),
        );
      } catch {
        // Keep followed titles visible during an upstream outage without inventing dates.
        return screenFollowedMedia(
          {
            id: `${row.media_type}:${row.tmdb_id}`,
            tmdbId: row.tmdb_id,
            mediaType: row.media_type,
            title: row.title,
            posterUrl: row.poster_path,
            backdropUrl: row.backdrop_path,
            overview: '',
            releaseYear: null,
            rating: null,
            voteCount: 0,
            providers: [],
            source: 'tmdb',
            trailerVideoId: null,
            seasons: [],
            episodes: [],
            totalEpisodes: row.total_episodes,
            credits: [],
            providerLink: null,
          },
          screenProgress(row),
        );
      }
    },
  );
}
export async function saveScreenProgress(input: unknown) {
  const { db, user } = await authenticated();
  const value = object(input);
  const tmdbId = screenId(value.tmdbId),
    mediaType = screenType(value.mediaType);
  const detail = await getScreenMediaDetail(
    tmdbId,
    mediaType,
    'CL',
    typeof value.currentSeason === 'number' ? value.currentSeason : 1,
  );
  if (detail.totalEpisodes > 5000)
    throw new AppError('Esta serie supera el límite de 5000 episodios.', 400);
  const progress = validateScreenProgress(value, detail);
  const fields = {
    ...(progress.followed !== undefined ? { followed: progress.followed } : {}),
    title: detail.title,
    poster_path: detail.posterUrl,
    backdrop_path: detail.backdropUrl,
    status: progress.status,
    rating: progress.rating,
    current_season: progress.currentSeason,
    current_episode: progress.currentEpisode,
    total_episodes: progress.totalEpisodes,
    watched_episodes: progress.watchedEpisodes,
    notes: progress.notes,
  };
  const update = () =>
    db
      .from('user_screen_entries')
      .update(fields)
      .eq('user_id', user.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .select('*')
      .maybeSingle();
  async function write() {
    let result = await update();
    if (!result.error && !result.data) {
      result = await db
        .from('user_screen_entries')
        .insert({ user_id: user.id, tmdb_id: tmdbId, media_type: mediaType, ...fields })
        .select('*')
        .single();
      if (result.error?.code === '23505') result = await update();
    }
    return result;
  }
  let { data, error } = await write();
  if (['PGRST204', '42703'].includes(error?.code ?? '') && /followed/i.test(error?.message ?? '')) {
    if (progress.followed === true)
      throw new AppError('Aplica la migración 030 para seguir títulos en el radar.', 503);
    delete fields.followed;
    ({ data, error } = await write());
  }
  if (['PGRST205', '42P01'].includes(error?.code ?? ''))
    throw new AppError('Aplica la migración 029 para guardar tu bitácora.', 503);
  dbCheck(error);
  return data;
}
