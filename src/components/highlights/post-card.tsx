import Link from 'next/link';
import { CATEGORY_LABELS } from '@/domain/highlights';
import { renderMarkdown } from '@/services/markdown';
import type { highlightFeed } from '@/services/highlights';
import { PostMedia } from './post-media';
import { PostActions } from './post-actions';
type FeedPost = Awaited<ReturnType<typeof highlightFeed>>['posts'][number];
export function PostCard({ post, viewerId }: { post: FeedPost; viewerId: string | null }) {
  return (
    <article className="panel highlight-card" id={`post-${post.id}`}>
      <div className="eyebrow">
        <Link href={`/players/${post.username}`}>@{post.username}</Link> ·{' '}
        {CATEGORY_LABELS[post.category]}
        {post.is_private ? ' · SOLO YO' : ''}
      </div>
      <h2>{post.title}</h2>
      <small>{new Date(post.created_at).toISOString().slice(0, 10)}</small>
      {post.game ? (
        <p>
          <Link className="accent" href={`/games/${post.game.slug}`}>
            {post.game.title}
          </Link>
        </p>
      ) : null}
      <div
        className="markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
      />
      <PostMedia
        key={post.images.join('|')}
        images={post.images}
        videoId={post.youtube_video_id}
        title={post.title}
        unavailable={post.mediaUnavailable}
      />
      <PostActions
        postId={post.id}
        viewerId={viewerId}
        ownerId={post.user_id}
        counts={post.counts}
        selected={post.ownReaction}
      />
    </article>
  );
}
