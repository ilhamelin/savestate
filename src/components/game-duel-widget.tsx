'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { browserClient } from '@/integrations/supabase/browser';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import { duelPercentages, type DuelSummary } from '@/domain/arcade';
export function GameDuelWidget({
  initial,
  authenticated,
}: {
  initial: DuelSummary;
  authenticated: boolean;
}) {
  const [summary, setSummary] = useState<DuelSummary | null>(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const busy = useRef(false),
    id = useId();
  const generation = useRef(0);
  useEffect(() => {
    const db = browserClient();
    let disposed = false,
      controller: AbortController | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (document.visibilityState !== 'visible' || busy.current) return;
      controller?.abort();
      const next = new AbortController();
      controller = next;
      const requestGeneration = generation.current;
      try {
        const response = await fetch(`/api/arcade?duel=${initial.duel.id}`, {
          signal: next.signal,
          cache: 'no-store',
        });
        const result = await readJsonResponse<{ data: DuelSummary | null }>(response);
        if (!disposed && !next.signal.aborted && requestGeneration === generation.current) {
          setSummary(result.data);
          setError('');
        }
      } catch {
        if (!disposed && !next.signal.aborted) setError('No se pudieron actualizar los votos.');
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 250);
    }
    const channel = db
      .channel(`duel:${initial.duel.id}:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'duel_votes',
          filter: `duel_id=eq.${initial.duel.id}`,
        },
        schedule,
      )
      .subscribe();
    const poll = setInterval(() => void refresh(), 15000);
    document.addEventListener('visibilitychange', schedule);
    // Recover any votes between SSR and subscribing.
    void refresh();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', schedule);
      void db.removeChannel(channel);
    };
  }, [initial.duel.id, id]);
  async function vote(gameId: string) {
    if (busy.current) return;
    busy.current = true;
    generation.current += 1;
    setPending(true);
    setError('');
    try {
      setSummary(
        await api<DuelSummary | null>('arcade', {
          action: 'vote',
          duel_id: initial.duel.id,
          game_id: gameId,
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo votar.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (!summary) return <p className="notice">Este duelo ha terminado.</p>;
  const gameIds = [summary.duel.game_a_id, summary.duel.game_b_id];
  const counts = gameIds.map((gameId) => summary.votes[gameId] ?? 0);
  const percentages = duelPercentages(counts[0] ?? 0, counts[1] ?? 0);
  return (
    <section className="duel-widget panel" aria-label="Duelo de juegos">
      <p className="eyebrow">SALA ARCADE / VERSUS</p>
      <h2>{summary.duel.title}</h2>
      <div className="duel-arena">
        {gameIds.map((gameId, index) => {
          const game = summary.games.find((g) => g.id === gameId);
          return game ? (
            <div
              className={`duel-contender ${summary.ownVote === gameId ? 'duel-chosen' : ''}`}
              key={gameId}
            >
              <Link href={`/games/${game.slug}`} className="duel-cover">
                {game.cover_url ? (
                  <Image
                    src={game.cover_url}
                    alt={game.title}
                    fill
                    sizes="(max-width: 640px) 35vw, 180px"
                  />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}
              </Link>
              <h3>{game.title}</h3>
              {summary.ownVote ? (
                <>
                  <div
                    role="progressbar"
                    aria-label={`Votos para ${game.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentages[index]}
                    className="duel-meter"
                  >
                    <span style={{ width: `${percentages[index]}%` }} />
                  </div>
                  <p>
                    {percentages[index]}% {summary.ownVote === gameId ? '· Tu voto' : ''}
                  </p>
                </>
              ) : authenticated ? (
                <button
                  className="button small"
                  disabled={pending}
                  onClick={() => void vote(gameId)}
                >
                  Votar por {game.title}
                </button>
              ) : (
                <Link className="text-link" href="/login?next=/">
                  Conecta para votar
                </Link>
              )}
            </div>
          ) : null;
        })}
        <span className="duel-vs" aria-hidden="true">
          VS
        </span>
      </div>
      <p role="status" className="muted">
        {pending
          ? 'Registrando voto…'
          : `${counts.reduce((a, b) => a + b, 0)} votos en la comunidad`}
      </p>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </section>
  );
}
