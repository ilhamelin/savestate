import Image from 'next/image';
import Link from 'next/link';
import type { Game, Profile, UserList } from '@/domain/model';

export function CollectionCard({
  list,
  author,
  games,
  count,
}: {
  list: UserList;
  author: Pick<Profile, 'id' | 'username' | 'avatar_url'> | null;
  games: (Pick<Game, 'id' | 'title' | 'cover_url'> | null)[];
  count: number;
}) {
  const href = `/lists/${list.id}`;
  return (
    <article className="collection-card">
      <Link
        href={href}
        className="collection-cover-container"
        aria-label={`Abrir colección ${list.title}`}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <span className="collection-cover-cell" key={index}>
            {games[index]?.cover_url ? (
              <Image src={games[index].cover_url} fill sizes="45px" alt="" unoptimized />
            ) : (
              <span aria-hidden="true">#</span>
            )}
          </span>
        ))}
      </Link>
      <div className="collection-meta">
        <h2>
          <Link href={href}>{list.title}</Link>
        </h2>
        <p className="muted collection-description">
          {list.description ||
            (count === 0 ? 'En preparación' : 'Una colección de mundos por descubrir.')}
        </p>
        <div className="collection-author">
          {author ? (
            <Link href={`/players/${encodeURIComponent(author.username)}`}>
              {author.avatar_url ? (
                <Image src={author.avatar_url} width={22} height={22} alt="" unoptimized />
              ) : (
                <span className="collection-author-placeholder" aria-hidden="true">
                  ▣
                </span>
              )}
              <span>@{author.username}</span>
            </Link>
          ) : (
            <span className="muted">Autor no disponible</span>
          )}
        </div>
        <div className="collection-badges">
          <span className="tag">
            🎮 {count} {count === 1 ? 'juego' : 'juegos'}
          </span>
          <span className={`tag ${list.is_private ? 'collection-private' : 'collection-shared'}`}>
            {list.is_private ? '🔒 Privada' : '🌐 Compartida'}
          </span>
        </div>
      </div>
    </article>
  );
}
