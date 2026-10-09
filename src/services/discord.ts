import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { AppError } from '@/lib/http';
import { discordContent, discordWebhook, normalizedDiscordMessages } from '@/domain/discord';

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
  type: 'platinum' | 'levelup' | 'forum';
  username: string;
  details: string;
};
export async function notifyDiscordCheckpoint(event: DiscordCheckpoint) {
  const webhook = discordWebhook(process.env.DISCORD_WEBHOOK_URL ?? '');
  if (!webhook) return;
  const meta = {
    platinum: { title: '🏆 ¡NUEVO PLATINO DESBLOQUEADO!', color: 0xffd700 },
    levelup: { title: '⚡ LEVEL UP', color: 0x00f0ff },
    forum: { title: '💬 Nuevo debate en el Foro', color: 0x39ff14 },
  }[event.type];
  await discordRequest(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          ...meta,
          description: `@${event.username}: ${event.details}`.slice(0, 1500),
          timestamp: new Date().toISOString(),
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
