import Link from 'next/link';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { dbCheck } from '@/lib/http';
import { ListForm } from '@/components/list-forms';
import { ListCover } from '@/components/list-cover';
export const metadata = { title: 'Listas de juegos' };
export default async function Lists({
  searchParams,
}: {
  searchParams: Promise<{ player?: string }>;
}) {
  const { player } = await searchParams;
  if (!isConfigured()) return <SetupNotice />;
  const db = await serverClient(),
    user = await currentUser();
  let query = db
    .from('user_lists')
    .select('*,list_items(game_id,position_index,games(id,title,cover_url))')
    .order('created_at', { ascending: false })
    .order('position_index', { referencedTable: 'list_items' })
    .order('game_id', { referencedTable: 'list_items' })
    .limit(4, { referencedTable: 'list_items' })
    .limit(100);
  if (player && /^[0-9a-f-]{36}$/i.test(player)) query = query.eq('user_id', player);
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
      {user ? (
        <details className="panel">
          <summary>+ Crear una lista</summary>
          <ListForm />
        </details>
      ) : (
        <Link className="accent" href="/login">
          Inicia sesión para crear listas.
        </Link>
      )}
      <section className="panel">
        {lists?.map((list) => (
          <Link className="list-row" key={list.id} href={`/lists/${list.id}`}>
            <ListCover title={list.title} games={list.list_items.map((item) => item.games)} />
            <div>
              <h3>{list.title}</h3>
              <p className="muted">{list.description}</p>
            </div>
            <span className="tag">{list.is_private ? 'Privada' : 'Compartida'} ↗</span>
          </Link>
        ))}
        {!lists?.length ? <p className="muted">Todavía no hay listas visibles.</p> : null}
      </section>
    </>
  );
}
