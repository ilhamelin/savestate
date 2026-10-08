import { cache } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverClient } from '@/integrations/supabase/server';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { dbCheck } from '@/lib/http';
import { sanitizeHtml } from '@/services/markdown';
import { LibraryForm, DeleteReview } from '@/components/library-forms';
import { ReviewForm } from '@/components/review-form';
import { ReviewCard } from '@/components/review-card';
import { SetupNotice } from '@/components/setup-notice';
const gameBySlug = cache(async (slug: string) => {
  if (!isConfigured() || !/^[a-z0-9-]+$/.test(slug)) return null;
  const db = await serverClient();
  const { data, error } = await db.from('games').select('*').eq('slug', slug).maybeSingle();
  dbCheck(error);
  return data;
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await gameBySlug(slug);
  return { title: game?.title ?? 'Ficha de juego', description: game?.synopsis?.slice(0, 160) };
}
export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isConfigured()) return <SetupNotice />;
  const { slug } = await params;
  const game = await gameBySlug(slug);
  if (!game) notFound();
  const db = await serverClient();
  const user = await currentUser();
  const [libraryResult, scoreResult, ownResult] = await Promise.all([
    db.from('user_games').select('*').eq('game_id', game.id).limit(200),
    db.rpc('game_statistics', { p_game_id: game.id }),
    user
      ? db
          .from('user_games')
          .select('*')
          .eq('game_id', game.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  dbCheck(libraryResult.error);
  dbCheck(scoreResult.error);
  dbCheck(ownResult.error);
  const entries = libraryResult.data ?? [],
    own = ownResult.data ?? undefined;
  const { data: reviewRows, error: reviewError } = entries.length
    ? await db
        .from('reviews')
        .select('*')
        .in(
          'user_game_id',
          entries.map((e) => e.id),
        )
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [], error: null };
  dbCheck(reviewError);
  const reviews = reviewRows ?? [],
    ids = reviews.map((r) => r.id);
  const [reactionRows, commentRows, profileRows, ownReviewResult] = await Promise.all([
    ids.length
      ? db.from('review_reactions').select('*').in('review_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? db.from('review_comments').select('*').in('review_id', ids).order('created_at').limit(300)
      : Promise.resolve({ data: [], error: null }),
    entries.length
      ? db
          .from('profiles')
          .select('*')
          .in(
            'id',
            entries.map((entry) => entry.user_id),
          )
      : Promise.resolve({ data: [], error: null }),
    own
      ? db.from('reviews').select('*').eq('user_game_id', own.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  [reactionRows, commentRows, profileRows, ownReviewResult].forEach((result) =>
    dbCheck(result.error),
  );
  const { data: commentAuthors, error: authorsError } = commentRows.data?.length
    ? await db
        .from('profiles')
        .select('*')
        .in(
          'id',
          commentRows.data.map((comment) => comment.user_id),
        )
    : { data: [], error: null };
  dbCheck(authorsError);
  const names = Object.fromEntries(
    [...(profileRows.data ?? []), ...(commentAuthors ?? [])].map((p) => [p.id, p.username]),
  );
  const score = scoreResult.data?.[0];
  return (
    <>
      <div className="page-heading">
        <Link className="text-link" href="/explore">
          ← Catálogo de juegos
        </Link>
      </div>
      <section className="detail-grid">
        <div className="cover">
          {game.cover_url ? (
            <Image
              src={game.cover_url}
              fill
              sizes="240px"
              alt={`Portada de ${game.title}`}
              priority
            />
          ) : (
            <span>Sin portada</span>
          )}
        </div>
        <div>
          <p className="eyebrow">GAME DATA TERMINAL / {game.release_year ?? 'SIN FECHA'}</p>
          <h1>{game.title}</h1>
          <div className="tags">
            {[...game.platforms, ...game.genres].map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <p className="muted">
            {game.developer ?? 'Estudio por confirmar'}
            {game.publisher ? ` · ${game.publisher}` : ''}
          </p>
          <p className="accent">
            ★ {score?.average ?? '—'}/10 · {score?.total ?? 0} puntuaciones públicas
          </p>
          <p className="synopsis" style={{ marginTop: 20 }}>
            {game.synopsis ?? 'Sin sinopsis disponible.'}
          </p>
          {user ? (
            <div className="panel">
              <LibraryForm key={own?.updated_at ?? 'new'} game={game} entry={own} />
            </div>
          ) : (
            <Link
              className="button"
              style={{ marginTop: 25 }}
              href={`/login?next=${encodeURIComponent(`/games/${game.slug}`)}`}
            >
              Conectar para guardar
            </Link>
          )}
        </div>
      </section>
      <section className="panel">
        <h2>Estadísticas públicas</h2>
        <p className="muted">
          Tiempo medio registrado por jugador: {score?.average_hours ?? '—'} h. Incluye sus
          rejugadas.
        </p>
        <div className="tags">
          {Object.entries(score?.distribution ?? {})
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([rating, count]) => (
              <span className="tag" key={rating}>
                ★ {rating}/10 · {count} votos
              </span>
            ))}
        </div>
        <p className="muted">Las bibliotecas privadas se excluyen de estos cálculos.</p>
      </section>
      <section id="write-review" className="panel">
        <p>
          <Link className="accent" href={`/highlights?game=${game.id}`}>
            Momentos de este juego ↗
          </Link>
        </p>
        <h2>Tu reseña, tu perspectiva.</h2>
        {user ? (
          <>
            <ReviewForm
              key={`${user.id}-${own?.updated_at ?? 'new'}-${ownReviewResult.data?.updated_at ?? 'new'}`}
              userId={user.id}
              gameId={game.id}
              entry={own}
              review={ownReviewResult.data ?? undefined}
            />
            {ownReviewResult.data ? <DeleteReview id={ownReviewResult.data.id} /> : null}
          </>
        ) : (
          <Link className="accent" href="/login">
            Inicia sesión para escribir una reseña.
          </Link>
        )}
      </section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAYER REVIEWS</p>
          <h2>Lo que dice la comunidad.</h2>
        </div>
      </div>
      {reviews.map((review) => {
        const entry = entries.find((e) => e.id === review.user_game_id)!;
        return (
          <ReviewCard
            key={`${review.id}-${review.updated_at}`}
            review={review}
            html={sanitizeHtml(review.content)}
            username={names[entry.user_id] ?? 'Jugador'}
            rating={entry.rating}
            userId={user?.id ?? null}
            reactions={(reactionRows.data ?? []).filter((r) => r.review_id === review.id)}
            comments={(commentRows.data ?? []).filter((c) => c.review_id === review.id)}
            names={names}
          />
        );
      })}
      {!reviews.length ? (
        <div className="empty-state">
          <p>Todavía no hay reseñas visibles para este juego.</p>
        </div>
      ) : null}
    </>
  );
}
