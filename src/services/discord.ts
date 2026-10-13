import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { AppError } from '@/lib/http';
import { appUrl } from '@/lib/env';
import {
  discordComposerPayload,
  discordWebhook,
  normalizedDiscordMessages,
  normalizedDiscordPresence,
  completedDiscordProgress,
  discordCoverUrl,
  discordSendOptions,
  discordOutgoingMessage,
} from '@/domain/discord';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { registerDiscordApplication } from '@/integrations/discord/application';
import { authorizedDiscordChannels, discordFrequency } from '@/domain/discord-channels';
import type { DiscordFrequency, DiscordSendOptions } from '@/domain/discord-client';
import { getActiveFreebies } from '@/services/freebies';
import { discordFreebieMessage, unseenDiscordFreebies } from '@/domain/discord-bot-cards';
import { discordRetryDelay } from '@/domain/discord-rate-limit';
import { record } from '@/domain/game-live-telemetry';
import {
  shouldAnnounceGta6Countdown,
  shouldAnnounceZeldaOotCountdown,
  shouldAnnounceTga2026Countdown,
  shouldAnnounceAvengersDoomsdayCountdown,
} from '@/domain/gta6-countdown';
import {
  discordGta6CountdownMessage,
  discordZeldaOotCountdownMessage,
  discordTga2026CountdownMessage,
  discordAvengersDoomsdayCountdownMessage,
} from '@/domain/discord-bot-cards';
export async function registerDiscordCommandsAndRoleMetadata() {
  return registerDiscordApplication(
    process.env.DISCORD_APPLICATION_ID ?? '',
    process.env.DISCORD_BOT_TOKEN ?? '',
  );
}

function configuration() {
  const token = process.env.DISCORD_BOT_TOKEN,
    channel = process.env.DISCORD_CHANNEL_ID;
  if (!token || !channel || !/^\d{16,22}$/.test(channel))
    throw new AppError('El chat de Discord aún no está configurado.', 503);
  return { token, channel };
}
async function discordRequest(url: string, options: RequestInit, retryRateLimits = false) {
  async function attempt(retries: number): Promise<Response> {
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
    if (response.status === 429 && retries > 0) {
      const payload: unknown = await response.json().catch(() => null);
      const delay = discordRetryDelay(
        response.headers.get('Retry-After') || record(payload).retry_after,
      );
      if (delay !== null) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return attempt(retries - 1);
      }
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
  return attempt(retryRateLimits ? 2 : 0);
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
  ['discord-messages-v3'],
  { revalidate: 5, tags: ['discord-messages'] },
);

export async function fetchDiscordMessages(limit = 30, frequency: DiscordFrequency = 'web-chat') {
  const { channel } = configuration();
  if (!discordFrequency(frequency)) throw new AppError('Frecuencia de Discord no válida.', 400);
  const target = frequency === 'web-chat' ? channel : (await fetchAuthorizedChannels())[frequency];
  if (!target)
    throw new AppError(
      'Esta frecuencia no tiene un canal autorizado disponible. Revisa su nombre, ID y los permisos del bot.',
      503,
    );
  return cachedMessages(target, Math.max(1, Math.min(30, Math.floor(limit) || 30)));
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
const cachedAuthorizedChannels = unstable_cache(
  async (primary: string, checkpoints: string, announcements: string) => {
    const { token } = configuration();
    const guildId = await cachedGuildId(primary);
    const response = await discordRequest(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: { Authorization: `Bot ${token}` },
      },
    );
    return authorizedDiscordChannels(await response.json(), guildId, primary, {
      checkpoints,
      announcements,
    });
  },
  ['discord-authorized-channels-v1'],
  { revalidate: 60 },
);
export async function fetchAuthorizedChannels() {
  const { channel } = configuration();
  return cachedAuthorizedChannels(
    channel,
    process.env.DISCORD_CHECKPOINTS_CHANNEL_ID?.trim() ?? '',
    process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID?.trim() ?? '',
  );
}
const freebieRuns = new Map<
  string,
  Promise<{ published: number; skipped: number; checkedAt: number }>
>();
const invalidatedFreebieRuns = new Map<string, number>();
const announceFreebiesCached = unstable_cache(
  async (channel: string) => {
    const existing = freebieRuns.get(channel);
    if (existing) return existing;
    const run = (async () => {
      const { token } = configuration();
      const [items, response] = await Promise.all([
        getActiveFreebies(),
        discordRequest(`https://discord.com/api/v10/channels/${channel}/messages?limit=100`, {
          headers: { Authorization: `Bot ${token}` },
        }),
      ]);
      const history: unknown = await response.json();
      if (!Array.isArray(history))
        throw new AppError('No se pudo comprobar el historial de anuncios.', 503);
      const fresh = unseenDiscordFreebies(items, history);
      for (const [index, item] of fresh.entries()) {
        const sent = await discordRequest(
          `https://discord.com/api/v10/channels/${channel}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...discordFreebieMessage(item, appUrl()),
              nonce: `freebie:${item.id}`,
              enforce_nonce: true,
            }),
          },
          true,
        );
        await sent.arrayBuffer();
        if (index < fresh.length - 1 && sent.headers.get('X-RateLimit-Remaining') === '0') {
          const delay = discordRetryDelay(sent.headers.get('X-RateLimit-Reset-After'));
          if (delay === null)
            throw new AppError(
              'Discord está limitando las solicitudes. Espera unos segundos.',
              429,
            );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      return {
        published: fresh.length,
        skipped: items.length - fresh.length,
        checkedAt: Date.now(),
      };
    })();
    freebieRuns.set(channel, run);
    try {
      return await run;
    } finally {
      freebieRuns.delete(channel);
    }
  },
  ['discord-freebie-announcements-v3'],
  { revalidate: 3600 },
);
export async function announceNewFreebiesToDiscord() {
  const target = (await fetchAuthorizedChannels()).announcements;
  if (!target) throw new AppError('El canal autorizado de anuncios no está disponible.', 503);
  const result = await announceFreebiesCached(target);
  // Next.js forbids revalidation inside unstable_cache; invalidate in the request context.
  if (result.published && invalidatedFreebieRuns.get(target) !== result.checkedAt) {
    revalidateTag('discord-messages', { expire: 0 });
    invalidatedFreebieRuns.set(target, result.checkedAt);
  }
  return { published: result.published, skipped: result.skipped };
}
export function scheduleDiscordFreebies() {
  after(async () => {
    const results = await Promise.allSettled([
      announceNewFreebiesToDiscord(),
      announceGta6CountdownToDiscord(),
    ]);
    if (results.some((result) => result.status === 'rejected'))
      console.warn('Discord announcement failed');
  });
}
// GTA VI announcements share the daily cron and the nonblocking Bridge refresh.
const gta6Runs = new Map<
  string,
  Promise<{
    published: boolean;
    zeldaPublished: boolean;
    tgaPublished: boolean;
    avengersPublished: boolean;
    checkedAt: number;
  }>
>();
const invalidatedGta6Runs = new Map<string, number>();
const announceGta6Cached = unstable_cache(
  async (channel: string) => {
    const existing = gta6Runs.get(channel);
    if (existing) return existing;
    const run = (async () => {
      const { token } = configuration();
      const response = await discordRequest(
        `https://discord.com/api/v10/channels/${channel}/messages?limit=100`,
        { headers: { Authorization: `Bot ${token}` } },
      );
      const history: unknown = await response.json();
      if (!Array.isArray(history))
        throw new AppError('No se pudo comprobar el historial de anuncios.', 503);
      const now = Date.now();
      const decisions = [
        {
          id: 'gta6',
          decision: shouldAnnounceGta6Countdown(history, now),
          message: () => discordGta6CountdownMessage(now, appUrl()),
        },
        {
          id: 'zelda-oot',
          decision: shouldAnnounceZeldaOotCountdown(history, now),
          message: () => discordZeldaOotCountdownMessage(now, appUrl()),
        },
        {
          id: 'tga-2026',
          decision: shouldAnnounceTga2026Countdown(history, now),
          message: () => discordTga2026CountdownMessage(now, appUrl()),
        },
        {
          id: 'avengers-doomsday',
          decision: shouldAnnounceAvengersDoomsdayCountdown(history, now),
          message: () => discordAvengersDoomsdayCountdownMessage(now, appUrl()),
        },
      ].filter((item) => item.decision.shouldAnnounce);
      let zeldaPublished = false;
      let tgaPublished = false;
      let avengersPublished = false;
      for (const [index, item] of decisions.entries()) {
        const sent = await discordRequest(
          `https://discord.com/api/v10/channels/${channel}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...item.message(),
              nonce: item.decision.nonce,
              enforce_nonce: true,
            }),
          },
          true,
        );
        await sent.arrayBuffer();
        if (item.id === 'zelda-oot') zeldaPublished = true;
        if (item.id === 'tga-2026') tgaPublished = true;
        if (item.id === 'avengers-doomsday') avengersPublished = true;
        if (index < decisions.length - 1 && sent.headers.get('X-RateLimit-Remaining') === '0') {
          const delay = discordRetryDelay(sent.headers.get('X-RateLimit-Reset-After'));
          if (delay === null) throw new AppError('Discord está limitando las solicitudes.', 429);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      return {
        published: decisions.length > 0,
        zeldaPublished,
        tgaPublished,
        avengersPublished,
        checkedAt: now,
      };
    })();
    gta6Runs.set(channel, run);
    try {
      return await run;
    } finally {
      gta6Runs.delete(channel);
    }
  },
  ['discord-release-countdowns-v4'],
  { revalidate: 3600 },
);
async function announceCountdownsToDiscord() {
  const target = (await fetchAuthorizedChannels()).announcements;
  if (!target) throw new AppError('El canal autorizado de anuncios no está disponible.', 503);
  const result = await announceGta6Cached(target);
  if (result.published && invalidatedGta6Runs.get(target) !== result.checkedAt) {
    revalidateTag('discord-messages', { expire: 0 });
    invalidatedGta6Runs.set(target, result.checkedAt);
  }
  return result;
}
export async function announceGta6CountdownToDiscord() {
  return { published: (await announceCountdownsToDiscord()).published };
}
export async function announceZeldaOotCountdownToDiscord() {
  return { published: (await announceCountdownsToDiscord()).zeldaPublished };
}
export async function announceTga2026CountdownToDiscord() {
  return { published: (await announceCountdownsToDiscord()).tgaPublished };
}
export async function announceAvengersDoomsdayCountdownToDiscord() {
  return { published: (await announceCountdownsToDiscord()).avengersPublished };
}
export async function fetchDiscordPresence() {
  try {
    const { channel } = configuration();
    return await cachedPresence(await cachedGuildId(channel));
  } catch {
    return { onlineCount: 0, members: [] };
  }
}
export async function sendDiscordMessage(
  username: string,
  content: string,
  options: DiscordSendOptions = {},
  mediaUrl: string | null = null,
) {
  const { token, channel } = configuration();
  const prepared = discordComposerPayload(content, mediaUrl, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const text = prepared.content || '📎';
  const safeName = username.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
  const checked = discordSendOptions(options);
  const recent =
    checked.replyToMessageId || checked.mentions?.length || text.includes('@')
      ? await cachedMessages(channel, 30)
      : [];
  if (
    checked.replyToMessageId &&
    !recent.some((message) => message.id === checked.replyToMessageId)
  ) {
    const reference = await discordRequest(
      `https://discord.com/api/v10/channels/${channel}/messages/${checked.replyToMessageId}`,
      { headers: { Authorization: `Bot ${token}` } },
    );
    const raw: unknown = await reference.json();
    if (
      record(raw).id !== checked.replyToMessageId ||
      (record(raw).channel_id && record(raw).channel_id !== channel)
    )
      throw new AppError('La respuesta no pertenece a web-chat.', 400);
  }
  const outgoing = discordOutgoingMessage(text, checked, recent);
  const outgoingContent = `**[@${safeName} en Savestate]:** ${outgoing.content}${prepared.mediaUrl ? '\n' + prepared.mediaUrl : ''}`;
  if (outgoingContent.length > 2000)
    throw new AppError(
      'El mensaje y el enlace superan el límite de Discord. Acorta el texto o usa una URL más corta.',
      400,
    );
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
        ...outgoing,
        content: outgoingContent,
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
