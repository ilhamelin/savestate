import Link from 'next/link';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { duelSummary } from '@/services/arcade';
import { GameDuelWidget } from '@/components/game-duel-widget';
export async function ArcadeSection() {
  if (!isConfigured()) return null;
  const [summary, user] = await Promise.all([duelSummary(), currentUser()]);
  return (
    <section className="arcade-section">
      {summary ? (
        <GameDuelWidget key={summary.duel.id} initial={summary} authenticated={Boolean(user)} />
      ) : (
        <div className="panel">
          <p className="eyebrow">SALA ARCADE</p>
          <h2>Preparando el próximo duelo.</h2>
          <p className="muted">Pronto podrás votar por tu juego favorito.</p>
        </div>
      )}
      <Link className="button secondary" href="/parties">
        Busco compañero de partida →
      </Link>
    </section>
  );
}
