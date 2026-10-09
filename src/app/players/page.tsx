import Link from 'next/link';
import { serverClient } from '@/integrations/supabase/server';
import { isConfigured } from '@/lib/env';
import { dbCheck } from '@/lib/http';
import { SetupNotice } from '@/components/setup-notice';
import { PlayerCard } from '@/components/player-card';
export const metadata = { title: 'Jugadores' };
export default async function Players({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q = '', sort: requestedSort = 'all' } = await searchParams;
  const sort = ['all', 'level', 'recent'].includes(requestedSort) ? requestedSort : 'all';
  const query = q.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
  const db = isConfigured() ? await serverClient() : null;
  let profileQuery = db
    ?.from('profiles')
    .select(
      'id,username,avatar_url,equipped_frame,equipped_title,level,theme_color,terminal_status,steam_id,xbox_gamertag,psn_id',
    )
    .ilike('username', `%${query.replace(/_/g, '\\_')}%`);
  if (sort === 'level') profileQuery = profileQuery?.order('level', { ascending: false });
  if (sort === 'recent') profileQuery = profileQuery?.order('created_at', { ascending: false });
  const { data: profiles, error } = profileQuery
    ? await profileQuery.order('username').order('id').limit(50)
    : { data: [], error: null };
  dbCheck(error);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FIND YOUR PARTY</p>
          <h1>Jugadores en la red.</h1>
          <p>Sigue su actividad pública. La amistad abre los checkpoints privados.</p>
          <nav className="filter-buttons players-sort" aria-label="Ordenar jugadores">
            {(
              [
                ['all', 'Todos'],
                ['level', '🏆 Mayor Nivel'],
                ['recent', '⚡ Más Recientes'],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/players?${new URLSearchParams({ sort: value, ...(query ? { q: query } : {}) })}`}
                aria-current={sort === value ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <SetupNotice />
      <form className="form-row" role="search">
        <input type="hidden" name="sort" value={sort} />
        <label>
          Nombre de usuario
          <input
            name="q"
            type="search"
            defaultValue={q}
            maxLength={30}
            placeholder="Buscar jugador…"
          />
        </label>
        <button className="button" style={{ alignSelf: 'end' }}>
          Buscar
        </button>
      </form>
      <div className="players-grid">
        {profiles?.map((profile) => (
          <PlayerCard key={profile.id} profile={profile} />
        ))}
      </div>
      {!profiles?.length ? <p className="panel muted">No hay jugadores que mostrar.</p> : null}
    </>
  );
}
