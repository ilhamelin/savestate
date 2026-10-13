import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { authenticated } from '@/lib/session';
import { appUrl } from '@/lib/env';
import { AppError, dbCheck } from '@/lib/http';
import { roleConnectionPayload, type DiscordRoleStats } from '@/domain/discord-linked-roles';
import {
  openDiscordCookie,
  sealDiscordCookie,
  discordOAuthStateMatches,
} from '@/domain/discord-oauth-cookie';
import { record } from '@/domain/game-live-telemetry';
const stateCookie = 'savestate_discord_role_state',
  tokenCookie = 'savestate_discord_role_token';
const cookiePath = '/api/discord/role-connection';
function config() {
  const id = process.env.DISCORD_APPLICATION_ID ?? '',
    secret = process.env.DISCORD_CLIENT_SECRET?.trim() ?? '';
  if (!/^\d{16,22}$/.test(id) || !secret)
    throw new AppError(
      'Configura DISCORD_APPLICATION_ID y DISCORD_CLIENT_SECRET para vincular roles.',
      503,
    );
  return { id, secret, redirectUri: `${appUrl()}${cookiePath}/callback` };
}
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: new URL(appUrl()).protocol === 'https:',
    sameSite: 'lax' as const,
    path: cookiePath,
    maxAge,
  };
}
async function requestDiscord(path: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10/${path}`, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new AppError('No se pudo conectar con Discord.', 503);
  }
  if (!response.ok)
    throw new AppError(
      response.status === 401 || response.status === 403
        ? 'Discord requiere volver a autorizar los roles vinculados.'
        : 'Discord no pudo sincronizar el rol. Inténtalo más tarde.',
      response.status === 401 || response.status === 403 ? 409 : 503,
    );
  return record(await response.json());
}
export async function discordRoleStatistics() {
  const { user, db } = await authenticated();
  const [profile, completed, platinum] = await Promise.all([
    db.from('profiles').select('username,level').eq('id', user.id).single(),
    db
      .from('user_games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['cleared', 'platinum']),
    db
      .from('user_games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'platinum'),
  ]);
  [profile.error, completed.error, platinum.error].forEach(dbCheck);
  if (!profile.data) throw new AppError('No se encontró tu perfil.', 404);
  const stats: DiscordRoleStats = {
    level: profile.data.level,
    completed_games: completed.count ?? 0,
    platinum_games: platinum.count ?? 0,
  };
  return { userId: user.id, username: profile.data.username, stats };
}
export async function discordRoleStatus() {
  const data = await discordRoleStatistics(),
    secret = process.env.DISCORD_CLIENT_SECRET?.trim() ?? '',
    store = await cookies();
  const token = openDiscordCookie(store.get(tokenCookie)?.value, secret, data.userId);
  return {
    username: data.username,
    stats: data.stats,
    connected: Boolean(token?.accessToken),
    configured: Boolean(secret && /^\d{16,22}$/.test(process.env.DISCORD_APPLICATION_ID ?? '')),
  };
}
export async function authorizeDiscordRoles() {
  const { user } = await authenticated();
  const { id, secret, redirectUri } = config();
  const state = randomBytes(32).toString('hex');
  const store = await cookies();
  store.set(
    stateCookie,
    sealDiscordCookie({ userId: user.id, state, expiresAt: Date.now() + 300000 }, secret),
    cookieOptions(300),
  );
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify role_connections.write',
    state,
    prompt: 'consent',
  });
  return { url: `https://discord.com/oauth2/authorize?${params}` };
}
async function sendRoles(accessToken: string) {
  const { id } = config();
  const data = await discordRoleStatistics();
  await requestDiscord(`users/@me/applications/${id}/role-connection`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(roleConnectionPayload(data.username, data.stats)),
  });
  return { username: data.username, stats: data.stats, synced: true };
}
export async function syncDiscordRoles() {
  const { user } = await authenticated();
  const { secret } = config();
  const store = await cookies();
  const token = openDiscordCookie(store.get(tokenCookie)?.value, secret, user.id);
  if (!token?.accessToken) return { authorizeRequired: true };
  try {
    return await sendRoles(token.accessToken);
  } catch (error) {
    if (error instanceof AppError && error.status === 409) {
      store.set(tokenCookie, '', cookieOptions(0));
      return { authorizeRequired: true };
    }
    throw error;
  }
}
export async function completeDiscordRoleAuthorization(url: URL) {
  const { user, db } = await authenticated();
  const { id, secret, redirectUri } = config();
  const store = await cookies();
  const saved = openDiscordCookie(store.get(stateCookie)?.value, secret, user.id);
  store.set(stateCookie, '', cookieOptions(0));
  if (!saved || !discordOAuthStateMatches(saved.state, url.searchParams.get('state')))
    throw new AppError('La autorización caducó o no pertenece a esta sesión.', 400);
  const code = url.searchParams.get('code');
  if (url.searchParams.has('error') || !code || code.length > 500)
    throw new AppError('Autorización cancelada o inválida.', 400);
  const token = await requestDiscord('oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  const scopes = String(token.scope ?? '').split(' ');
  if (
    typeof token.access_token !== 'string' ||
    !scopes.includes('identify') ||
    !scopes.includes('role_connections.write')
  )
    throw new AppError('Discord no concedió el permiso para roles vinculados.', 403);
  const discordUser = await requestDiscord('users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (typeof discordUser.id !== 'string' || !/^\d{16,22}$/.test(discordUser.id))
    throw new AppError('Identidad de Discord inválida.', 503);
  const auth = await db.auth.getUser();
  if (auth.error || auth.data.user?.id !== user.id)
    throw new AppError('Vuelve a iniciar sesión.', 401);
  const discordIdentity = auth.data.user.identities?.find(
    (identity) => identity.provider === 'discord',
  );
  const existingId =
    discordIdentity?.identity_data?.provider_id ?? discordIdentity?.identity_data?.sub;
  if (existingId && existingId !== discordUser.id)
    throw new AppError('Autoriza la misma cuenta de Discord con la que iniciaste sesión.', 403);
  const seconds =
    typeof token.expires_in === 'number' && Number.isFinite(token.expires_in)
      ? Math.min(3600, Math.floor(token.expires_in))
      : 0;
  if (seconds <= 0) throw new AppError('Discord devolvió una sesión inválida.', 503);
  await sendRoles(token.access_token);
  store.set(
    tokenCookie,
    sealDiscordCookie(
      {
        userId: user.id,
        accessToken: token.access_token,
        discordUserId: discordUser.id,
        expiresAt: Date.now() + seconds * 1000,
      },
      secret,
    ),
    cookieOptions(seconds),
  );
}
