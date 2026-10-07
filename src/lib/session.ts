import 'server-only';
import { cache } from 'react';
import { serverClient } from '@/integrations/supabase/server';
import { isConfigured } from '@/lib/env';
import { AppError } from '@/lib/http';
export const currentUser = cache(async () => {
  if (!isConfigured()) return null;
  const db = await serverClient();
  const { data, error } = await db.auth.getClaims();
  return error || !data?.claims.sub ? null : { id: String(data.claims.sub) };
});
export async function authenticated() {
  const user = await currentUser();
  if (!user) throw new AppError('Inicia sesión para continuar.', 401);
  return { user, db: await serverClient() };
}
