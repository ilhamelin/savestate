import Link from 'next/link';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { SetupNotice } from '@/components/setup-notice';
import { forumDirectory } from '@/services/forum';
import { ForumCreate } from '@/components/forum-create';
import { ForumThreadList } from '@/components/forum-thread-list';
import { forumChannel, forumSearch, FORUM_SORTS, FORUM_CATEGORIES } from '@/domain/forum';
import { notificationAge } from '@/domain/notifications';
import { Search } from 'lucide-react';
import { duelSummary, partyFeed } from '@/services/arcade';
import { GameDuelWidget } from '@/components/game-duel-widget';
import { PartyBoard } from '@/components/arcade/party-board';

function ForumHeading({ activeTab }: { activeTab: 'arcade' | 'debates' }) {
  const arcade = activeTab === 'arcade';
  return <>
    <div className="page-heading">
      <div>
        <p className="eyebrow">{arcade ? 'SAVESTATE BOARDS // SALA ARCADE & LFG' : 'SAVESTATE BOARDS'}</p>
        <h1>{arcade ? 'Sala Arcade & Convocatorias de Escuadrón' : 'Una comunidad. Mil conversaciones.'}</h1>
        <p className="muted">{arcade ? 'Duelos comunitarios y lobbies de 48 horas para cooperar, competir o cazar logros.' : 'De la taberna retro a tu próximo descubrimiento.'}</p>
      </div>
    </div>
    <nav className="forum-view-tabs" aria-label="Secciones del Foro">
      <Link href="/forum" className={`button small ${arcade ? 'outline' : ''}`} aria-current={!arcade ? 'page' : undefined} scroll={false}>💬 Debates Comunitarios</Link>
      <Link href="/forum?tab=arcade" className={`button small ${arcade ? '' : 'outline'}`} aria-current={arcade ? 'page' : undefined} scroll={false}>🕹️ Sala Arcade & LFG</Link>
    </nav>
  </>;
}
export interface ForumPageProps {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
    channel?: string | string[];
    tab?: string | string[];
  }>;
}
export const metadata = { title: 'SaveState Boards' };
export default async function ForumPage({ searchParams }: ForumPageProps) {
  const configured = isConfigured();
  const search = await searchParams;
  const activeTab = search.tab === 'arcade' ? 'arcade' : 'debates';
  if (activeTab === 'arcade') {
    const [duel, feed, user] = await Promise.all([
      configured ? duelSummary() : null,
      configured ? partyFeed({ page: 1 }) : { items: [], hasMore: false, generatedAt: 0 },
      currentUser(),
    ]);
    return <>
      <ForumHeading activeTab={activeTab} />
      <div className="arcade-section forum-arcade-section">
        <SetupNotice />
        {duel ? <GameDuelWidget initial={duel} authenticated={Boolean(user)} loginHref="/login?next=/forum?tab=arcade" /> : (
          <section className="panel">
            <h2>Duelo comunitario</h2>
            <p className="muted">No hay un duelo activo por ahora. Las convocatorias siguen abiertas.</p>
          </section>
        )}
        <PartyBoard initial={feed} viewerId={user?.id ?? null} configured={configured} />
      </div>
    </>;
  }
  if (!configured) return <><ForumHeading activeTab={activeTab} /><SetupNotice /></>;
  const query = forumSearch(search.q);
  const sort = FORUM_SORTS.find((value) => value === search.sort) ?? 'recent';
  const channel =
    typeof search.channel === 'string' &&
    FORUM_CATEGORIES.includes(search.channel as (typeof FORUM_CATEGORIES)[number])
      ? search.channel
      : '';
  const [data, user, duel] = await Promise.all([
    forumDirectory(query, sort, channel),
    currentUser(),
    duelSummary(),
  ]);
  const firstGame = duel?.games.find(game => game.id === duel.duel.game_a_id);
  const secondGame = duel?.games.find(game => game.id === duel.duel.game_b_id);
  const duelLabel = firstGame && secondGame ? `${firstGame.title} vs ${secondGame.title}` : duel?.duel.title;
  const link = (nextSort = sort, nextChannel = channel) =>
    '/forum?' +
    new URLSearchParams({
      ...(query ? { q: query } : {}),
      sort: nextSort,
      ...(nextChannel ? { channel: nextChannel } : {}),
    });
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
      {channel ? <input type="hidden" name="channel" value={channel} /> : null}
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
      <ForumHeading activeTab={activeTab} />
      <div className="forum-global-stats" aria-label="Estadísticas globales del foro">
        <span>
          📡 <strong>{data.categories.length}</strong> canales
        </span>
        <span>
          💬 <strong>{data.stats.reduce((sum, s) => sum + s.threads, 0)}</strong> hilos
        </span>
        <span>
          📝 <strong>{data.stats.reduce((sum, s) => sum + s.messages, 0)}</strong> mensajes
        </span>
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
      {duel ? (
        <aside className="forum-arcade-banner" aria-label="Duelo comunitario en vivo">
          <div className="forum-arcade-banner-text">
            <span className="forum-arcade-pulse" aria-hidden="true">⚡</span>
            <div><strong>Duelo Comunitario en Vivo:</strong> <span>{duelLabel}</span></div>
          </div>
          <Link href="/forum?tab=arcade" className="button small outline">Votar en Arcade →</Link>
        </aside>
      ) : null}
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
            href={link(item.id)}
            scroll={false}
          >
            {item.label}
          </Link>
        ))}
        {query ? (
          <Link
            className="button outline small"
            href={'/forum?' + new URLSearchParams({ sort, ...(channel ? { channel } : {}) })}
            scroll={false}
          >
            Limpiar búsqueda
          </Link>
        ) : null}
      </nav>
      <nav className="filter-buttons forum-channel-filters" aria-label="Filtrar hilos por canal">
        <Link
          className={'button small ' + (!channel ? '' : 'outline')}
          href={link(sort, '')}
          scroll={false}
          aria-current={!channel ? 'page' : undefined}
        >
          Todos los canales
        </Link>
        {data.categories.map((c) => (
          <Link
            key={c.id}
            className={'button small ' + (channel === c.id ? '' : 'outline')}
            href={link(sort, c.id)}
            scroll={false}
            aria-current={channel === c.id ? 'page' : undefined}
            data-category={forumChannel(c.id)?.theme}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      {query ? <p className="muted">Hasta 24 coincidencias por título para «{query}».</p> : null}
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
