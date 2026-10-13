import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { SetupNotice } from '@/components/setup-notice';
import { forumCategories, forumThreads } from '@/services/forum';
import { uuid } from '@/domain/validation';
import {
  FORUM_CATEGORIES,
  FORUM_SORTS,
  forumSearch,
  forumChannel,
  forumPage,
} from '@/domain/forum';
import { ForumCreate } from '@/components/forum-create';
import { ForumThreadList, ForumPagination } from '@/components/forum-thread-list';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck } from '@/lib/http';
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    game?: string;
    q?: string | string[];
    sort?: string | string[];
  }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const { category } = await params;
  if (!FORUM_CATEGORIES.includes(category as (typeof FORUM_CATEGORIES)[number])) notFound();
  const search = await searchParams;
  const query = forumSearch(search.q);
  const sort = FORUM_SORTS.find((value) => value === search.sort) ?? 'recent';
  const filters = {
    ...(query ? { q: query } : {}),
    sort,
    ...(search.game ? { game: search.game } : {}),
  };
  let page: number;
  try {
    page = forumPage(search.page);
    if (search.game) uuid(search.game);
  } catch {
    notFound();
  }
  const [directory, user, list] = await Promise.all([
    forumCategories(),
    currentUser(),
    forumThreads(category, page, search.game, sort, query),
  ]);
  const channel = directory.find((c) => c.id === category);
  if (!channel) notFound();
  const gameResult = search.game
    ? await (await serverClient()).from('games').select('*').eq('id', search.game).maybeSingle()
    : { data: null, error: null };
  dbCheck(gameResult.error);
  const searchForm = (
    <form action={'/forum/' + category} method="get" role="search" className="forum-quick-search">
      <label htmlFor="forum-channel-search" className="sr-only">
        Buscar hilos en el canal
      </label>
      <input
        id="forum-channel-search"
        type="search"
        name="q"
        defaultValue={query}
        maxLength={100}
        placeholder="Buscar en este canal…"
      />
      <input type="hidden" name="sort" value={sort} />
      {search.game ? <input type="hidden" name="game" value={search.game} /> : null}
      <button type="submit" className="button outline small">
        Buscar
      </button>
    </form>
  );
  return (
    <>
      <Link className="accent" href="/forum">
        ← Todos los canales
      </Link>
      <nav className="forum-channel-switcher" aria-label="Cambiar canal del foro">
        {directory.map((c) => (
          <Link
            key={c.id}
            className="button outline small"
            href={'/forum/' + c.id + '?' + new URLSearchParams(filters)}
            aria-current={c.id === category ? 'page' : undefined}
            data-category={forumChannel(c.id)?.theme}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SAVESTATE BOARDS</p>
          <h1>{channel.name}</h1>
          <p className="muted">{channel.description}</p>
        </div>
      </div>
      {user ? (
        <ForumCreate
          key={gameResult.data?.id ?? category}
          categories={directory}
          initialCategory={category}
          initialGame={gameResult.data}
          toolbar={searchForm}
        />
      ) : (
        <div className="forum-toolbar">
          {searchForm}
          <Link
            className="button"
            href={`/login?next=${encodeURIComponent(`/forum/${category}${search.game ? '?game=' + search.game : ''}`)}`}
          >
            Conectar para crear un hilo
          </Link>
        </div>
      )}
      <nav className="filter-buttons" aria-label="Ordenar hilos del canal">
        {[
          ['active', '🔥 Más activos'],
          ['recent', '⏱️ Recientes'],
          ['unanswered', '❓ Sin respuestas'],
        ].map(([value, label]) => (
          <Link
            key={value}
            className={'button small ' + (sort === value ? '' : 'outline')}
            href={'/forum/' + category + '?' + new URLSearchParams({ ...filters, sort: value! })}
            aria-current={sort === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ForumThreadList threads={list.threads} categories={directory} />
      <ForumPagination
        page={page}
        total={list.total}
        base={'/forum/' + category + '?' + new URLSearchParams(filters)}
      />
    </>
  );
}
