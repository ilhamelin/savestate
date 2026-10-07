'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ReviewActions } from '@/components/community-forms';
import type { Review, ReviewReaction, ReviewComment } from '@/domain/model';
export function ReviewCard({
  review,
  html,
  username,
  rating,
  userId,
  reactions,
  comments,
  names,
}: {
  review: Review;
  html: string;
  username: string;
  rating: number | null;
  userId: string | null;
  reactions: ReviewReaction[];
  comments: ReviewComment[];
  names: Record<string, string>;
}) {
  const [revealed, setRevealed] = useState(false);
  const hidden = review.has_spoilers && !revealed;
  return (
    <article className="panel">
      <div className="review-meta">
        <Link className="accent" href={`/players/${username}`}>
          @{username}
        </Link>
        <span>
          {rating ? `★ ${rating}/10` : 'Sin nota'} ·{' '}
          {new Date(review.created_at).toISOString().slice(0, 10)}
        </span>
      </div>
      {hidden ? (
        <div className="spoiler-cover">
          <strong>⚠ Esta reseña contiene spoilers.</strong>
          <p className="muted">Revela el texto solo si quieres continuar.</p>
          <button className="button secondary" onClick={() => setRevealed(true)}>
            Revelar reseña
          </button>
        </div>
      ) : (
        <>
          <div className="review-body" dangerouslySetInnerHTML={{ __html: html }} />
          {review.has_spoilers ? (
            <button className="button secondary" onClick={() => setRevealed(false)}>
              Ocultar spoilers
            </button>
          ) : null}
          <ReviewActions
            id={review.id}
            userId={userId}
            reactions={reactions}
            comments={comments}
            names={names}
          />
        </>
      )}
    </article>
  );
}
