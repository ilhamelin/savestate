import 'server-only';
import { unstable_cache } from 'next/cache';
import { catalogueAdmin } from '@/integrations/supabase/admin';
import { AppError } from '@/lib/http';
import { igdbQuery, mapIgdbGame, type CatalogueFilters, type IgdbGame } from './query';

let token: { value: string; expires: number } | null = null;
let tokenRequest: Promise<string> | null = null;
async function accessToken() {
  if (token && token.expires > Date.now() + 60000) return token.value;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const params = new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    });
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: params,
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new AppError('No se pudo conectar al catálogo.', 503);
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in)
      throw new AppError('Respuesta de autenticación inválida.', 503);
    token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    return token.value;
  })();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}
export async function twitchAccessToken() {
  return accessToken();
}
export const fetchCatalogue = unstable_cache(
  async (filters: CatalogueFilters) => {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET)
      throw new AppError('IGDB aún no está configurado.', 503);
    const bearer = await accessToken();
    const { data: allowed, error } = await catalogueAdmin().rpc('claim_igdb_request');
    if (error || !allowed)
      throw new AppError('El catálogo está ocupado. Se utilizará la copia local.', 503);
    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'text/plain',
      },
      body: igdbQuery(filters),
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (response.status === 401) token = null;
    if (!response.ok)
      throw new AppError('IGDB no está disponible. Se utilizará la copia local.', 503);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new AppError('Respuesta inválida del catálogo.', 503);
    return (data as IgdbGame[]).map((game) => ({
      ...mapIgdbGame(game),
      first_release_date: game.first_release_date ?? null,
    }));
  },
  ['igdb-catalogue-v2'],
  { revalidate: 86400 },
);
