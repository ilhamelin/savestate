import { gameForumThreads } from '@/services/forum';
import { ForumThreadList } from './forum-thread-list';
import Link from 'next/link';
import { highlightFeed } from '@/services/highlights';
import { PostMedia } from './highlights/post-media';
export async function GameForum({ gameId }: { gameId: string }) {
  const [threads, moments] = await Promise.all([
    gameForumThreads(gameId),
    highlightFeed({ game: gameId, page: 1, pageSize: 6, mediaOnly: true }),
  ]);
  return (
    <>
      <section className="panel">
        <h2>Conversaciones del Foro</h2>
        <Link className="button outline small" href={`/forum/general-gaming?game=${gameId}`}>
          + Iniciar debate en el Foro
        </Link>
        <ForumThreadList threads={threads} />
      </section>
      <section className="panel">
        <h2>Momentos de este Juego</h2>
        <div className="game-moments">
          {moments.posts.map((post) => (
            <article key={post.id}>
              <h3>
                <Link href={`/highlights?post=${post.id}`}>{post.title}</Link>
              </h3>
              <p className="muted">
                Por{' '}
                <Link href={`/players/${encodeURIComponent(post.username)}`}>@{post.username}</Link>
              </p>
              <PostMedia
                images={post.images}
                videoId={post.youtube_video_id}
                title={post.title}
                unavailable={post.mediaUnavailable}
              />
              <Link className="accent" href={`/highlights?post=${post.id}`}>
                Ver momento y comentarios ↗
              </Link>
            </article>
          ))}
        </div>
        {!moments.posts.length ? (
          <p className="muted">Todavía no hay momentos visibles de este juego.</p>
        ) : null}
        <Link className="button outline small" href={`/highlights?game=${gameId}`}>
          Ver todos los momentos ↗
        </Link>
      </section>
    </>
  );
}
