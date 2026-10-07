import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { serverClient } from '@/integrations/supabase/server';
import { appUrl } from '@/lib/env';
import { safeNext } from '@/domain/validation';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get('token_hash'),
    type = url.searchParams.get('type');
  if (hash && type && ['signup', 'recovery', 'email_change', 'email'].includes(type)) {
    const db = await serverClient();
    const { error } = await db.auth.verifyOtp({ token_hash: hash, type: type as EmailOtpType });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === 'recovery' ? '/reset-password' : safeNext(url.searchParams.get('next')),
          appUrl(),
        ),
      );
  }
  return NextResponse.redirect(new URL('/login?error=confirm', appUrl()));
}
