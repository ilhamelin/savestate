import 'server-only';
import { authenticated } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid } from '@/domain/validation';
import { matchingTitle, steamStatus } from '@/domain/steam';
import { ownedSteamGames, steamTicket, readSteamTicket } from '@/integrations/steam/server';
import { catalogue } from '@/services/catalogue';
import { parseFilters } from '@/integrations/igdb/query';

export async function steamMutation(input: unknown) {
  const { db, user } = await authenticated(),
    data = object(input);
  if (data.action === 'preview') {
    const offset = data.offset === undefined ? 0 : Number(data.offset);
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || offset % 250 !== 0)
      throw new AppError('Página de Steam inválida.', 400);
    const games = await ownedSteamGames(data.profile);
    return {
      games: games
        .slice(offset, offset + 250)
        .map((game) => ({ ...game, ticket: steamTicket(game, user.id) })),
      total: games.length,
      nextOffset: offset + 250 < games.length ? offset + 250 : null,
    };
  }
  const source = readSteamTicket(data.ticket, user.id);
  const search = async () => {
    const q = source.name.slice(0, 80);
    const result = await catalogue(
      parseFilters(new URLSearchParams({ q, platform: 'PC (Microsoft Windows)' })),
    );
    return result.games.map((game) => ({
      id: game.id,
      title: game.title,
      release_year: game.release_year,
      slug: game.slug,
    }));
  };
  if (data.action === 'match') return search();
  if (data.action !== 'commit') throw new AppError('Operación de importación inválida.', 400);
  let gameId: string;
  if (data.game_id) {
    gameId = uuid(data.game_id);
    const exists = await db.from('games').select('id').eq('id', gameId).maybeSingle();
    dbCheck(exists.error);
    if (!exists.data) throw new AppError('Juego no encontrado.', 404);
  } else {
    const candidates = (await search()).filter(
      (game) => matchingTitle(game.title) === matchingTitle(source.name),
    );
    if (candidates.length !== 1)
      return {
        state: 'unmatched',
        appid: source.appid,
        message: 'Elige una coincidencia de catálogo antes de importar.',
      };
    gameId = candidates[0]!.id;
  }
  const result = await db.rpc('import_steam_game', {
    p_game_id: gameId,
    p_status: steamStatus(data.status),
    p_minutes: source.minutes,
    p_appid: source.appid,
  });
  if (result.error?.code === 'PGRST202')
    throw new AppError('Aplica la migración 010 para activar el guardado de importaciones.', 503);
  dbCheck(result.error);
  return {
    state: result.data,
    appid: source.appid,
    message:
      result.data === 'existing'
        ? 'Ya estaba en tu biblioteca; se conservó intacto.'
        : 'Importado con sus horas acumuladas.',
  };
}
