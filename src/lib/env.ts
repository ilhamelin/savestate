export function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error('Configura Supabase en .env.local siguiendo docs/configuracion.md.');
  return { url, key };
}
export function appUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  if (
    process.env.NODE_ENV === 'production' &&
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error('La URL de producción debe usar HTTPS.');
  return url.origin;
}
