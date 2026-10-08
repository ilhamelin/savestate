import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { dbCheck } from '@/lib/http';
import { GameCard } from '@/components/game-card';
import { ListForm, ListItemForm, DeleteList, RemoveListItem } from '@/components/list-forms';
import { libraryFor } from '@/repositories/player';
import { ListCover } from '@/components/list-cover';
export default async function ListDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!isConfigured()) return <SetupNotice />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await serverClient(),
    user = await currentUser();
  const { data: list, error } = await db.from('user_lists').select('*').eq('id', id).maybeSingle();
  dbCheck(error);
  if (!list) notFound();
  const { data: items, error: itemError } = await db
    .from('list_items')
    .select('*')
    .eq('list_id', id)
    .order('position_index')
    .order('game_id');
  dbCheck(itemError);
  const { data: games, error: gameError } = items?.length
    ? await db
        .from('games')
        .select('*')
        .in(
          'id',
          items.map((i) => i.game_id),
        )
    : { data: [], error: null };
  dbCheck(gameError);
  const editable = user?.id === list.user_id;
  const library = editable && user ? await libraryFor(user.id) : null;
  return (
    <>
      <div className="page-heading">
        <ListCover
          title={list.title}
          games={(items ?? [])
            .slice(0, 4)
            .map((item) => games?.find((game) => game.id === item.game_id) ?? null)}
        />
        <div>
          <Link className="text-link" href="/lists">
            ← Listas
          </Link>
          <h1>{list.title}</h1>
          <p>{list.description}</p>
        </div>
      </div>
      {editable ? (
        <details className="panel">
          <summary>Editar lista y agregar juegos</summary>
          <ListForm list={list} />
          <hr style={{ margin: '25px 0', borderColor: '#292e38' }} />
          <ListItemForm
            listId={id}
            games={library?.games ?? []}
            nextPosition={items?.length ? Math.max(...items.map((i) => i.position_index)) + 1 : 0}
          />
          <DeleteList id={id} />
        </details>
      ) : null}
      <div className="game-grid">
        {items?.map((item) => {
          const game = games?.find((g) => g.id === item.game_id);
          return game ? (
            <div key={item.id}>
              <p className="tag">#{(items ?? []).indexOf(item) + 1}</p>
              <GameCard game={game} />
              {item.note ? (
                <blockquote className="list-author-note">
                  <span>💬 Nota del autor:</span>
                  <p>{item.note}</p>
                </blockquote>
              ) : null}
              {editable ? (
                <details className="panel">
                  <summary>Editar posición y nota</summary>
                  <ListItemForm listId={id} games={games ?? []} nextPosition={0} item={item} />
                  <RemoveListItem id={item.id} />
                </details>
              ) : null}
            </div>
          ) : null;
        })}
      </div>
      {!items?.length ? (
        <div className="empty-state">
          <p>Esta colección todavía no tiene juegos.</p>
        </div>
      ) : null}
    </>
  );
}
