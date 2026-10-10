import Link from 'next/link';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { SetupNotice } from '@/components/setup-notice';
import { forumDirectory } from '@/services/forum';
import { ForumCreate } from '@/components/forum-create';
import { ForumThreadList } from '@/components/forum-thread-list';
import { forumChannel, forumSearch, FORUM_SORTS } from '@/domain/forum';
import { notificationAge } from '@/domain/notifications';
import { Search } from 'lucide-react';
export const metadata = { title: 'SaveState Boards' };
export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; sort?: string | string[] }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const search = await searchParams;
  const query = forumSearch(search.q);
  const sort = FORUM_SORTS.find((value) => value === search.sort) ?? 'recent';
  const [data, user] = await Promise.all([forumDirectory(query, sort), currentUser()]);
  const now = new Date().toISOString();
  const searchForm = (
    <form action="/forum" method="get" role="search" className="forum-quick-search">
      <label htmlFor="forum-search" className="sr-only">
        Buscar hilos por título
      </label>
      <input
        id="forum-search"
        type="search"
        name="q"
        maxLength={100}
        defaultValue={query}
        placeholder="Buscar debates, guías o temas en los foros…"
      />
      <input type="hidden" name="sort" value={sort} />
      <button type="submit" className="button outline small" aria-label="Buscar hilos">
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );
  const sorts = [
    { id: 'active', label: '🔥 Más activos' },
    { id: 'recent', label: '⏱️ Recientes' },
    { id: 'unanswered', label: '❓ Sin respuestas' },
  ] as const;
  const icons: Record<string, string> = {
    'gamepad-2': '🎮',
    flame: '🔥',
    map: '🗺️',
    sparkles: '✨',
    coffee: '☕',
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SAVESTATE BOARDS</p>
          <h1>Una comunidad. Mil conversaciones.</h1>
          <p className="muted">De la taberna retro a tu próximo descubrimiento.</p>
        </div>
      </div>
      {user ? (
        <ForumCreate categories={data.categories} toolbar={searchForm} />
      ) : (
        <div className="forum-toolbar">
          {searchForm}
          <Link className="button" href="/login?next=/forum">
            Conectar para crear un hilo
          </Link>
        </div>
      )}
      <section className="forum-channels-grid" aria-label="Canales del foro">
        {data.categories.map((category) => {
          const stats = data.stats.find((s) => s.category_id === category.id);
          return (
            <Link
              className="forum-channel-card"
              data-category={forumChannel(category.id)?.theme}
              key={category.id}
              href={`/forum/${category.id}`}
            >
              <div className="forum-channel-heading">
                <span className="forum-icon" aria-hidden="true">
                  {icons[category.icon] ?? '💬'}
                </span>
                <h2>{category.name}</h2>
              </div>
              <p className="muted">{category.description}</p>
              <div className="forum-channel-metrics">
                <span className="tag">{stats?.threads ?? 0} hilos</span>
                <span className="tag">{stats?.messages ?? 0} mensajes</span>
              </div>
              <small>
                Última actividad:{' '}
                {stats?.last_activity ? (
                  <time dateTime={stats.last_activity}>
                    {notificationAge(stats.last_activity, now)}
                  </time>
                ) : (
                  'Sin actividad todavía'
                )}
              </small>
            </Link>
          );
        })}
      </section>
      <h2>{query ? 'Resultados de búsqueda.' : 'Conversaciones de la comunidad.'}</h2>
      <nav className="filter-buttons" aria-label="Ordenar hilos">
        {sorts.map((item) => (
          <Link
            key={item.id}
            className={`button small ${sort === item.id ? '' : 'outline'}`}
            aria-current={sort === item.id ? 'page' : undefined}
            href={`/forum?${new URLSearchParams({ ...(query ? { q: query } : {}), sort: item.id }).toString()}`}
            scroll={false}
          >
            {item.label}
          </Link>
        ))}
        {query ? (
          <Link className="button outline small" href={`/forum?sort=${sort}`} scroll={false}>
            Limpiar búsqueda
          </Link>
        ) : null}
      </nav>
      {query ? <p className="muted">Hasta 20 coincidencias por título para «{query}».</p> : null}
      <ForumThreadList
        threads={data.hot}
        categories={data.categories}
        emptyMessage={
          query || sort === 'unanswered'
            ? 'No hay hilos que coincidan con esta búsqueda o filtro.'
            : undefined
        }
      />
    </>
  );
}
