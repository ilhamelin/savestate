import Link from 'next/link';
import { serverClient } from '@/integrations/supabase/server';
import { isConfigured } from '@/lib/env';
import { dbCheck } from '@/lib/http';
import { SetupNotice } from '@/components/setup-notice';
export const metadata = { title: 'Jugadores' };
export default async function Players({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
  const db = isConfigured() ? await serverClient() : null;
  const { data: profiles, error } = db
    ? await db
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .order('username')
        .limit(50)
    : { data: [], error: null };
  dbCheck(error);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FIND YOUR PARTY</p>
          <h1>Jugadores en la red.</h1>
          <p>Sigue su actividad pública. La amistad abre los checkpoints privados.</p>
        </div>
      </div>
      <SetupNotice />
      <form className="form-row" role="search">
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
      <section className="panel">
        {profiles?.map((profile) => (
          <Link key={profile.id} className="player-row" href={`/players/${profile.username}`}>
            <div>
              <h3>@{profile.username}</h3>
              <p className="muted">{profile.terminal_status || 'Listo para una nueva aventura.'}</p>
            </div>
            <span className="accent">Ver perfil ↗</span>
          </Link>
        ))}
        {!profiles?.length ? <p className="muted">No hay jugadores que mostrar.</p> : null}
      </section>
    </>
  );
}
