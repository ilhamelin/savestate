'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client-api';
import { friendLevelTier } from '@/domain/player-friends';
import { PARTY_STYLE_LABELS, remainingPartyTime, type PartyCardData } from '@/domain/arcade';
export { PartyModal as PartyComposer } from '@/components/arcade/party-modal';
export function PartyBoard({
  items,
  viewerId,
  generatedAt,
  onRemoved,
}: {
  items: PartyCardData[];
  viewerId: string | null;
  generatedAt: number;
  onRemoved?: (id: string) => void;
}) {
  const [now, setNow] = useState(generatedAt),
    [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false),
    router = useRouter();
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 30000);
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  async function copyContact(item: PartyCardData) {
    setError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(item.contact_note);
      setCopiedId(item.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 3000);
    } catch {
      setError('No se pudo copiar el contacto. Selecciona la nota y cópiala manualmente.');
    }
  }
  async function remove(id: string) {
    if (busy.current || !window.confirm('¿Retirar esta convocatoria?')) return;
    busy.current = true;
    setPending(id);
    setError('');
    try {
      await api('parties', { action: 'delete', id });
      if (onRemoved) onRemoved(id);
      else router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo retirar.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  const currentTime = Math.max(now, generatedAt);
  const visible = items.filter((item) => Date.parse(item.expires_at) > currentTime);
  return (
    <>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      {!visible.length ? (
        <div className="empty-state">
          No hay convocatorias activas con estos filtros. ¡Abre la próxima partida!
        </div>
      ) : null}
      <div className="party-grid">
        {visible.map((item) => (
          <article key={item.id} className="party-card party-lobby-card panel">
            <div className="party-lobby-header">
              <div className="party-lobby-status">
                <span className="news-pulse-dot" aria-hidden="true" /> LOBBY ABIERTO
              </div>
              <span className="muted">{remainingPartyTime(item.expires_at, currentTime)}</span>
              <div className="tags">
                <span className="tag">[{item.platform}]</span>
                <span className="tag">[{PARTY_STYLE_LABELS[item.playstyle]}]</span>
              </div>
            </div>
            <div className="party-game party-lobby-body">
              <Link href={`/games/${item.game.slug}`} className="party-cover party-lobby-cover">
                {item.game.cover_url ? (
                  <Image src={item.game.cover_url} alt={item.game.title} fill sizes="80px" />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}
              </Link>
              <div>
                <h2>
                  <Link href={`/games/${item.game.slug}`}>{item.game.title}</Link>
                </h2>
                <p>
                  <strong>Disponible:</strong> {item.schedule}
                </p>
                <p className="party-note">{item.contact_note}</p>
              </div>
            </div>
            <div className="party-lobby-host">
              <Link
                className="party-author text-link"
                href={`/players/${encodeURIComponent(item.author.username)}`}
              >
                {item.author.avatar_url ? (
                  <Image src={item.author.avatar_url} alt="" width={32} height={32} unoptimized />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}{' '}
                @{item.author.username}
                {typeof item.author.level === 'number' ? (
                  <span
                    className={`friend-level-circle friend-level-${friendLevelTier(item.author.level)}`}
                    aria-label={`Nivel ${item.author.level}`}
                  >
                    {item.author.level}
                  </span>
                ) : null}
              </Link>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => void copyContact(item)}
                >
                  {copiedId === item.id ? '¡Contacto copiado!' : '📋 Copiar contacto'}
                </button>
                {viewerId === item.user_id ? (
                  <button
                    className="button secondary small"
                    disabled={pending !== null}
                    onClick={() => void remove(item.id)}
                  >
                    {pending === item.id ? 'Retirando…' : '✕ Retirar'}
                  </button>
                ) : null}
              </div>
            </div>
            {copiedId === item.id ? (
              <span className="sr-only" role="status">
                Contacto copiado al portapapeles
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
