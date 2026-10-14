'use client';
import Image from 'next/image';
import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { screenCountdown, type ScreenFollowedMedia, type ScreenRegion } from '@/domain/screen';
import { api } from '@/lib/client-api';

function ScreenCountdown({ date }: { date: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time className="screen-watchlist-countdown" dateTime={date ?? undefined}>
      {now === null ? '—' : screenCountdown(date, now)}
    </time>
  );
}
function RadarCard({
  item,
  region,
  disabled,
  onSelect,
  onUnfollow,
}: {
  item: ScreenFollowedMedia;
  region: ScreenRegion;
  disabled: boolean;
  onSelect: () => void;
  onUnfollow: () => void;
}) {
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const provider =
    item.providers.find((value) => value.offer === 'subscription') ?? item.providers[0];
  async function announce() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setFeedback(null);
    try {
      const result = await api<{ published: boolean }>('screen/announce', {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        region,
      });
      setFeedback({
        ok: true,
        text: result.published
          ? '✓ Aviso enviado a #📢-anuncios-savestate'
          : '✓ Este estreno ya fue anunciado en Discord.',
      });
    } catch (error) {
      setFeedback({
        ok: false,
        text: error instanceof Error ? error.message : 'No se pudo enviar el aviso.',
      });
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }
  return (
    <article className="screen-watchlist-card">
      <button
        type="button"
        className="screen-watchlist-art"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`Abrir ficha de ${item.title}`}
      >
        {item.posterUrl || item.backdropUrl ? (
          <Image
            src={(item.posterUrl || item.backdropUrl)!}
            width={80}
            height={115}
            alt=""
            unoptimized
          />
        ) : (
          <span aria-hidden="true">🎬</span>
        )}
      </button>
      <div className="screen-watchlist-info">
        <button
          type="button"
          className="screen-watchlist-title"
          onClick={onSelect}
          disabled={disabled}
        >
          {item.title}
        </button>
        <p className="muted">{item.statusText}</p>
        {item.mediaType === 'tv' && (
          <>
            <p>
              Temporada {item.currentSeason} · Cap. {item.currentEpisodeWatched} visto
            </p>
            <p>
              Siguiente:{' '}
              {item.nextEpisodeNumber
                ? `T${item.nextSeasonNumber} · Cap. ${item.nextEpisodeNumber}${item.nextEpisodeTitle ? ` · ${item.nextEpisodeTitle}` : ''}`
                : 'Por anunciar'}
            </p>
          </>
        )}
        <p>
          {item.mediaType === 'movie' ? 'Estreno' : 'Fecha de salida'}:{' '}
          {item.nextAirDate
            ? new Date(item.nextAirDate + 'T00:00:00Z').toLocaleDateString('es-CL', {
                timeZone: 'UTC',
              })
            : 'Por anunciar'}
        </p>
      </div>
      <div className="screen-watchlist-provider">
        {provider ? (
          <a
            className="screen-provider-chip"
            href={provider.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {provider.logoUrl && (
              <Image src={provider.logoUrl} width={22} height={22} alt="" unoptimized />
            )}{' '}
            {provider.name}
          </a>
        ) : (
          <span className="muted">
            {item.mediaType === 'movie' ? 'CINES · Por confirmar' : 'Dónde ver: por confirmar'}
          </span>
        )}
      </div>
      <div className="screen-watchlist-actions">
        <ScreenCountdown date={item.nextAirDate} />
        <small className="muted">Referencia 00:00 UTC · hora no confirmada</small>
        <button
          type="button"
          className="button outline small screen-discord-bell-btn"
          disabled={disabled || sending || !item.nextAirDate || item.source === 'demo'}
          onClick={() => void announce()}
          aria-busy={sending}
        >
          <Bell size={14} /> {sending ? 'Enviando…' : 'Avisar a Discord'}
        </button>
        <button
          type="button"
          className="button outline small"
          disabled={disabled || sending}
          onClick={onUnfollow}
        >
          <X size={12} /> Dejar de seguir
        </button>
        <div role="status">
          {feedback && (
            <p className={`screen-share-feedback ${feedback.ok ? 'success' : 'error'}`}>
              {feedback.text}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
export function ScreenWatchlistRadar({
  items,
  region,
  busy,
  loading,
  error,
  onSelect,
  onUnfollow,
}: {
  items: ScreenFollowedMedia[];
  region: ScreenRegion;
  busy: boolean;
  loading: boolean;
  error: string;
  onSelect: (item: ScreenFollowedMedia) => void;
  onUnfollow: (item: ScreenFollowedMedia) => void;
}) {
  return (
    <section
      className="screen-watchlist-section"
      aria-labelledby="screen-watchlist-title"
      aria-busy={loading}
    >
      <header className="screen-watchlist-header">
        <h2 id="screen-watchlist-title">RADAR DE SEGUIMIENTO // PRÓXIMOS CAPÍTULOS Y ESTRENOS</h2>
        <span className="muted">{items.length} títulos</span>
      </header>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!items.length && (
        <p className="panel">
          {loading
            ? 'Cargando tu radar…'
            : 'Usa «Seguir en Radar» desde cualquier ficha para seguir sus próximos capítulos y estrenos.'}
        </p>
      )}
      <div className="screen-watchlist-list">
        {items.map((item) => (
          <RadarCard
            key={`${item.mediaType}:${item.tmdbId}:${region}`}
            item={item}
            region={region}
            disabled={busy}
            onSelect={() => onSelect(item)}
            onUnfollow={() => onUnfollow(item)}
          />
        ))}
      </div>
    </section>
  );
}
