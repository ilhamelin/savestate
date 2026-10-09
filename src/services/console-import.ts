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
  type ConsoleRow,
  type ConsoleSource,
} from '@/domain/console-import';
import { catalogue } from '@/services/catalogue';
import { parseFilters } from '@/integrations/igdb/query';
import { fetchPsnTitles, fetchXboxTitles } from '@/integrations/consoles/server';
import { grantXp, grantCompletionXp } from '@/services/progression';
import { consoleProgress } from '@/domain/console-progress';
import {
  consoleProgressUpdates,
  type ImportedProgressLog,
} from '@/domain/console-progress-refresh';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';

async function refreshConsoleProgress(
  db: SupabaseClient<Database>,
  userId: string,
  titles: ConsoleRow[],
  source: ConsoleSource,
) {
  const logs: ImportedProgressLog[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .from('play_logs')
      .select(
        'id,platform_played,note,console_progress,user_games!inner(user_id,games!inner(title))',
      )
      .eq('user_games.user_id', userId)
      .order('id')
      .range(offset, offset + 999);
    dbCheck(result.error);
    for (const row of result.data ?? [])
      logs.push({
        id: row.id,
        title: row.user_games.games.title,
        platform: row.platform_played,
        note: row.note,
        progress: row.console_progress,
      });
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const updates = consoleProgressUpdates(logs, titles, source);
  for (let index = 0; index < updates.length; index += 5) {
    const results = await Promise.allSettled(
      updates.slice(index, index + 5).map(async (item) => {
        const saved = await db
          .from('play_logs')
          .update({ console_progress: item.progress })
          .eq('id', item.id);
        dbCheck(saved.error);
      }),
    );
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }
  if (updates.length) {
    revalidatePath('/library');
    revalidatePath('/players/[username]', 'page');
  }
}

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

    const received =
      source === 'PlayStation' ? await fetchPsnTitles(identity) : await fetchXboxTitles(identity);
    const titles = received.map((row) =>
      row.progress ? { ...row, progress: { ...row.progress, source_title: row.title } } : row,
    );
    await refreshConsoleProgress(db, user.id, titles, source);
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
  const progress = consoleProgress(data.progress, source);
  if (progress && data.source_title !== undefined)
    progress.source_title = text(data.source_title, 'Título de origen', 200);
  const gameId = uuid(data.game_id),
    platform = consolePlatform(data.platform, source);
  const result = await db
    .rpc('import_console_game', {
      p_game_id: gameId,
      p_status: status(data.status),
      p_platform: platform,
      p_hours: consoleHours(data.hours),
      p_source: source,
    })
    .retry(false);
  if (result.error?.code === 'PGRST202')
    throw new AppError('Aplica la migración 016 para importar juegos de consola.', 503);
  dbCheck(result.error);
  if (progress) {
    const entry = await db
      .from('user_games')
      .select('id')
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .single();
    dbCheck(entry.error);
    if (!entry.data) throw new AppError('Registro importado no encontrado.', 404);
    const saved = await db
      .from('play_logs')
      .update({ console_progress: progress })
      .eq('user_game_id', entry.data.id)
      .eq('platform_played', platform)
      .eq('note', `[${source}] Partida importada a la biblioteca.`)
      .select('id');
    if (saved.error?.code === '42703' || saved.error?.code === 'PGRST204')
      throw new AppError('Aplica la migración 018 para conservar el progreso de consola.', 503);
    dbCheck(saved.error);
    if (!saved.data?.length) throw new AppError('Partida importada no encontrada.', 404);
  }
  await grantCompletionXp(db, user.id, uuid(data.game_id));
  return {
    state: result.data,
    message:
      result.data === 'existing'
        ? 'Ya estaba en la biblioteca; datos conservados y plataforma registrada sin sumar horas.'
        : 'Importado con plataforma y horas.',
  };
}
