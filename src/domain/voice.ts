import { ValidationError } from './validation.ts';

export interface VoiceChannel {
  id: string;
  name: string;
  frequency: string;
  description: string;
  maxParticipants: number;
  category: 'general' | 'gaming' | 'chill';
}
export const DEFAULT_VOICE_CHANNELS: readonly VoiceChannel[] = [
  {
    id: 'ch-lobby',
    name: 'Lobby Central',
    frequency: '88.5 MHz',
    description: 'Punto de reunión general para charlar de novedades.',
    maxParticipants: 16,
    category: 'general',
  },
  {
    id: 'ch-squad',
    name: 'Escuadrón Co-op',
    frequency: '94.2 MHz',
    description: 'Coordinación táctica para partidas multijugador.',
    maxParticipants: 6,
    category: 'gaming',
  },
  {
    id: 'ch-chill',
    name: 'Zona Retro & Chill',
    frequency: '101.7 MHz',
    description: 'Música, novelas visuales y charlas relajadas.',
    maxParticipants: 10,
    category: 'chill',
  },
];
export function voiceChannel(input: unknown): VoiceChannel {
  const channel = DEFAULT_VOICE_CHANNELS.find((item) => item.id === input);
  if (!channel) throw new ValidationError('Selecciona una frecuencia oficial.');
  return channel;
}
export function voiceServerUrl(input: unknown, development = false): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  try {
    const url = new URL(input.trim());
    const local = development && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      !['wss:', 'https:'].includes(url.protocol) &&
      !(local && ['ws:', 'http:'].includes(url.protocol))
    )
      return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    url.protocol =
      url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
    return url.origin;
  } catch {
    return null;
  }
}
export function voiceConnectSources(input: unknown, development = false): string {
  const url = voiceServerUrl(input, development);
  if (!url) return '';
  const origin = new URL(url);
  const http = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const cloud = origin.hostname.endsWith('.livekit.cloud')
    ? ' wss://*.livekit.cloud https://*.livekit.cloud'
    : '';
  return `${url} ${http}${cloud}`;
}
export type VoiceMode = 'continuous' | 'push-to-talk';
export function voiceMicEnabled(muted: boolean, deafened: boolean, mode: VoiceMode, held: boolean) {
  return !muted && !deafened && (mode === 'continuous' || held);
}
export function voiceShortcutTarget(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, button, a, dialog, [contenteditable], [role="dialog"]',
      ),
    )
  );
}
export function voiceAvatar(
  metadata: string | undefined,
  storageUrl: string | undefined,
): string | null {
  try {
    if (!metadata || metadata.length > 8192) return null;
    const value: unknown = JSON.parse(metadata);
    const avatar = (value as { avatarUrl?: unknown } | null)?.avatarUrl;
    if (typeof avatar !== 'string') return null;
    if (/^\/avatars\/[a-z0-9_-]+\.(svg|png|webp)$/i.test(avatar)) return avatar;
    const url = new URL(avatar);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (
      url.hostname === 'cdn.discordapp.com' ||
      (storageUrl && url.origin === new URL(storageUrl).origin)
    )
      return url.href;
  } catch {
    /* Untrusted participant metadata never controls arbitrary media URLs. */
  }
  return null;
}
