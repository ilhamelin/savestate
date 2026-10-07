import { NextResponse } from 'next/server';
import { serverClient } from '@/integrations/supabase/server';
import { appUrl } from '@/lib/env';
import { safeNext } from '@/domain/validation';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), appUrl()));
  }
  return NextResponse.redirect(new URL('/login?error=callback', appUrl()));
}
