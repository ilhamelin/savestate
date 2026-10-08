import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { PostForm } from '@/components/highlights/post-form';
import { PostCard } from '@/components/highlights/post-card';
import { highlightFeed } from '@/services/highlights';
import { POST_CATEGORIES, CATEGORY_LABELS, type PostCategory } from '@/domain/highlights';
export const metadata = { title: 'Momentos Gamer' };
export default async function Highlights({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const page = Number(params.page ?? 1);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    (category && !POST_CATEGORIES.includes(category as PostCategory))
  )
    notFound();
  const filters = {
    player: typeof params.player === 'string' ? params.player : undefined,
    game: typeof params.game === 'string' ? params.game : undefined,
    post: typeof params.post === 'string' ? params.post : undefined,
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
      ...changes,
    });
    return `/highlights?${query}`;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNITY CHECKPOINTS</p>
          <h1>Momentos Gamer.</h1>
          <p>Comparte tu partida épica, un glitch o ese momento que no olvidarás.</p>
        </div>
      </div>
      {user ? (
        <PostForm userId={user.id} />
      ) : (
        <p>
          <Link className="button" href="/login?next=/highlights">
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
          <Link className="accent" href="/highlights">
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
