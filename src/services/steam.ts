import 'server-only';
import { authenticated } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid, text } from '@/domain/validation';
import { cleanSteamSearchTitle, searchSteamCandidates } from '@/domain/steam-matching';
import { matchingTitle, steamStatus } from '@/domain/steam';
import { ownedSteamLibrary, steamTicket, readSteamTicket } from '@/integrations/steam/server';
import { catalogue } from '@/services/catalogue';
import { parseFilters } from '@/integrations/igdb/query';
import { grantXp, grantCompletionXp } from '@/services/progression';

export async function steamMutation(input: unknown) {
  const { db, user } = await authenticated(),
    data = object(input);
  if (data.action === 'preview') {
    const offset = data.offset === undefined ? 0 : Number(data.offset);
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || offset % 250 !== 0)
      throw new AppError('Página de Steam inválida.', 400);
    const { games, steamid } = await ownedSteamLibrary(data.profile);
    return {
      games: games
        .slice(offset, offset + 250)
        .map((game) => ({ ...game, ticket: steamTicket(game, user.id, steamid) })),
      steamId: steamid,
      linkTicket: steamTicket(
        { appid: 1, name: 'Steam account', minutes: 0 },
        user.id,
        steamid,
        'account',
      ),
      total: games.length,
      nextOffset: offset + 250 < games.length ? offset + 250 : null,
    };
  }
  const source = readSteamTicket(data.ticket, user.id, data.action === 'link' ? 'account' : 'game');
  async function linkAccount() {
    if (!source.steamid)
      throw new AppError('Vuelve a consultar Steam para vincular esta cuenta.', 400);
    const linked = await db.from('profiles').update({ steam_id: source.steamid }).eq('id', user.id);
    if (linked.error?.code === '42703' || linked.error?.code === 'PGRST204')
      throw new AppError('Aplica la migración 014 para activar la sincronización de Steam.', 503);
    dbCheck(linked.error);
    await grantXp(user.id, 200, 'steam_connected', 'Steam');
  }
  if (data.action === 'link') {
    await linkAccount();
    return { message: 'Cuenta vinculada para sincronización rápida. La cuota diaria se conserva.' };
  }
  const search = async (title = source.name) =>
    searchSteamCandidates(title, async (q, platform) => {
      const result = await catalogue(
        parseFilters(new URLSearchParams({ q, ...(platform ? { platform } : {}) })),
      );
      return result.games.map((game) => ({
        id: game.id,
        title: game.title,
        release_year: game.release_year,
        slug: game.slug,
        cover_url: game.cover_url,
      }));
    });
  if (data.action === 'match')
    return search(
      data.title === undefined ? source.name : text(data.title, 'Título de búsqueda', 80),
    );
  if (data.action !== 'commit') throw new AppError('Operación de importación inválida.', 400);
  let gameId: string;
  if (data.game_id) {
    gameId = uuid(data.game_id);
    const exists = await db.from('games').select('id').eq('id', gameId).maybeSingle();
    dbCheck(exists.error);
    if (!exists.data) throw new AppError('Juego no encontrado.', 404);
  } else {
    const candidates = (await search()).filter(
      (game) =>
        matchingTitle(cleanSteamSearchTitle(game.title)) ===
        matchingTitle(cleanSteamSearchTitle(source.name)),
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
  await grantCompletionXp(db, user.id, gameId);
  if (source.steamid) await linkAccount();
  return {
    state: result.data,
    appid: source.appid,
    message:
      result.data === 'existing'
        ? 'Ya estaba en tu biblioteca; se conservaron sus datos y quedó enlazado a Steam.'
        : 'Importado con sus horas acumuladas.',
  };
}
