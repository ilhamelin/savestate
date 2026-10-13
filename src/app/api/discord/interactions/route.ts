import { after } from 'next/server';
import { verifyDiscordInteractionSignature } from '@/domain/discord';
import { record } from '@/domain/game-live-telemetry';
import {
  discordAutocompleteResponse,
  discordCommandResponse,
  finishDiscordInteraction,
  interactionCommand,
} from '@/services/discord-interactions';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  const signature = request.headers.get('X-Signature-Ed25519') ?? '',
    timestamp = request.headers.get('X-Signature-Timestamp') ?? '';
  const key = (
    process.env.DISCORD_PUBLIC_KEY ||
    '6ae28438c8aabef52a28b13d1f5ef1714c9ce11a71a5b47b70d466d247981450'
  ).trim();
  const appId = (process.env.DISCORD_APPLICATION_ID || '1557446548982464652').trim();
  if (
    !/^[a-f0-9]{128}$/i.test(signature) ||
    !/^[a-f0-9]{64}$/i.test(key) ||
    !timestamp ||
    timestamp.length > 64
  )
    return new Response('Invalid signature', { status: 401 });
  const reader = request.body?.getReader();
  let raw = '';
  let size = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 65536) {
          await reader.cancel();
          return new Response('Payload too large', { status: 413 });
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    }
  } catch {
    return new Response('Invalid body', { status: 400 });
  } finally {
    reader?.releaseLock();
  }
  if (!verifyDiscordInteractionSignature(raw, signature, timestamp, key))
    return new Response('Invalid signature', { status: 401 });
  let payload: Record<string, unknown>;
  try {
    payload = record(JSON.parse(raw));
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (payload.type === 1) return Response.json({ type: 1 });
  if (payload.application_id !== appId) return new Response('Wrong application', { status: 401 });
  if (payload.type === 4) return Response.json(await discordAutocompleteResponse(payload));
  if (payload.type !== 2)
    return Response.json({ type: 4, data: { content: 'Interacción no compatible.', flags: 64 } });
  const command = interactionCommand(payload);
  if (command.name === 'web' || command.name === 'savestate')
    return Response.json(await discordCommandResponse(payload));
  if (!['perfil', 'juego', 'gratis', 'valorant', 'lol', 'genshin'].includes(String(command.name)))
    return Response.json(await discordCommandResponse(payload));
  // Acknowledge before external I/O; Discord invalidates interactions after three seconds.
  after(async () => {
    try {
      await finishDiscordInteraction(payload);
    } catch {
      console.warn('Discord interaction delivery failed');
    }
  });
  return Response.json({ type: 5 });
}
