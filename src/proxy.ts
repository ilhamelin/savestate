import { socQuarantineExempt, socRecoveryPath, socRestriction } from '@/domain/threat-shield';
import {
  trustedThreatIp,
  threatQuarantineResponse,
  refreshThreatShieldSnapshot,
} from '@/services/threat-shield-service';
import { isGuardianAdmin } from '@/domain/admin-access';
import { VAULT_PUBLIC_ORIGIN } from '@/domain/vault';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { isConfigured, publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import { GATE_COOKIE, gatekeeperExempt, validGatePass } from '@/domain/gatekeeper';
import { getSystemSwitches } from '@/services/system-state';
function securityHeaders<T extends Response>(response: T, csp: string) {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export async function proxy(request: NextRequest, event?: NextFetchEvent) {
  const path = request.nextUrl.pathname;
  const clientIp = trustedThreatIp(request);
  if (!socQuarantineExempt(path)) {
    const blocked = threatQuarantineResponse(clientIp);
    if (blocked) {
      // Do not await DB I/O on denial; refresh is bounded and propagates manual unblocks.
      if (event) event.waitUntil(refreshThreatShieldSnapshot().catch(() => null));
      return blocked;
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origin = supabase ? new URL(supabase).origin : '';
  const r2Account = process.env.R2_ACCOUNT_ID ?? '';
  const r2Bucket = process.env.R2_BUCKET_NAME ?? 'savestate-vault';
  const r2Upload = /^[a-f\d]{32}$/.test(r2Account)
    ? `https://${r2Account}.r2.cloudflarestorage.com https://${r2Bucket}.${r2Account}.r2.cloudflarestorage.com https://*.r2.cloudflarestorage.com`
    : '';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' ${dev ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://image.tmdb.org https://upload-os-bbs.hoyolab.com https://hyl-static-res-prod.hoyolab.com https://fastcdn.hoyoverse.com https://act-upload.hoyoverse.com https://images.igdb.com https://static-cdn.jtvnw.net https://static.lolesports.com https://cdn.discordapp.com https://media.discordapp.net https://imgur.com https://www.imgur.com https://i.imgur.com https://tenor.com https://*.tenor.com https://giphy.com https://media.tenor.com https://c.tenor.com https://*.giphy.com https://klipy.com https://*.klipy.com https://img.itch.zone https://enka.network https://avatars.steamstatic.com https://avatars.akamai.steamstatic.com https://steamcdn-a.akamaihd.net https://media.valorant-api.com https://cdn.henrikdev.xyz https://ddragon.leagueoflegends.com https://sm.ign.com https://media.vandal.net https://videos.vandalimg.com https://www.gamerpower.com https://areajugones.sport.es https://i.blogs.es https://i.3djuegos.com https://cmsassets.rgpub.io https://am-a.akamaihd.net https://images.contentstack.io https://assets.contentstack.io ${origin} ${VAULT_PUBLIC_ORIGIN}; media-src 'self' blob: ${origin} ${VAULT_PUBLIC_ORIGIN}; font-src 'self'; connect-src 'self' ${r2Upload} ${origin} ${origin.replace('https:', 'wss:').replace('http:', 'ws:')} ${dev ? 'ws://localhost:*' : ''}; frame-src 'self' https://player.twitch.tv https://www.youtube.com https://www.youtube-nocookie.com https://lolesports.com https://platform.twitter.com https://www.instagram.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  if (!socRecoveryPath(path)) {
    try {
      const policy = await refreshThreatShieldSnapshot();
      const blocked = threatQuarantineResponse(clientIp);
      if (blocked) return securityHeaders(blocked, csp);
      const restriction = socRestriction(policy.level, path, request.method);
      if (restriction === 'readonly')
        return securityHeaders(
          NextResponse.json(
            { error: 'DEFCON activo: SaveState está temporalmente en modo solo lectura.' },
            { status: 503, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '30' } },
          ),
          csp,
        );
      if (restriction === 'verified' || restriction === 'operator') {
        const { url, key } = publicEnv();
        const auth = createServerClient<Database>(url, key, {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll(values) {
              values.forEach(({ name, value }) => request.cookies.set(name, value));
              response = NextResponse.next({ request: { headers } });
              values.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options),
              );
            },
          },
        });
        const { data, error } = await auth.auth.getUser();
        const user = data.user;
        const operator =
          !error &&
          user &&
          isGuardianAdmin(
            { id: user.id, email: user.email, emailConfirmed: Boolean(user.email_confirmed_at) },
            { userId: process.env.ADMIN_USER_ID, email: process.env.ADMIN_EMAIL },
          );
        if (error || !user || (restriction === 'operator' ? !operator : !user.email_confirmed_at))
          return securityHeaders(
            NextResponse.json(
              {
                error:
                  restriction === 'operator'
                    ? 'Lockdown: acceso exclusivo al operador.'
                    : 'DEFCON activo: se requiere una cuenta verificada.',
              },
              { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
            ),
            csp,
          );
        if (
          restriction === 'operator' &&
          !(await validGatePass(
            process.env.GATEKEEPER_SECRET ?? '',
            request.cookies.get(GATE_COOKIE)?.value,
            Date.now(),
            { userId: user.id, lockedAt: policy.updatedAt },
          ))
        ) {
          const denied = path.startsWith('/api/')
            ? NextResponse.json(
                { error: 'Valida una clave TOTP reciente del operador.' },
                { status: 401 },
              )
            : NextResponse.redirect(
                new URL(
                  '/gatekeeper?' + new URLSearchParams({ next: path + request.nextUrl.search }),
                  request.url,
                ),
              );
          denied.headers.set('Cache-Control', 'private, no-store');
          return securityHeaders(denied, csp);
        }
      }
    } catch {
      return securityHeaders(
        NextResponse.json(
          { error: 'No se pudo verificar la política de seguridad.' },
          { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        ),
        csp,
      );
    }
  }
  let gateEnabled = process.env.GATEKEEPER_ENABLED === 'true';
  if (!gatekeeperExempt(request.nextUrl.pathname)) {
    try {
      gateEnabled = (await getSystemSwitches()).gatekeeper_enabled;
    } catch {
      return securityHeaders(
        new NextResponse('No se pudo verificar el estado de acceso.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        }),
        csp,
      );
    }
  }
  if (gateEnabled && !gatekeeperExempt(request.nextUrl.pathname)) {
    const secret = process.env.GATEKEEPER_SECRET ?? '';
    const allowed = await validGatePass(secret, request.cookies.get(GATE_COOKIE)?.value);
    if (!allowed) {
      const gateResponse = request.nextUrl.pathname.startsWith('/api/')
        ? NextResponse.json(
            { error: 'Valida la clave de Guardian para continuar.' },
            { status: 401 },
          )
        : NextResponse.redirect(
            new URL(
              `/gatekeeper?${new URLSearchParams({ next: request.nextUrl.pathname + request.nextUrl.search })}`,
              request.url,
            ),
          );
      gateResponse.headers.set('Cache-Control', 'private, no-store');
      return securityHeaders(gateResponse, csp);
    }
  }
  // Public catalogue API never accesses sessions, enabling shared cache safely.
  if (
    isConfigured() &&
    !request.nextUrl.pathname.startsWith('/api/catalogue') &&
    request.nextUrl.pathname !== '/status' &&
    request.nextUrl.pathname !== '/api/system-status' &&
    request.nextUrl.pathname !== '/sitemap.xml' &&
    request.nextUrl.pathname !== '/robots.txt' &&
    !request.nextUrl.pathname.startsWith('/guardian-assets/') &&
    request.nextUrl.pathname !== '/guardian-sw.js' &&
    request.nextUrl.pathname !== '/api/discord/interactions' &&
    request.nextUrl.pathname !== '/api/cron/check-itch'
  ) {
    const { url, key } = publicEnv();
    const db = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers } });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      const { data } = await db.auth.getClaims();
      const userId = data?.claims?.sub;
      if (typeof userId === 'string' && !gatekeeperExempt(request.nextUrl.pathname)) {
        const state = await db
          .from('profiles')
          .select('access_locked,access_locked_at')
          .eq('id', userId)
          .maybeSingle();
        if (state.error) throw new Error('Moderation state unavailable');
        if (state.data?.access_locked || state.data?.access_locked_at) {
          const allowed =
            state.data.access_locked_at &&
            (await validGatePass(
              process.env.GATEKEEPER_SECRET ?? '',
              request.cookies.get(GATE_COOKIE)?.value,
              Date.now(),
              { userId, lockedAt: state.data.access_locked_at },
            ));
          if (!allowed) {
            const denied = request.nextUrl.pathname.startsWith('/api/')
              ? NextResponse.json(
                  { error: 'Tu acceso requiere una nueva clave de Guardian.' },
                  { status: 401 },
                )
              : NextResponse.redirect(
                  new URL(
                    `/gatekeeper?${new URLSearchParams({ next: request.nextUrl.pathname + request.nextUrl.search })}`,
                    request.url,
                  ),
                );
            denied.cookies.delete(GATE_COOKIE);
            denied.headers.set('Cache-Control', 'private, no-store');
            return securityHeaders(denied, csp);
          }
        }
      }
    } catch {
      return securityHeaders(
        new NextResponse('No se pudo verificar la sesión. Inténtalo de nuevo.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        }),
        csp,
      );
    }
  }
  securityHeaders(response, csp);
  if (!request.nextUrl.pathname.startsWith('/api/catalogue'))
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt)$).*)',
  ],
};
