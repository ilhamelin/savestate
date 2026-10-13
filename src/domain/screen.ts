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
  status: ScreenUserStatus;
  rating: number | null;
  currentSeason: number;
  currentEpisode: number;
  totalEpisodes: number;
  watchedEpisodes: number[];
  notes: string;
}
export interface ScreenDetail extends ScreenMediaItem {
  seasons: { number: number; name: string; episodeCount: number }[];
  episodes: ScreenEpisode[];
  totalEpisodes: number;
  credits: { name: string; character: string }[];
  providerLink: string | null;
}
export interface ScreenEntryRow {
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
        status: row.status,
        rating: row.rating,
        currentSeason: row.current_season,
        currentEpisode: row.current_episode,
        totalEpisodes: row.total_episodes,
        watchedEpisodes: row.watched_episodes,
        notes: row.notes ?? '',
      }
    : {
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
    status: value.status as ScreenUserStatus,
    rating: rating as number | null,
    currentSeason,
    currentEpisode,
    totalEpisodes: detail.totalEpisodes,
    watchedEpisodes: episodes.sort((a, b) => a - b),
    notes: value.notes.trim(),
  };
}
export function screenPercent(progress?: ScreenUserProgress) {
  if (!progress) return 0;
  if (progress.status === 'completed') return 100;
  return progress.totalEpisodes
    ? Math.min(100, Math.round((progress.watchedEpisodes.length / progress.totalEpisodes) * 100))
    : 0;
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
