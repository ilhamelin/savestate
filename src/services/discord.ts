import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { AppError } from '@/lib/http';
import { appUrl } from '@/lib/env';
import {
  discordContent,
  discordWebhook,
  normalizedDiscordMessages,
  normalizedDiscordPresence,
  completedDiscordProgress,
  discordCoverUrl,
} from '@/domain/discord';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

function configuration() {
  const token = process.env.DISCORD_BOT_TOKEN,
    channel = process.env.DISCORD_CHANNEL_ID;
  if (!token || !channel || !/^\d{16,22}$/.test(channel))
    throw new AppError('El chat de Discord aún no está configurado.', 503);
  return { token, channel };
}
async function discordRequest(url: string, options: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(7000),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    throw new AppError('No se pudo conectar con Discord.', 503);
  }
  if (response.status === 429)
    throw new AppError('Discord está limitando las solicitudes. Espera unos segundos.', 429);
  if (!response.ok)
    throw new AppError(
      'Discord no pudo completar la solicitud. Revisa permisos y configuración del bot.',
      503,
    );
  return response;
}
const cachedMessages = unstable_cache(
  async (channel: string, limit: number) => {
    const { token } = configuration();
    const response = await discordRequest(
      `https://discord.com/api/v10/channels/${channel}/messages?limit=${limit}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          'User-Agent': 'SaveState (https://savestate-eight.vercel.app, 1.0)',
        },
      },
    );
    return normalizedDiscordMessages(await response.json());
  },
  ['discord-messages-v1'],
  { revalidate: 5, tags: ['discord-messages'] },
);

export async function fetchDiscordMessages(limit = 30) {
  const { channel } = configuration();
  return cachedMessages(channel, Math.max(1, Math.min(30, Math.floor(limit) || 30)));
}
const cachedGuildId = unstable_cache(
  async (channel: string) => {
    const { token } = configuration();
    const response = await discordRequest(`https://discord.com/api/v10/channels/${channel}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    const data: unknown = await response.json();
    const guildId = data && typeof data === 'object' && 'guild_id' in data ? data.guild_id : null;
    if (typeof guildId !== 'string' || !/^\d{16,22}$/.test(guildId))
      throw new AppError('Servidor Discord no disponible.', 503);
    return guildId;
  },
  ['discord-channel-guild-v1'],
  { revalidate: 300 },
);
const cachedPresence = unstable_cache(
  async (guildId: string) => {
    const response = await discordRequest(
      `https://discord.com/api/v10/guilds/${guildId}/widget.json`,
      {},
    );
    return normalizedDiscordPresence(await response.json());
  },
  ['discord-presence-v1'],
  { revalidate: 15 },
);
export async function fetchDiscordPresence() {
  try {
    const { channel } = configuration();
    return await cachedPresence(await cachedGuildId(channel));
  } catch {
    return { onlineCount: 0, members: [] };
  }
}
export async function sendDiscordMessage(username: string, content: string) {
  const { token, channel } = configuration();
  const text = discordContent(content);
  const safeName = username.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
  const response = await discordRequest(
    `https://discord.com/api/v10/channels/${channel}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SaveState (https://savestate-eight.vercel.app, 1.0)',
      },
      body: JSON.stringify({
        content: `**[@${safeName} en Savestate]:** ${text}`,
        allowed_mentions: { parse: [], replied_user: false },
      }),
    },
  );
  const message = normalizedDiscordMessages([await response.json()])[0] ?? null;
  revalidateTag('discord-messages', { expire: 0 });
  return message;
}
export function discordConfigured() {
  try {
    configuration();
    return true;
  } catch {
    return false;
  }
}
export type DiscordCheckpoint = {
  type: 'platinum' | 'levelup' | 'forum' | 'itch';
  username: string;
  details: string;
  path?: string;
  coverUrl?: string | null;
};
export async function notifyDiscordCheckpoint(event: DiscordCheckpoint) {
  const webhook = discordWebhook(process.env.DISCORD_WEBHOOK_URL ?? '');
  if (!webhook) return;
  const meta = {
    platinum: { title: '🏆 ¡NUEVO PLATINO DESBLOQUEADO!', color: 0xffd700 },
    levelup: { title: '⚡ LEVEL UP', color: 0x00f0ff },
    forum: { title: '💬 Nuevo debate en el Foro', color: 0x39ff14 },
    itch: { title: '🕹️ Nueva transmisión indie · itch.io', color: 0xbc66ff },
  }[event.type];
  const target = new URL(appUrl());
  if (event.path?.startsWith('/') && !event.path.startsWith('//')) {
    const candidate = new URL(event.path, target);
    if (candidate.origin === target.origin) {
      target.pathname = candidate.pathname;
      target.search = candidate.search;
      target.hash = candidate.hash;
    }
  }
  const endpoint = new URL(webhook);
  const coverUrl = discordCoverUrl(event.coverUrl);
  endpoint.searchParams.set('with_components', 'true');
  endpoint.searchParams.set('wait', 'true');
  await discordRequest(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          ...meta,
          description: `@${event.username}: ${event.details}`.slice(0, 1500),
          timestamp: new Date().toISOString(),
          url: target.toString(),
          ...(coverUrl ? { thumbnail: { url: coverUrl } } : {}),
        },
      ],
      components: [
        {
          type: 1,
          components: [{ type: 2, style: 5, label: '🌐 Ver en SaveState', url: target.toString() }],
        },
      ],
    }),
  });
}
export function scheduleDiscordCheckpoint(event: DiscordCheckpoint) {
  if (!discordWebhook(process.env.DISCORD_WEBHOOK_URL ?? '')) return;
  after(async () => {
    try {
      await notifyDiscordCheckpoint(event);
    } catch {
      console.warn('Discord checkpoint delivery failed', { type: event.type });
    }
  });
}
// Announce a newly saved 100% result; repeated syncs and private libraries stay silent.
export async function notifyDiscordProgress(
  db: SupabaseClient<Database>,
  userId: string,
  entryId: string,
  previous: unknown,
  next: unknown,
  logId: string,
) {
  if (
    !process.env.DISCORD_WEBHOOK_URL ||
    completedDiscordProgress(previous) ||
    !completedDiscordProgress(next)
  )
    return;
  try {
    const [profile, entry, logs] = await Promise.all([
      db.from('profiles').select('username,library_private').eq('id', userId).maybeSingle(),
      db
        .from('user_games')
        .select('status,games!inner(title,cover_url)')
        .eq('id', entryId)
        .eq('user_id', userId)
        .maybeSingle(),
      db.from('play_logs').select('id,hours_played,console_progress').eq('user_game_id', entryId),
    ]);
    if (
      profile.error ||
      entry.error ||
      logs.error ||
      !profile.data ||
      profile.data.library_private ||
      !entry.data ||
      entry.data.status === 'platinum'
    )
      return;
    if (
      logs.data?.some((log) => log.id !== logId && completedDiscordProgress(log.console_progress))
    )
      return;
    scheduleDiscordCheckpoint({
      type: 'platinum',
      username: profile.data.username,
      coverUrl: entry.data.games.cover_url,
      details: `completó el 100% de logros/trofeos de ${entry.data.games.title} (${(logs.data ?? []).reduce((sum, log) => sum + Number(log.hours_played), 0).toFixed(2)} horas registradas).`,
      path: `/players/${encodeURIComponent(profile.data.username)}#achievements-showcase-heading`,
    });
  } catch {
    console.warn('Discord progress notification preparation failed');
  }
}
