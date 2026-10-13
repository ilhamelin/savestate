import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/env';
import { completeDiscordRoleAuthorization } from '@/services/discord-roles';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  let result = 'success';
  try {
    await completeDiscordRoleAuthorization(new URL(request.url));
  } catch {
    result = 'error';
  }
  const response = NextResponse.redirect(`${appUrl()}/community/discord?linkedRoles=${result}`);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
