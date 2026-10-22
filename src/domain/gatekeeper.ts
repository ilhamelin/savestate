import { isOfflineLibraryAsset } from './offline-library.ts';

export const GATE_STEP_SECONDS = 20;
export const GATE_COOKIE = 'savestate_gate_pass';
export const GATE_PASS_SECONDS = 12 * 60 * 60;

export function gateSecretBytes(secret: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Z2-7]{32,128}$/.test(secret)) throw new Error('Semilla Base32 inválida.');
  const bytes: number[] = [];
  let bits = 0,
    value = 0;
  for (const char of secret) {
    value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}
async function sign(secret: string, value: Uint8Array<ArrayBuffer>, hash: 'SHA-1' | 'SHA-256') {
  const key = await crypto.subtle.importKey(
    'raw',
    gateSecretBytes(secret),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, value));
}
export async function gateCode(
  secret: string,
  nowMs = Date.now(),
  stepSeconds = GATE_STEP_SECONDS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    gateSecretBytes(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  return gateCodeFromKey(key, nowMs, stepSeconds);
}
export async function gateCodeFromKey(
  key: CryptoKey,
  nowMs = Date.now(),
  stepSeconds = GATE_STEP_SECONDS,
): Promise<string> {
  if (!Number.isFinite(nowMs) || nowMs < 0 || !Number.isInteger(stepSeconds) || stepSeconds <= 0)
    throw new Error('Tiempo inválido.');
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(Math.floor(nowMs / (stepSeconds * 1000))));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = hash[hash.length - 1]! & 15;
  const value = new DataView(hash.buffer).getUint32(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, '0');
}
function equal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export async function validGateCode(
  secret: string,
  code: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const values = await Promise.all(
    [-1, 0, 1].map((offset) => gateCode(secret, Math.max(0, nowMs + offset * 20000))),
  );
  return values.map((value) => equal(value, code)).some(Boolean);
}
async function passSignature(secret: string, payload: string) {
  const signature = await sign(
    secret,
    new TextEncoder().encode(`savestate:gate-pass:v2:${payload}`),
    'SHA-256',
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function createGatePass(
  secret: string,
  nowMs = Date.now(),
  userId = 'guest',
): Promise<string> {
  const payload = `${Math.floor(nowMs / 1000) + GATE_PASS_SECONDS}.${Math.floor(nowMs)}.${userId}.${crypto.randomUUID()}`;
  return `${payload}.${await passSignature(secret, payload)}`;
}
export async function validGatePass(
  secret: string,
  token: string | undefined,
  nowMs = Date.now(),
  requirement?: { userId: string; lockedAt: string },
): Promise<boolean> {
  if (!token || !/^\d{1,12}\.\d{1,16}\.[\w-]{1,64}\.[\da-f-]{36}\.[\da-f]{64}$/.test(token))
    return false;
  const [expires, issued, subject, nonce, signature] = token.split('.');
  const remaining = Number(expires) - Math.floor(nowMs / 1000);
  if (remaining <= 0 || remaining > GATE_PASS_SECONDS) return false;
  if (Number(issued) > nowMs || !Number.isSafeInteger(Number(issued))) return false;
  if (
    requirement &&
    (subject !== requirement.userId ||
      !Number.isFinite(Date.parse(requirement.lockedAt)) ||
      Number(issued) < Date.parse(requirement.lockedAt))
  )
    return false;
  try {
    return equal(
      signature!,
      await passSignature(secret, `${expires}.${issued}.${subject}.${nonce}`),
    );
  } catch {
    return false;
  }
}

export function gatekeeperExempt(path: string): boolean {
  // These machine endpoints already authenticate Discord signatures or CRON_SECRET.
  return (
    isOfflineLibraryAsset(path) ||
    [
      '/gatekeeper',
      '/api/gatekeeper/verify',
      '/guardian',
      '/guardian/',
      '/login',
      '/auth/callback',
      '/auth/confirm',
      '/manifest.webmanifest',
      '/sitemap.xml',
      '/robots.txt',
      '/guardian-sw.js',
      '/api/discord/interactions',
      '/api/cron/check-itch',
      '/api/cron/discord-freebies',
    ].includes(path) ||
    path.startsWith('/api/guardian/') ||
    path.startsWith('/guardian-assets/') ||
    path.startsWith('/_next/')
  );
}
