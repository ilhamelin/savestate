import 'server-only';
import { isConfigured } from '@/lib/env';
import { fetchCatalogue } from '@/integrations/igdb/server';
import { catalogueAdmin } from '@/integrations/supabase/admin';
import { localCatalogue } from '@/repositories/catalogue';
import type { CatalogueFilters } from '@/integrations/igdb/query';
import { dbCheck } from '@/lib/http';
export async function catalogue(filters: CatalogueFilters) {
  if (!isConfigured())
    return {
      games: [],
      source: 'unconfigured' as const,
      message: 'El catálogo estará disponible cuando conectes Supabase e IGDB.',
    };
  let source: 'igdb' | 'local' = 'local';
  const local = await localCatalogue(filters);
  if (local.length && local.every((game) => Date.now() - Date.parse(game.cached_at) < 86400000)) {
    return { games: local, source: 'cache' as const, message: null };
  }
  if (
    process.env.TWITCH_CLIENT_ID &&
    process.env.TWITCH_CLIENT_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const games = await fetchCatalogue({ ...filters, minRating: null });
      if (games.length) {
        const { error } = await catalogueAdmin()
          .from('games')
          .upsert(games, { onConflict: 'igdb_id' });
        dbCheck(error);
      }
      source = 'igdb';
    } catch (error) {
      console.warn('IGDB fallback', error instanceof Error ? error.name : 'unknown');
    }
  }
  return {
    games: await localCatalogue(filters),
    source,
    message:
      source === 'local'
        ? 'Consultando el catálogo almacenado. IGDB no está disponible o aún no está configurado.'
        : null,
  };
}
