import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { forumConversation } from '@/services/forum';
import { FORUM_CATEGORIES, forumPage } from '@/domain/forum';
import { ForumConversation } from '@/components/forum-conversation';
import { ForumPagination } from '@/components/forum-thread-list';
import { uuid } from '@/domain/validation';
export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; thread_id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const { category, thread_id } = await params;
  if (
    !FORUM_CATEGORIES.includes(category as (typeof FORUM_CATEGORIES)[number]) ||
    !/^[0-9a-f-]{36}$/i.test(thread_id)
  )
    notFound();
  let page: number;
  try {
    page = forumPage((await searchParams).page);
    uuid(thread_id);
  } catch {
    notFound();
  }
  const data = await forumConversation(category, thread_id, page);
  if (!data) notFound();
  return (
    <>
      <Link className="accent" href={`/forum/${category}`}>
        ← Volver al canal
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SAVESTATE BOARDS</p>
          <h1>{data.thread.title}</h1>
          <div className="tags">
            {data.thread.is_pinned ? <span className="tag">📌 Fijado</span> : null}
            {data.thread.is_locked ? <span className="tag">🔒 Cerrado</span> : null}
            {data.thread.game ? (
              <Link className="tag" href={`/games/${data.thread.game.slug}`}>
                {data.thread.game.title}
              </Link>
            ) : null}
          </div>
          <p className="muted">
            {data.total} respuestas · {data.thread.views_count} lecturas
          </p>
        </div>
      </div>
      <ForumPagination page={page} total={data.total} base={`/forum/${category}/${thread_id}`} />
      <ForumConversation {...data} />
      <ForumPagination page={page} total={data.total} base={`/forum/${category}/${thread_id}`} />
    </>
  );
}
