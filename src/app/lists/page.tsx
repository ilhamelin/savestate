import Link from 'next/link';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { dbCheck } from '@/lib/http';
import { ListForm } from '@/components/list-forms';
import { CollectionCard } from '@/components/collection-card';
import { collectionSearch, collectionSearchFilter } from '@/domain/list-personality';
export const metadata = { title: 'Listas de juegos' };
export default async function Lists({
  searchParams,
}: {
  searchParams: Promise<{
    player?: string | string[];
    tab?: string | string[];
    q?: string | string[];
  }>;
}) {
  const search = await searchParams;
  const player =
    typeof search.player === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.player)
      ? search.player
      : '';
  const term = collectionSearch(search.q);
  if (!isConfigured()) return <SetupNotice />;
  const db = await serverClient(),
    user = await currentUser();
  const tab =
    search.tab === 'mine' || search.tab === 'community'
      ? search.tab
      : user && (!player || player === user.id)
        ? 'mine'
        : 'community';
  let query = db
    .from('user_lists')
    .select(
      '*,profiles(id,username,avatar_url),list_items(game_id,position_index,games(id,title,cover_url)),item_count:list_items(count)',
    )
    .order('created_at', { ascending: false })
    .order('position_index', { referencedTable: 'list_items' })
    .order('game_id', { referencedTable: 'list_items' })
    .limit(4, { referencedTable: 'list_items' })
    .limit(100);
  if (tab === 'mine')
    query = query.eq('user_id', user?.id ?? '00000000-0000-0000-0000-000000000000');
  else {
    query = query.eq('is_private', false);
    if (player) query = query.eq('user_id', player);
  }
  if (term) query = query.or(collectionSearchFilter(term));
  const { data: lists, error } = await query;
  dbCheck(error);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAYER COLLECTIONS</p>
          <h1>Una lista. Muchos mundos.</h1>
          <p>Colecciones compartidas y tus listas privadas.</p>
        </div>
      </div>
      <div className="collections-toolbar">
        <nav className="filter-buttons" aria-label="Colecciones visibles">
          <Link
            className={`button small ${tab === 'mine' ? '' : 'outline'}`}
            aria-current={tab === 'mine' ? 'page' : undefined}
            href={
              user
                ? `/lists?${new URLSearchParams({ tab: 'mine', ...(term ? { q: term } : {}) })}`
                : '/login?next=%2Flists%3Ftab%3Dmine'
            }
          >
            👤 Mis listas
          </Link>
          <Link
            className={`button small ${tab === 'community' ? '' : 'outline'}`}
            aria-current={tab === 'community' ? 'page' : undefined}
            href={`/lists?${new URLSearchParams({ tab: 'community', ...(term ? { q: term } : {}) })}`}
          >
            🌐 Explorar Comunidad
          </Link>
        </nav>
        <form action="/lists" method="get" role="search" className="collections-search">
          <label htmlFor="collection-search" className="sr-only">
            Buscar colecciones por título o descripción
          </label>
          <input
            type="search"
            id="collection-search"
            name="q"
            maxLength={100}
            defaultValue={term}
            placeholder="Buscar colecciones temáticas (RPGs, Terror, Retro)…"
          />
          <input type="hidden" name="tab" value={tab} />
          {player && tab === 'community' ? (
            <input type="hidden" name="player" value={player} />
          ) : null}
          <button type="submit" className="button outline small">
            Buscar
          </button>
        </form>
      </div>
      {user ? (
        <details className="collection-create">
          <summary className="button">+ Crear nueva lista</summary>
          <div className="panel">
            <ListForm />
          </div>
        </details>
      ) : (
        <Link className="accent" href="/login">
          Inicia sesión para crear listas.
        </Link>
      )}
      {player && tab === 'community' ? (
        <p className="muted">
          Colecciones compartidas de este jugador.{' '}
          <Link className="accent" href="/lists?tab=community">
            Ver toda la comunidad ↗
          </Link>
        </p>
      ) : null}
      {term ? (
        <p className="muted">
          Resultados para «{term}» ·{' '}
          <Link
            className="accent"
            href={`/lists?${new URLSearchParams({ tab, ...(player && tab === 'community' ? { player } : {}) })}`}
          >
            Limpiar búsqueda
          </Link>
        </p>
      ) : null}
      <section className="lists-grid" aria-label="Colecciones de juegos">
        {lists?.map((list) => (
          <CollectionCard
            key={list.id}
            list={list}
            author={list.profiles}
            games={list.list_items.map((item) => item.games)}
            count={list.item_count[0]?.count ?? 0}
          />
        ))}
        {!lists?.length ? (
          <p className="muted collections-empty">
            {tab === 'mine' && !user
              ? 'Inicia sesión para ver tus colecciones.'
              : term
                ? 'No hay colecciones que coincidan con tu búsqueda.'
                : 'Todavía no hay listas visibles.'}
          </p>
        ) : null}
      </section>
    </>
  );
}
