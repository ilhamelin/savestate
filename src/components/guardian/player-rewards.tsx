'use client';
import { useEffect, useState } from 'react';
export function PlayerRewards({
  playerId,
  onUpdated,
}: {
  playerId: string;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<'xp' | 'badge' | null>(null);
  const [badges, setBadges] = useState<{ id: string; name: string }[]>([]);
  const [badge, setBadge] = useState('');
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (mode !== 'badge') return;
    const controller = new AbortController();
    fetch(`/api/guardian/players/${playerId}/rewards`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar las insignias.');
        if (!controller.signal.aborted) {
          setBadges(result.badges);
          setBadge(result.badges[0]?.id ?? '');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setNotice(error.message);
      });
    return () => controller.abort();
  }, [mode, playerId]);
  async function reward(input: unknown) {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(`/api/guardian/players/${playerId}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo otorgar el premio.');
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo otorgar el premio.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="guardian-player-rewards">
      <div className="filter-buttons">
        <button
          className="button outline"
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === 'xp' ? null : 'xp')}
        >
          🎁 Premiar XP
        </button>
        <button
          className="button outline"
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === 'badge' ? null : 'badge')}
        >
          🎖️ Asignar Badge
        </button>
      </div>
      {mode === 'xp' && (
        <div className="filter-buttons">
          {[50, 100, 500].map((xp) => (
            <button
              className="button"
              type="button"
              key={xp}
              disabled={busy}
              onClick={() => void reward({ xp })}
            >
              +{xp} XP
            </button>
          ))}
        </div>
      )}
      {mode === 'badge' && (
        <>
          <label>
            Insignia
            <select
              value={badge}
              disabled={busy}
              onChange={(event) => setBadge(event.target.value)}
            >
              {badges.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-buttons">
            <button
              className="button"
              type="button"
              disabled={busy || !badge}
              onClick={() => void reward({ badge_id: badge, action: 'grant' })}
            >
              Asignar
            </button>
            <button
              className="button outline"
              type="button"
              disabled={busy || !badge}
              onClick={() => void reward({ badge_id: badge, action: 'revoke' })}
            >
              Retirar insignia
            </button>
          </div>
        </>
      )}
      <p role="status">{busy ? 'Aplicando premio…' : notice}</p>
    </section>
  );
}
