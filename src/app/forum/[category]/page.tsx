import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { SetupNotice } from '@/components/setup-notice';
import { forumCategories, forumThreads } from '@/services/forum';
import { uuid } from '@/domain/validation';
import { FORUM_CATEGORIES, forumPage } from '@/domain/forum';
import { ForumCreate } from '@/components/forum-create';
import { ForumThreadList, ForumPagination } from '@/components/forum-thread-list';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck } from '@/lib/http';
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; game?: string }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const { category } = await params;
  if (!FORUM_CATEGORIES.includes(category as (typeof FORUM_CATEGORIES)[number])) notFound();
  const search = await searchParams;
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
    forumThreads(category, page, search.game),
  ]);
  const channel = directory.find((c) => c.id === category);
  if (!channel) notFound();
  const gameResult = search.game
    ? await (await serverClient()).from('games').select('*').eq('id', search.game).maybeSingle()
    : { data: null, error: null };
  dbCheck(gameResult.error);
  return (
    <>
      <Link className="accent" href="/forum">
        ← Todos los canales
      </Link>
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
        />
      ) : (
        <Link
          className="button"
          href={`/login?next=${encodeURIComponent(`/forum/${category}${search.game ? '?game=' + search.game : ''}`)}`}
        >
          Conectar para crear un hilo
        </Link>
      )}
      <ForumThreadList threads={list.threads} />
      <ForumPagination
        page={page}
        total={list.total}
        base={`/forum/${category}${search.game ? '?game=' + encodeURIComponent(search.game) : ''}`}
      />
    </>
  );
}
