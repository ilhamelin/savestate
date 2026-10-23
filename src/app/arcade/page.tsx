import { GameDuelWidget } from '@/components/game-duel-widget';
import { PartyBoard } from '@/components/arcade/party-board';
import { SetupNotice } from '@/components/setup-notice';
import { duelSummary, partyFeed } from '@/services/arcade';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';

export const metadata = { title: 'Sala Arcade & LFG' };
export default async function ArcadePage() {
  const configured = isConfigured();
  const [duel, feed, user] = await Promise.all([
    configured ? duelSummary() : null,
    configured ? partyFeed({ page: 1 }) : { items: [], hasMore: false, generatedAt: 0 },
    currentUser(),
  ]);
  return (
    <div className="arcade-section">
      <header className="panel arcade-heading">
        <p className="eyebrow">INSERT COIN // COMUNIDAD MULTIJUGADOR</p>
        <h1>Sala Arcade & LFG · Encuentra tu escuadrón</h1>
        <p className="muted">
          Duelos comunitarios y lobbies de 48 horas para cooperar, competir o cazar logros.
        </p>
      </header>
      <SetupNotice />
      {duel ? (
        <GameDuelWidget initial={duel} authenticated={Boolean(user)} />
      ) : (
        <section className="panel">
          <h2>Duelo comunitario</h2>
          <p className="muted">
            No hay un duelo activo por ahora. Las convocatorias siguen abiertas.
          </p>
        </section>
      )}
      <PartyBoard initial={feed} viewerId={user?.id ?? null} configured={configured} />
    </div>
  );
}
