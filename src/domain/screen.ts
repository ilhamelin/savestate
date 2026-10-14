import { object, ValidationError } from './validation.ts';
export type ScreenMediaType = 'tv' | 'movie';
export type ScreenUserStatus = 'watching' | 'plan_to_watch' | 'completed' | 'dropped';
export type ScreenFilter = 'popular' | 'adaptations' | 'tv' | 'movie' | 'upcoming' | 'top';
export type ScreenRegion = 'CL' | 'MX' | 'ES' | 'US';
export interface WatchProvider {
  id: number;
  name: string;
  logoUrl: string | null;
  url: string;
  offer: 'subscription' | 'rent' | 'buy';
}
export interface ScreenMediaItem {
  id: string;
  tmdbId: number;
  mediaType: ScreenMediaType;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
  voteCount: number;
  providers: WatchProvider[];
  source: 'tmdb' | 'demo';
  trailerVideoId?: string | null;
}
export interface ScreenEpisode {
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  overview: string;
  airDate: string | null;
  watched: boolean;
}
export interface ScreenUserProgress {
  followed?: boolean;
  status: ScreenUserStatus;
  rating: number | null;
  currentSeason: number;
  currentEpisode: number;
  totalEpisodes: number;
  watchedEpisodes: number[];
  notes: string;
}
export interface ScreenDetail extends ScreenMediaItem {
  runtimeMinutes?: number | null;
  nextEpisodeToAir?: {
    season: number;
    episode: number;
    title: string;
    airDate: string | null;
  } | null;
  releaseDate?: string | null;
  releaseStatus?: string | null;
  trailerVideoId: string | null;
  seasons: { number: number; name: string; episodeCount: number }[];
  episodes: ScreenEpisode[];
  totalEpisodes: number;
  credits: { name: string; character: string }[];
  providerLink: string | null;
}
export function extractTmdbTrailerId(videosRaw: unknown): string | null {
  const value =
    videosRaw && typeof videosRaw === 'object' ? (videosRaw as Record<string, unknown>) : {};
  if (!Array.isArray(value.results)) return null;
  const videos = value.results.flatMap((input, index) => {
    if (!input || typeof input !== 'object') return [];
    const video = input as Record<string, unknown>;
    if (
      video.site !== 'YouTube' ||
      !['Trailer', 'Teaser'].includes(String(video.type)) ||
      typeof video.key !== 'string' ||
      !/^[a-zA-Z0-9_-]{11}$/.test(video.key)
    )
      return [];
    return [
      {
        key: video.key,
        type: video.type,
        official: video.official === true,
        language: video.iso_639_1,
        country: video.iso_3166_1,
        name: typeof video.name === 'string' ? video.name : '',
        index,
      },
    ];
  });
  const languagePriority = (video: { language: unknown; country: unknown; name: string }) => {
    if (video.language === 'es') {
      if (
        ['MX', 'AR', 'CL', 'CO', 'PE', 'LA'].includes(String(video.country)) ||
        /latino|hispanoam[eé]rica|doblado/i.test(video.name)
      )
        return 0;
      return video.country === 'ES' ? 2 : 1;
    }
    return video.language === 'en' ? 3 : 4;
  };
  videos.sort(
    (a, b) =>
      Number(a.type !== 'Trailer') - Number(b.type !== 'Trailer') ||
      Number(!a.official) - Number(!b.official) ||
      languagePriority(a) - languagePriority(b) ||
      a.index - b.index,
  );
  return videos[0]?.key ?? null;
}
export interface ScreenEntryRow {
  followed?: boolean;
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: ScreenMediaType;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  status: ScreenUserStatus;
  rating: number | null;
  current_season: number;
  current_episode: number;
  total_episodes: number;
  watched_episodes: number[];
  notes: string | null;
  updated_at: string;
  created_at: string;
}
export function screenType(input: unknown): ScreenMediaType {
  if (input !== 'tv' && input !== 'movie') throw new ValidationError('Tipo de pantalla inválido.');
  return input;
}
export function screenId(input: unknown): number {
  const value = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647)
    throw new ValidationError('Identificador TMDB inválido.');
  return value;
}
export function screenRegion(input: unknown): ScreenRegion {
  if (!['CL', 'MX', 'ES', 'US'].includes(String(input)))
    throw new ValidationError('Región no soportada.');
  return input as ScreenRegion;
}
export function screenFilter(input: unknown): ScreenFilter {
  if (!['popular', 'adaptations', 'tv', 'movie', 'upcoming', 'top'].includes(String(input)))
    throw new ValidationError('Filtro no soportado.');
  return input as ScreenFilter;
}
// A season-aware integer key fits the existing integer[] schema; S02E01 differs from S01E01.
export function screenEpisodeKey(season: number, episode: number) {
  return season * 10000 + episode;
}
export function screenProgress(row?: ScreenEntryRow | null): ScreenUserProgress {
  return row
    ? {
        followed: row.followed === true,
        status: row.status,
        rating: row.rating,
        currentSeason: row.current_season,
        currentEpisode: row.current_episode,
        totalEpisodes: row.total_episodes,
        watchedEpisodes: row.watched_episodes,
        notes: row.notes ?? '',
      }
    : {
        followed: false,
        status: 'plan_to_watch',
        rating: null,
        currentSeason: 1,
        currentEpisode: 0,
        totalEpisodes: 0,
        watchedEpisodes: [],
        notes: '',
      };
}
export function validateScreenProgress(input: unknown, detail: ScreenDetail): ScreenUserProgress {
  const value = object(input);
  if (value.followed !== undefined && typeof value.followed !== 'boolean')
    throw new ValidationError('Seguimiento inválido.');
  if (!['watching', 'plan_to_watch', 'completed', 'dropped'].includes(String(value.status)))
    throw new ValidationError('Estado inválido.');
  const rating = value.rating == null ? null : value.rating;
  if (
    rating !== null &&
    (typeof rating !== 'number' ||
      !Number.isFinite(rating) ||
      rating < 0 ||
      rating > 10 ||
      !Number.isInteger(rating * 2))
  )
    throw new ValidationError('Calificación entre 0 y 10, en pasos de 0,5.');
  if (typeof value.notes !== 'string' || value.notes.length > 2000)
    throw new ValidationError('Notas: máximo 2000 caracteres.');
  if (!Array.isArray(value.watchedEpisodes) || value.watchedEpisodes.length > 5000)
    throw new ValidationError('Lista de episodios inválida.');
  const episodes = [...new Set(value.watchedEpisodes)];
  for (const key of episodes) {
    const season = typeof key === 'number' ? Math.floor(key / 10000) : -1;
    const episode = typeof key === 'number' ? key % 10000 : -1;
    const info = detail.seasons.find((item) => item.number === season);
    if (!Number.isInteger(key) || !info || episode < 1 || episode > info.episodeCount)
      throw new ValidationError('El episodio no pertenece a esta serie.');
  }
  const currentSeason = value.currentSeason;
  if (
    typeof currentSeason !== 'number' ||
    !Number.isInteger(currentSeason) ||
    currentSeason < 1 ||
    currentSeason > 999 ||
    (detail.mediaType === 'tv' &&
      detail.seasons.length > 0 &&
      !detail.seasons.some((item) => item.number === currentSeason))
  )
    throw new ValidationError('Temporada inválida.');
  const currentEpisode = value.currentEpisode;
  const max =
    detail.mediaType === 'movie'
      ? 1
      : (detail.seasons.find((item) => item.number === currentSeason)?.episodeCount ?? 0);
  if (
    typeof currentEpisode !== 'number' ||
    !Number.isInteger(currentEpisode) ||
    currentEpisode < 0 ||
    currentEpisode > max
  )
    throw new ValidationError('Episodio actual inválido.');
  if (detail.mediaType === 'movie' && episodes.length)
    throw new ValidationError('Las películas no tienen episodios.');
  return {
    followed: value.followed as boolean | undefined,
    status: value.status as ScreenUserStatus,
    rating: rating as number | null,
    currentSeason,
    currentEpisode,
    totalEpisodes: detail.totalEpisodes,
    watchedEpisodes: episodes.sort((a, b) => a - b),
    notes: value.notes.trim(),
  };
}
export interface ScreenFollowedMedia {
  tmdbId: number;
  mediaType: ScreenMediaType;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  currentSeason: number;
  currentEpisodeWatched: number;
  nextSeasonNumber: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeTitle: string | null;
  nextAirDate: string | null;
  providers: WatchProvider[];
  followed: boolean;
  statusText: string;
  source: ScreenMediaItem['source'];
}
export function screenAirDate(input: unknown): string | null {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(input + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === input
    ? input
    : null;
}
export function screenFollowedMedia(
  detail: ScreenDetail,
  progress: ScreenUserProgress,
): ScreenFollowedMedia {
  const upcoming = detail.nextEpisodeToAir;
  const pending = detail.episodes.find(
    (episode) =>
      !progress.watchedEpisodes.includes(
        screenEpisodeKey(episode.seasonNumber, episode.episodeNumber),
      ),
  );
  const next =
    upcoming ??
    (pending
      ? {
          season: pending.seasonNumber,
          episode: pending.episodeNumber,
          title: pending.title,
          airDate: pending.airDate,
        }
      : null);
  const statuses: Record<string, string> = {
    'Returning Series': 'En emisión',
    Ended: 'Serie finalizada',
    Canceled: 'Serie cancelada',
    'In Production': 'En producción',
    'Post Production': 'En posproducción',
    Released: 'Estrenada',
    Planned: 'En preparación',
  };
  return {
    tmdbId: detail.tmdbId,
    mediaType: detail.mediaType,
    title: detail.title,
    posterUrl: detail.posterUrl,
    backdropUrl: detail.backdropUrl,
    currentSeason: progress.currentSeason,
    currentEpisodeWatched: Math.max(
      0,
      progress.currentEpisode,
      ...progress.watchedEpisodes
        .filter((key) => Math.floor(key / 10000) === progress.currentSeason)
        .map((key) => key % 10000),
    ),
    nextSeasonNumber: detail.mediaType === 'tv' ? (next?.season ?? null) : null,
    nextEpisodeNumber: detail.mediaType === 'tv' ? (next?.episode ?? null) : null,
    nextEpisodeTitle: detail.mediaType === 'tv' ? (next?.title ?? null) : null,
    nextAirDate: screenAirDate(detail.mediaType === 'tv' ? next?.airDate : detail.releaseDate),
    providers: detail.providers,
    followed: progress.followed === true,
    statusText:
      detail.source === 'demo'
        ? 'DEMO · Fecha por confirmar'
        : (statuses[detail.releaseStatus ?? ''] ?? 'Fecha por confirmar'),
    source: detail.source,
  };
}
export function screenCountdown(date: string | null, nowMs: number): string {
  const valid = screenAirDate(date);
  if (!valid || !Number.isFinite(nowMs)) return 'POR ANUNCIAR';
  if (new Date(nowMs).toISOString().slice(0, 10) === valid) return '¡ESTRENO HOY!';
  const seconds = Math.floor((Date.parse(valid + 'T00:00:00.000Z') - nowMs) / 1000);
  if (seconds <= 0) return 'DISPONIBLE';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 86400))}d : ${pad(Math.floor(seconds / 3600) % 24)}h : ${pad(Math.floor(seconds / 60) % 60)}m : ${pad(seconds % 60)}s`;
}
export function screenPercent(progress?: ScreenUserProgress) {
  if (!progress) return 0;
  if (progress.status === 'completed') return 100;
  return progress.totalEpisodes
    ? Math.min(100, Math.round((progress.watchedEpisodes.length / progress.totalEpisodes) * 100))
    : 0;
}
export function screenRuntimeMinutes(raw: unknown, type: ScreenMediaType): number | null {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const values =
    type === 'movie'
      ? [data.runtime]
      : Array.isArray(data.episode_run_time)
        ? data.episode_run_time
        : [];
  const minutes = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1440,
  );
  return minutes.length
    ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length)
    : null;
}
export function screenSeasonProgress(detail: ScreenDetail, progress: ScreenUserProgress) {
  const season = detail.seasons.find((item) => item.number === progress.currentSeason);
  const total =
    season?.episodeCount ??
    detail.episodes.filter((item) => item.seasonNumber === progress.currentSeason).length;
  const watched = new Set(
    progress.watchedEpisodes.filter(
      (key) =>
        Math.floor(key / 10000) === progress.currentSeason &&
        key % 10000 > 0 &&
        key % 10000 <= total,
    ),
  ).size;
  return {
    watched,
    total,
    percent: total ? Math.min(100, Math.round((watched / total) * 100)) : 0,
  };
}
export function tmdbImage(path: unknown, size = 'w500'): string | null {
  return typeof path === 'string' && /^\/[\w-]+\.(jpg|png|webp)$/i.test(path)
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : null;
}
function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
export function normalizeScreenMedia(raw: unknown, type?: ScreenMediaType): ScreenMediaItem | null {
  const value = rec(raw),
    mediaType = type ?? value.media_type;
  if ((mediaType !== 'tv' && mediaType !== 'movie') || value.adult === true) return null;
  const title = value.title ?? value.name;
  if (typeof title !== 'string' || !title.trim()) return null;
  let id: number;
  try {
    id = screenId(value.id);
  } catch {
    return null;
  }
  const date = value.release_date ?? value.first_air_date;
  return {
    id: `${mediaType}:${id}`,
    tmdbId: id,
    mediaType,
    title: title.slice(0, 300),
    overview: typeof value.overview === 'string' ? value.overview.slice(0, 10000) : '',
    posterUrl: tmdbImage(value.poster_path),
    backdropUrl: tmdbImage(value.backdrop_path, 'w1280'),
    releaseYear:
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? Number(date.slice(0, 4))
        : null,
    rating:
      typeof value.vote_average === 'number' && value.vote_average >= 0 && value.vote_average <= 10
        ? value.vote_average
        : null,
    voteCount:
      typeof value.vote_count === 'number' && Number.isFinite(value.vote_count)
        ? Math.max(0, Math.floor(value.vote_count))
        : 0,
    providers: [],
    source: 'tmdb',
  };
}
export function normalizeScreenProviders(raw: unknown, region: ScreenRegion) {
  const country = rec(rec(rec(raw).results)[region]);
  let url: string | null = null;
  try {
    const parsed = new URL(String(country.link));
    if (
      parsed.protocol === 'https:' &&
      ['www.themoviedb.org', 'www.justwatch.com'].includes(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port
    )
      url = parsed.href;
  } catch {
    /* Missing regional availability. */
  }
  const providers: WatchProvider[] = [];
  if (url)
    for (const [key, offer] of [
      ['flatrate', 'subscription'],
      ['rent', 'rent'],
      ['buy', 'buy'],
    ] as const) {
      for (const item of Array.isArray(country[key]) ? (country[key] as unknown[]) : []) {
        const provider = rec(item);
        if (typeof provider.provider_id !== 'number' || typeof provider.provider_name !== 'string')
          continue;
        providers.push({
          id: provider.provider_id,
          name: provider.provider_name.slice(0, 80),
          logoUrl: tmdbImage(provider.logo_path, 'w92'),
          url,
          offer,
        });
      }
    }
  return { providers, link: url };
}
