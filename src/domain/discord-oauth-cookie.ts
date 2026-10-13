import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
export type DiscordOAuthCookie = {
  userId: string;
  expiresAt: number;
  state?: string;
  accessToken?: string;
  discordUserId?: string;
};
export function sealDiscordCookie(value: DiscordOAuthCookie, secret: string) {
  if (!secret) throw new Error('Missing Discord secret');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openDiscordCookie(
  value: string | undefined,
  secret: string,
  userId: string,
  now = Date.now(),
): DiscordOAuthCookie | null {
  if (!value || !secret || value.length > 3500) return null;
  try {
    const data = Buffer.from(value, 'base64url');
    if (data.length < 29) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      createHash('sha256').update(secret).digest(),
      data.subarray(0, 12),
    );
    decipher.setAuthTag(data.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'),
    ) as DiscordOAuthCookie;
    return payload.userId === userId &&
      typeof payload.expiresAt === 'number' &&
      payload.expiresAt > now
      ? payload
      : null;
  } catch {
    return null;
  }
}
export function discordOAuthStateMatches(saved: unknown, received: unknown) {
  return (
    typeof saved === 'string' &&
    typeof received === 'string' &&
    /^[a-f0-9]{64}$/.test(saved) &&
    /^[a-f0-9]{64}$/.test(received) &&
    timingSafeEqual(Buffer.from(saved), Buffer.from(received))
  );
}
