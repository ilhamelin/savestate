import { ValidationError, text } from '../../domain/validation.ts';
export interface CatalogueFilters {
  q: string;
  platform: string;
  genre: string;
  year: number | null;
  minRating: number | null;
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
  return { q, platform, genre, year, minRating };
}
export function igdbQuery(filters: CatalogueFilters): string {
  const quote = (value: string) => JSON.stringify(value);
  const where: string[] = ['version_parent = null'];
  if (filters.q) {
    const q = quote(filters.q.replace(/[\r\n]/g, ' '));
    where.push(
      `(name ~ *${q}* | involved_companies.company.name ~ *${q}* | collections.name ~ *${q}*)`,
    );
  }
  if (filters.platform) where.push(`platforms.name = ${quote(filters.platform)}`);
  if (filters.genre) where.push(`genres.name = ${quote(filters.genre)}`);
  if (filters.year) {
    const start = Date.UTC(filters.year, 0, 1) / 1000,
      end = Date.UTC(filters.year + 1, 0, 1) / 1000;
    where.push(`first_release_date >= ${start} & first_release_date < ${end}`);
  }
  return `fields id,name,slug,cover.image_id,summary,first_release_date,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,collections.name; where ${where.join(' & ')}; sort first_release_date desc; limit 24;`;
}
export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id?: string };
  summary?: string;
  first_release_date?: number;
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
