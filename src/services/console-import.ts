import 'server-only';
import { authenticated } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, status, text, uuid } from '@/domain/validation';
import {
  consoleSource,
  consoleIdentity,
  consoleHours,
  consolePlatform,
  parseConsoleImport,
} from '@/domain/console-import';
import { catalogue } from '@/services/catalogue';
import { parseFilters } from '@/integrations/igdb/query';
import { fetchPsnTitles, fetchXboxTitles } from '@/integrations/consoles/server';
import { grantXp, grantCompletionXp } from '@/services/progression';

export async function consoleImportMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  const source = consoleSource(data.source);
  if (data.action === 'identity') {
    const identity = consoleIdentity(data.identity);
    const result = await db
      .from('profiles')
      .update(source === 'PlayStation' ? { psn_id: identity } : { xbox_gamertag: identity })
      .eq('id', user.id)
      .select('id')
      .single();
    if (result.error?.code === '42703' || result.error?.code === 'PGRST204')
      throw new AppError('Aplica la migración 016 para guardar tus identificadores.', 503);
    dbCheck(result.error);
    return { identity };
  }
  if (data.action === 'sync') {
    const identity = consoleIdentity(data.identity);
    if (!identity) {
      throw new AppError(
        source === 'PlayStation'
          ? 'Ingresa tu PSN Online ID para sincronizar.'
          : 'Ingresa tu Xbox Gamertag para sincronizar.',
        400,
      );
    }
    const saved = await db
      .from('profiles')
      .update(source === 'PlayStation' ? { psn_id: identity } : { xbox_gamertag: identity })
      .eq('id', user.id)
      .select('id')
      .single();
    if (saved.error?.code === '42703' || saved.error?.code === 'PGRST204')
      throw new AppError('Aplica la migración 016 para guardar el identificador.', 503);
    dbCheck(saved.error);

    const titles =
      source === 'PlayStation' ? await fetchPsnTitles(identity) : await fetchXboxTitles(identity);
    await grantXp(
      user.id,
      200,
      source === 'PlayStation' ? 'psn_connected' : 'xbox_connected',
      source,
    );
    return titles;
  }
  if (data.action === 'preview')
    return parseConsoleImport(data.content, data.format, source, data.platform);
  if (data.action === 'match') {
    const result = await catalogue(
      parseFilters(new URLSearchParams({ q: text(data.title, 'Título', 200).slice(0, 80) })),
    );
    return {
      games: result.games.map(({ id, title, cover_url, release_year, platforms }) => ({
        id,
        title,
        cover_url,
        release_year,
        platforms,
      })),
      message: result.message,
    };
  }
  if (data.action !== 'commit') throw new AppError('Operación de importación inválida.', 400);
  const result = await db
    .rpc('import_console_game', {
      p_game_id: uuid(data.game_id),
      p_status: status(data.status),
      p_platform: consolePlatform(data.platform, source),
      p_hours: consoleHours(data.hours),
      p_source: source,
    })
    .retry(false);
  if (result.error?.code === 'PGRST202')
    throw new AppError('Aplica la migración 016 para importar juegos de consola.', 503);
  dbCheck(result.error);
  await grantCompletionXp(db, user.id, uuid(data.game_id));
  return {
    state: result.data,
    message:
      result.data === 'existing'
        ? 'Ya estaba en la biblioteca; datos conservados y plataforma registrada sin sumar horas.'
        : 'Importado con plataforma y horas.',
  };
}
