import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isConfigured, publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origin = supabase ? new URL(supabase).origin : '';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' ${dev ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.igdb.com ${origin}; font-src 'self'; connect-src 'self' ${origin} ${origin.replace('https:', 'wss:').replace('http:', 'ws:')} ${dev ? 'ws://localhost:*' : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  // Public catalogue API never accesses sessions, enabling shared cache safely.
  if (isConfigured() && !request.nextUrl.pathname.startsWith('/api/catalogue')) {
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
      await db.auth.getClaims();
    } catch {
      return new NextResponse('No se pudo verificar la sesión. Inténtalo de nuevo.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
  response.headers.set('Content-Security-Policy', csp);
  if (!request.nextUrl.pathname.startsWith('/api/catalogue'))
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
