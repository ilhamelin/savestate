import { ValidationError, text } from '../../domain/validation.ts';
export interface CatalogueFilters {
  q: string;
  platform: string;
  genre: string;
  year: number | null;
  minRating: number | null;
  sort: 'relevance' | 'recent' | 'classics' | 'upcoming';
  offset: number;
}
export function parseFilters(params: URLSearchParams): CatalogueFilters {
  const q = text(params.get('q') ?? '', 'Búsqueda', 80, 0);
  const platform = text(params.get('platform') ?? '', 'Plataforma', 100, 0);
  const genre = text(params.get('genre') ?? '', 'Género', 100, 0);
  const year = params.get('year') ? Number(params.get('year')) : null;
  const minRating = params.get('rating') ? Number(params.get('rating')) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100))
    throw new ValidationError('Año inválido.');
  if (minRating !== null && (!Number.isFinite(minRating) || minRating < 1 || minRating > 10))
    throw new ValidationError('Puntuación mínima inválida.');
  const sort = params.get('sort') || 'relevance';
  const offset = Number(params.get('offset') || 0);
  if (sort !== 'relevance' && sort !== 'recent' && sort !== 'classics' && sort !== 'upcoming')
    throw new ValidationError('Orden inválido.');
  if (!Number.isInteger(offset) || offset < 0 || offset > 960 || offset % 24 !== 0)
    throw new ValidationError('Página inválida.');
  return { q, platform, genre, year, minRating, sort, offset };
}
const PLATFORM_ALIASES: Record<string, string> = {
  pc: 'PC (Microsoft Windows)',
  windows: 'PC (Microsoft Windows)',
  'pc (microsoft windows)': 'PC (Microsoft Windows)',
  ps5: 'PlayStation 5',
  'playstation 5': 'PlayStation 5',
  ps4: 'PlayStation 4',
  'playstation 4': 'PlayStation 4',
  ps3: 'PlayStation 3',
  'playstation 3': 'PlayStation 3',
  ps2: 'PlayStation 2',
  'playstation 2': 'PlayStation 2',
  ps1: 'PlayStation',
  psx: 'PlayStation',
  playstation: 'PlayStation',
  switch: 'Nintendo Switch',
  'nintendo switch': 'Nintendo Switch',
  'xbox series': 'Xbox Series X|S',
  'xbox series x': 'Xbox Series X|S',
  'xbox series s': 'Xbox Series X|S',
  'xbox series x|s': 'Xbox Series X|S',
  'xbox one': 'Xbox One',
  'xbox 360': 'Xbox 360',
  snes: 'Super Nintendo Entertainment System',
  'super nintendo': 'Super Nintendo Entertainment System',
  'super nintendo entertainment system': 'Super Nintendo Entertainment System',
  n64: 'Nintendo 64',
  'nintendo 64': 'Nintendo 64',
  gba: 'Game Boy Advance',
  'game boy advance': 'Game Boy Advance',
  mac: 'Mac',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
};
export function resolveCanonicalPlatform(input: string): { canonical: string | null; raw: string } {
  const trimmed = input.trim();
  const mapped = Object.hasOwn(PLATFORM_ALIASES, trimmed.toLowerCase())
    ? PLATFORM_ALIASES[trimmed.toLowerCase()]
    : undefined;
  return { canonical: mapped ?? null, raw: mapped ?? trimmed };
}
export function igdbQuery(filters: CatalogueFilters): string {
  const quote = (value: string) => JSON.stringify(value);
  const where: string[] = ['version_parent = null'];
  const todaySec = Math.floor(Date.now() / 86400000) * 86400;
  const currentYear = new Date().getUTCFullYear();
  if (filters.sort === 'recent' && (!filters.year || filters.year <= currentYear))
    where.push(`first_release_date <= ${todaySec}`);
  if (filters.sort === 'upcoming') {
    if (!filters.year || filters.year >= currentYear)
      where.push(`first_release_date > ${todaySec}`);
    where.push('cover.image_id != null');
  }
  if (filters.sort === 'classics' && (!filters.year || filters.year < 2010))
    where.push('first_release_date < 1262304000');
  if (filters.q) {
    const q = quote(filters.q.replace(/[\r\n]/g, ' '));
    where.push(
      `(name ~ *${q}* | involved_companies.company.name ~ *${q}* | collections.name ~ *${q}*)`,
    );
  }
  if (filters.platform) {
    const { canonical, raw } = resolveCanonicalPlatform(filters.platform);
    where.push(
      canonical
        ? 'platforms.name = ' + quote(canonical)
        : 'platforms.name ~ *' + quote(raw.replace(/[\r\n]/g, ' ')) + '*',
    );
  }
  if (filters.minRating !== null)
    where.push('total_rating >= ' + Math.round(filters.minRating * 10));
  if (filters.genre) where.push(`genres.name = ${quote(filters.genre)}`);
  if (filters.year) {
    const start = Date.UTC(filters.year, 0, 1) / 1000,
      end = Date.UTC(filters.year + 1, 0, 1) / 1000;
    where.push(`first_release_date >= ${start} & first_release_date < ${end}`);
  }
  const sort =
    filters.sort === 'upcoming'
      ? 'first_release_date asc'
      : filters.sort === 'recent'
        ? 'first_release_date desc'
        : 'total_rating_count desc';
  return `fields id,name,slug,cover.image_id,summary,first_release_date,total_rating,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,collections.name; where ${where.join(' & ')}; sort ${sort}; limit 24; offset ${filters.offset};`;
}
export function daysUntilRelease(unixSeconds?: number | null, nowMs = Date.now()): number | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
  const diffMs = unixSeconds * 1000 - nowMs;
  return diffMs > 0 ? Math.ceil(diffMs / 86400000) : null;
}
export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id?: string };
  summary?: string;
  first_release_date?: number;
  total_rating?: number;
  platforms?: { name: string }[];
  genres?: { name: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name: string } }[];
  collections?: { name: string }[];
}
export function mapIgdbGame(game: IgdbGame) {
  if (
    !Number.isSafeInteger(game.id) ||
    game.id <= 0 ||
    !game.name ||
    !/^[a-z0-9-]+$/.test(game.slug)
  )
    throw new ValidationError('Respuesta inválida del catálogo.');
  const image = game.cover?.image_id;
  return {
    igdb_id: game.id,
    title: game.name,
    slug: game.slug,
    cover_url:
      image && /^[a-zA-Z0-9_]+$/.test(image)
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${image}.jpg`
        : null,
    release_year: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    platforms: game.platforms?.map((p) => p.name) ?? [],
    genres: game.genres?.map((g) => g.name) ?? [],
    developer:
      game.involved_companies
        ?.filter((c) => c.developer)
        .map((c) => c.company?.name)
        .filter(Boolean)
        .join(', ') || null,
    publisher:
      game.involved_companies
        ?.filter((c) => c.publisher)
        .map((c) => c.company?.name)
        .filter(Boolean)
        .join(', ') || null,
    series: game.collections?.map((c) => c.name).join(', ') || null,
    synopsis: game.summary ?? null,
    cached_at: new Date().toISOString(),
  };
}
