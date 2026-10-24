import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { PostForm } from '@/components/highlights/post-form';
import { PostCard } from '@/components/highlights/post-card';
import { highlightFeed } from '@/services/highlights';
import { POST_CATEGORIES, CATEGORY_LABELS, type PostCategory } from '@/domain/highlights';
import { tavernTab, legacyTavernHref, type TavernTab, type TavernPageProps } from '@/domain/tavern';
export const metadata = { title: 'SaveState // La Taberna Gamer' };
function TavernHeading({activeTab}:{activeTab:TavernTab}) {
  const titles = {
    debates: {eyebrow:'SAVESTATE // LA TABERNA SOCIAL',title:'Una comunidad. Mil conversaciones.',subtitle:'De la taberna retro a tu próximo gran descubrimiento gamer.'},
    momentos: {eyebrow:'SAVESTATE // REGISTRO DE HAZAÑAS',title:'Momentos & Jugadas Épicas.',subtitle:'Clips, capturas y anécdotas inolvidables compartidas por la comunidad.'},
    arcade: {eyebrow:'SAVESTATE // ZONA COMPETITIVA & LFG',title:'Sala Arcade & Convocatorias de Escuadrón',subtitle:'Duelos comunitarios y lobbies de 48 horas para cooperar o cazar trofeos.'}
  };
  const meta=titles[activeTab];
  return <>
    <div className="page-heading"><div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p className="muted">{meta.subtitle}</p></div></div>
    <nav className="forum-view-tabs tavern-view-tabs" aria-label="Secciones de La Taberna">
      {([['debates','💬 Debates Comunitarios','/tavern'],['momentos','✨ Momentos Épicos','/tavern?tab=momentos'],['arcade','🕹️ Sala Arcade & LFG','/tavern?tab=arcade']] as const).map(([tab,label,href])=><Link key={tab} href={href} className={`button small ${activeTab===tab?'':'outline'}`} aria-current={activeTab===tab?'page':undefined} scroll={false}>{label}</Link>)}
    </nav>
  </>;
}
export default async function TavernPage({searchParams}:TavernPageProps) {
  const search=await searchParams;
  const activeTab=tavernTab(search.tab), configured=isConfigured();
  if(activeTab==='momentos') {
    if(!configured) return <><TavernHeading activeTab={activeTab}/><SetupNotice/></>;
  const category = typeof search.category === 'string' ? search.category : undefined;
  const page = search.page === undefined ? 1 : typeof search.page === 'string' ? Number(search.page) : NaN;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    (category && !POST_CATEGORIES.includes(category as PostCategory))
  )
    notFound();
  const filters = {
    player: typeof search.player === 'string' ? search.player : undefined,
    game: typeof search.game === 'string' ? search.game : undefined,
    post: typeof search.post === 'string' ? search.post : undefined,
  };
  if (
    Object.values(filters).some(
      (value) =>
        value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
    )
  )
    notFound();
  const [feed, user] = await Promise.all([
    highlightFeed({ ...filters, category: category as PostCategory | undefined, page }),
    currentUser(),
  ]);
  function href(changes: Record<string, string>) {
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
      ...(category ? { category } : {}),
      page: String(page),
      ...changes,
    });
    query.set('tab', 'momentos');
    return `/tavern?${query}`;
  }
  return (
    <>
      <TavernHeading activeTab={activeTab} />
      {user ? (
        <PostForm
          key={typeof search.draft === 'string' ? search.draft.slice(0, 5000) : ''}
          userId={user.id}
          initialDraft={typeof search.draft === 'string' ? search.draft.slice(0, 5000) : undefined}
          initialTitle={
            typeof search.draftTitle === 'string' ? search.draftTitle.slice(0, 120) : undefined
          }
        />
      ) : (
        <p>
          <Link className="button" href={'/login?next=' + encodeURIComponent(legacyTavernHref(search, 'momentos'))}>
            Conecta para publicar
          </Link>
        </p>
      )}
      <nav className="highlight-filters" aria-label="Categorías de momentos">
        <Link
          className="tag"
          aria-current={!category ? 'page' : undefined}
          href={href({ category: '', page: '1' })}
        >
          Todos
        </Link>
        {POST_CATEGORIES.map((value) => (
          <Link
            className="tag"
            key={value}
            aria-current={category === value ? 'page' : undefined}
            href={href({ category: value, page: '1' })}
          >
            {CATEGORY_LABELS[value]}
          </Link>
        ))}
        {filters.player || filters.game || filters.post ? (
          <Link className="accent" href="/tavern?tab=momentos">
            Ver toda la comunidad
          </Link>
        ) : null}
      </nav>
      <div className="highlight-feed">
        {feed.posts.map((post) => (
          <PostCard key={post.id} post={post} viewerId={user?.id ?? null} />
        ))}
      </div>
      {!feed.posts.length ? (
        <div className="empty-state">
          <h2>Todavía no hay momentos visibles.</h2>
          <p>Comparte el próximo checkpoint de la comunidad.</p>
        </div>
      ) : null}
      <nav className="highlight-carousel" aria-label="Páginas de momentos">
        {page > 1 ? (
          <Link className="button secondary" href={href({ page: String(page - 1) })}>
            Anteriores
          </Link>
        ) : null}
        {page * 12 < feed.total ? (
          <Link className="button secondary" href={href({ page: String(page + 1) })}>
            Más momentos
          </Link>
        ) : null}
      </nav>
    </>
  );
  }
  if (activeTab === 'arcade') {
    const [duel, feed, user] = await Promise.all([
      configured ? duelSummary() : null,
      configured ? partyFeed({ page: 1 }) : { items: [], hasMore: false, generatedAt: 0 },
      currentUser(),
    ]);
    return (
      <>
        <TavernHeading activeTab={activeTab} />
        <div className="arcade-section forum-arcade-section">
          <SetupNotice />
          {duel ? (
            <GameDuelWidget
              initial={duel}
              authenticated={Boolean(user)}
              loginHref="/login?next=%2Ftavern%3Ftab%3Darcade"
            />
          ) : (
            <section className="panel">
              <h2>Duelo comunitario</h2>
              <p className="muted">
                No hay un duelo activo por ahora. Las convocatorias siguen abiertas.
              </p>
            </section>
          )}
          <PartyBoard initial={feed} viewerId={user?.id ?? null} configured={configured} />
        </div>
      </>
    );
  }
  if (!configured)
    return (
      <>
        <TavernHeading activeTab={activeTab} />
        <SetupNotice />
      </>
    );
  const query = forumSearch(search.q);
  const sort = FORUM_SORTS.find((value) => value === search.sort) ?? 'recent';
  const channel =
    typeof search.channel === 'string' &&
    FORUM_CATEGORIES.includes(search.channel as (typeof FORUM_CATEGORIES)[number])
      ? search.channel
      : '';
  const [data, user] = await Promise.all([
    forumDirectory(query, sort, channel),
    currentUser(),
  ]);
  const link = (nextSort = sort, nextChannel = channel) =>
    '/tavern?' +
    new URLSearchParams({
      ...(query ? { q: query } : {}),
      sort: nextSort,
      ...(nextChannel ? { channel: nextChannel } : {}),
    });
  const now = new Date().toISOString();
  const searchForm = (
    <form action="/tavern" method="get" role="search" className="forum-quick-search">
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
      <TavernHeading activeTab={activeTab} />
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
        <ForumCreate categories={data.categories} toolbar={searchForm} returnHref={link()} />
      ) : (
        <div className="forum-toolbar">
          {searchForm}
          <Link className="button" href="/login?next=%2Ftavern">
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
            href={link(item.id)}
            scroll={false}
          >
            {item.label}
          </Link>
        ))}
        {query ? (
          <Link
            className="button outline small"
            href={'/tavern?' + new URLSearchParams({ sort, ...(channel ? { channel } : {}) })}
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
