import 'server-only';
import { isConfigured } from '@/lib/env';
import { fetchCatalogue } from '@/integrations/igdb/server';
import { catalogueAdmin } from '@/integrations/supabase/admin';
import { localCatalogue } from '@/repositories/catalogue';
import type { CatalogueFilters } from '@/integrations/igdb/query';
import { daysUntilRelease } from '@/integrations/igdb/query';
import { dbCheck } from '@/lib/http';
export async function catalogue(filters: CatalogueFilters) {
  if (!isConfigured())
    return {
      games: [],
      nextOffset: null,
      source: 'unconfigured' as const,
      message: 'El catálogo estará disponible cuando conectes Supabase e IGDB.',
    };
  let source: 'igdb' | 'local' = 'local';
  let igdbIds: number[] | undefined;
  const releaseDates = new Map<number, number | null>();
  // The 24h cache in fetchCatalogue is keyed by the complete query. Fresh local
  // rows alone cannot establish that a broader or different search is complete.
  if (
    process.env.TWITCH_CLIENT_ID &&
    process.env.TWITCH_CLIENT_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const games = await fetchCatalogue({ ...filters, minRating: null });
      const rows = games.map(({ first_release_date, ...row }) => {
        releaseDates.set(row.igdb_id, first_release_date);
        return row;
      });
      if (games.length) {
        const { error } = await catalogueAdmin()
          .from('games')
          .upsert(rows, { onConflict: 'igdb_id' });
        dbCheck(error);
      }
      source = 'igdb';
      igdbIds = games.map((game) => game.igdb_id);
    } catch (error) {
      console.warn('IGDB fallback', error instanceof Error ? error.name : 'unknown');
    }
  }
  const page = await localCatalogue({ ...filters, minRating: null }, igdbIds);
  const games = filters.minRating
    ? page.filter(
        (game) => game.community_rating !== null && game.community_rating >= filters.minRating!,
      )
    : page;
  const pageSize = igdbIds?.length ?? page.length;
  return {
    games: games.map((game) => {
      const timestamp = source === 'igdb' ? releaseDates.get(game.igdb_id) : null;
      const date = timestamp && Number.isFinite(timestamp) ? new Date(timestamp * 1000) : null;
      return {
        ...game,
        release_date: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
        days_until_release: daysUntilRelease(timestamp),
      };
    }),
    nextOffset: pageSize === 24 && filters.offset < 960 ? filters.offset + 24 : null,
    source,
    message:
      source === 'local'
        ? filters.sort === 'upcoming'
          ? 'Catálogo local por año: puede incluir juegos ya estrenados. Las fechas exactas y cuentas regresivas requieren IGDB.'
          : 'Consultando el catálogo almacenado. IGDB no está disponible o aún no está configurado.'
        : null,
  };
}
