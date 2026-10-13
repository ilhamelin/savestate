import 'server-only';
import { publicClient } from '@/integrations/supabase/public';
import { appUrl } from '@/lib/env';
import { text, username } from '@/domain/validation';
import { record } from '@/domain/game-live-telemetry';
import {
  freebiesCommandResponse,
  valorantCommandResponse,
  lolCommandResponse,
  genshinCommandResponse,
} from '@/domain/discord-bot-cards';
import { getActiveFreebies } from '@/services/freebies';
import { AppError } from '@/lib/http';
import { ValidationError } from '@/domain/validation';
import {
  discordCommandError,
  discordCommandMessage,
  gameCommandResponse,
  profileCommandResponse,
} from '@/domain/discord-commands';
export function interactionCommand(input: unknown) {
  const data = record(record(input).data);
  const options = Array.isArray(data.options) ? data.options.map(record) : [];
  return {
    name: data.name,
    username: options.find((option) => option.name === 'usuario')?.value,
    title: options.find((option) => option.name === 'titulo')?.value,
    region: options.find((option) => option.name === 'region')?.value,
    uid: options.find((option) => option.name === 'uid')?.value,
  };
}
export async function discordAutocompleteResponse(input: unknown) {
  const data = record(record(input).data);
  const options = Array.isArray(data.options) ? data.options.map(record) : [];
  const focused = options.find((option) => option.focused === true);
  const empty = { type: 8, data: { choices: [] as { name: string; value: string }[] } };
  const isProfile = data.name === 'perfil' && focused?.name === 'usuario';
  const isGame = data.name === 'juego' && focused?.name === 'titulo';
  if ((!isProfile && !isGame) || typeof focused?.value !== 'string') return empty;
  const value = isProfile ? focused.value.trim().replace(/^@/, '') : focused.value.trim();
  if (!value || value.length > 100) return empty;
  const escaped = value.replace(/[%_\\]/g, (char) => `\\${char}`);
  try {
    const db = publicClient();
    const response = isProfile
      ? await db
          .from('profiles')
          .select('username')
          .ilike('username', `%${escaped}%`)
          .order('username')
          .limit(5)
          .abortSignal(AbortSignal.timeout(1500))
      : await db
          .from('games')
          .select('title')
          .ilike('title', `%${escaped}%`)
          .order('title')
          .limit(5)
          .abortSignal(AbortSignal.timeout(1500));
    if (response.error) return empty;
    const choices = (response.data ?? []).flatMap((item) => {
      const row = record(item);
      const label = isProfile ? row.username : row.title;
      return typeof label === 'string' && label.length > 0 && label.length <= 100
        ? [{ name: label, value: label }]
        : [];
    });
    return { type: 8, data: { choices: choices.slice(0, 5) } };
  } catch {
    return empty;
  }
}
export async function discordCommandResponse(input: unknown) {
  const command = interactionCommand(input),
    base = appUrl();
  if (command.name === 'web' || command.name === 'savestate')
    return discordCommandMessage(
      '🎮 SAVESTATE // YOUR NEXT CHECKPOINT',
      'Tu diario de partidas, logros y colecciones. Conecta con tu comunidad gamer.',
      base,
    );
  try {
    if (command.name === 'gratis') return freebiesCommandResponse(await getActiveFreebies(), base);
    if (command.name === 'valorant' || command.name === 'genshin') {
      const { inspectCompetitive } = await import('@/services/competitive-tracker');
      if (command.name === 'genshin') {
        const uid = text(command.uid, 'UID', 9, 9);
        if (!/^\d{9}$/.test(uid)) throw new ValidationError('El UID debe tener 9 dígitos.');
        const profile = await inspectCompetitive({ game: 'genshin', uid });
        if (profile.game !== 'genshin') throw new Error('Unexpected tracker result');
        return genshinCommandResponse(profile, base);
      }
      const region = command.region ?? 'latam';
      if (!['latam', 'br', 'na', 'eu'].includes(String(region)))
        throw new ValidationError('Selecciona una región válida de Valorant.');
      const profile = await inspectCompetitive({
        game: 'valorant',
        riotId: command.username,
        region,
      });
      if (profile.game !== 'valorant') throw new Error('Unexpected tracker result');
      return valorantCommandResponse(profile, base);
    }
    if (command.name === 'lol') {
      const region = command.region ?? 'la2';
      if (!['la1', 'la2', 'na1', 'br1', 'euw1'].includes(String(region)))
        throw new ValidationError('Selecciona un servidor válido de LoL.');
      const { inspectLol } = await import('@/integrations/riot/server');
      return lolCommandResponse(await inspectLol(command.username, region, 0, 1), base);
    }
    const db = publicClient();
    if (command.name === 'perfil') {
      const name = username(
        typeof command.username === 'string'
          ? command.username.replace(/^@/, '')
          : command.username,
      );
      const profile = await db
        .from('profiles')
        .select('id,username,level,equipped_title,library_private,terminal_status')
        .eq('username_normalized', name.toLowerCase())
        .abortSignal(AbortSignal.timeout(5000))
        .maybeSingle();
      if (profile.error)
        return discordCommandError('No se pudo consultar el perfil. Inténtalo de nuevo.');
      if (!profile.data) return discordCommandError('No se encontró ese usuario en SaveState.');
      const profileId = profile.data.id;
      let count: number | null = null;
      let details = {
        cleared: null as number | null,
        platinum: null as number | null,
        favorites: [] as string[],
      };
      if (!profile.data.library_private) {
        const countQuery = () =>
          db
            .from('user_games')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profileId);
        const [entries, cleared, platinum, favorites] = await Promise.all([
          countQuery().abortSignal(AbortSignal.timeout(5000)),
          countQuery().eq('status', 'cleared').abortSignal(AbortSignal.timeout(5000)),
          countQuery().eq('status', 'platinum').abortSignal(AbortSignal.timeout(5000)),
          db
            .from('user_games')
            .select('favorite_position,games(title)')
            .eq('user_id', profileId)
            .gte('favorite_position', 1)
            .lte('favorite_position', 4)
            .order('favorite_position')
            .limit(4)
            .abortSignal(AbortSignal.timeout(5000)),
        ]);
        if (!entries.error) count = entries.count;
        details = {
          cleared: cleared.error ? null : cleared.count,
          platinum: platinum.error ? null : platinum.count,
          favorites: favorites.error
            ? []
            : (favorites.data ?? []).flatMap((item) => {
                const title = record(item.games).title;
                return typeof title === 'string' ? [title] : [];
              }),
        };
      }
      return profileCommandResponse(base, profile.data, count, details);
    }
    if (command.name === 'juego') {
      const title = text(command.title, 'Título', 100, 2).replace(/[%_\\]/g, (char) => `\\${char}`);
      const game = await db
        .from('games')
        .select('id,title,slug,cover_url,release_year,genres,platforms')
        .ilike('title', `%${title}%`)
        .order('title')
        .limit(1)
        .abortSignal(AbortSignal.timeout(5000))
        .maybeSingle();
      if (game.error)
        return discordCommandError('No se pudo consultar el catálogo. Inténtalo de nuevo.');
      if (!game.data)
        return discordCommandError('No se encontró ese título en el catálogo local de SaveState.');
      const players = await db
        .from('user_games')
        .select('id,profiles!inner(library_private)', { count: 'exact', head: true })
        .eq('game_id', game.data.id)
        .eq('profiles.library_private', false)
        .abortSignal(AbortSignal.timeout(5000));
      return gameCommandResponse(base, game.data, players.error ? null : players.count);
    }
    return discordCommandError(
      'Comando no reconocido. Usa /web, /perfil, /juego, /gratis, /valorant, /lol o /genshin.',
    );
  } catch (error) {
    if (error instanceof AppError || error instanceof ValidationError)
      return discordCommandError(error.message);
    return discordCommandError('Revisa los datos del comando e inténtalo de nuevo.');
  }
}
export async function finishDiscordInteraction(input: unknown) {
  const payload = record(input),
    id = (process.env.DISCORD_APPLICATION_ID || '1557446548982464652').trim();
  if (
    !id ||
    !/^\d{16,22}$/.test(id) ||
    typeof payload.token !== 'string' ||
    !/^[A-Za-z0-9_.-]{1,300}$/.test(payload.token)
  )
    return;
  const result = await discordCommandResponse(input);
  const webhook = `https://discord.com/api/v10/webhooks/${id}/${encodeURIComponent(payload.token)}`;
  const deliver = async (path: string, method: string, message?: unknown) => {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: message === undefined ? undefined : JSON.stringify(message),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error('Discord interaction update failed');
  };
  if (result.data.flags === 64) {
    // Complete the public defer before creating a separate, private error followup.
    // Discord preserves the original visibility on edits and the first deferred followup.
    await deliver(`${webhook}/messages/@original`, 'PATCH', {
      content: '\u200b',
      allowed_mentions: { parse: [] },
    });
    try {
      await deliver(webhook, 'POST', result.data);
    } finally {
      await deliver(`${webhook}/messages/@original`, 'DELETE');
    }
    return;
  }
  await deliver(`${webhook}/messages/@original`, 'PATCH', result.data);
}
