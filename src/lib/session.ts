import 'server-only';
import { cache } from 'react';
import { serverClient } from '@/integrations/supabase/server';
import { isConfigured } from '@/lib/env';
import { AppError } from '@/lib/http';
import { isGuardianAdmin } from '@/domain/admin-access';
export const currentUser = cache(async () => {
  if (!isConfigured()) return null;
  const db = await serverClient();
  const { data, error } = await db.auth.getClaims();
  return error || !data?.claims.sub ? null : { id: String(data.claims.sub) };
});
export const currentViewerProfile = cache(async () => {
  const user = await currentUser();
  if (!user) return null;
  const db = await serverClient();
  const { data, error } = await db
    .from('profiles')
    .select('id, username, avatar_url, level')
    .eq('id', user.id)
    .maybeSingle();
  return error ? null : data;
});
export async function authenticated() {
  const user = await currentUser();
  if (!user) throw new AppError('Inicia sesión para continuar.', 401);
  return { user, db: await serverClient() };
}
export const currentAdmin = cache(async () => {
  const profile = await currentViewerProfile();
  if (!profile) return null;
  const db = await serverClient();
  // getUser verifies the account with Supabase. Never authorize an editable username or metadata email.
  const { data, error } = await db.auth.getUser();
  const user = data.user;
  if (error || !user || user.id !== profile.id) return null;
  return isGuardianAdmin(
    { id: user.id, email: user.email, emailConfirmed: Boolean(user.email_confirmed_at) },
    { userId: process.env.ADMIN_USER_ID, email: process.env.ADMIN_EMAIL },
  )
    ? profile
    : null;
});
export async function authenticatedAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new AppError('Acceso restringido al operador supremo.', 403);
  return admin;
}
