'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import {
  Eye,
  Bookmark,
  Check,
  Star,
  StarHalf,
  ExternalLink,
  Gamepad2,
  X,
  Play,
  Share2,
  Bell,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/client-api';
import { screenChatCheckpoint } from '@/domain/screen-chat';
import { ScreenTrailerModal } from './screen-trailer-modal';
import { screenAdaptation } from '@/domain/game-adaptations';
import { ScreenDrawerShell } from './screen-drawer-shell';
import {
  screenEpisodeKey,
  screenSeasonProgress,
  type ScreenDetail,
  type ScreenUserProgress,
} from '@/domain/screen';
const statuses = [
  { status: 'watching', label: 'Viendo', detail: '(ACTIVO)', Icon: Eye },
  { status: 'plan_to_watch', label: 'Por ver', detail: '(Backlog)', Icon: Bookmark },
  { status: 'completed', label: 'Completada', detail: '', Icon: Check },
  { status: 'dropped', label: 'Abandonada', detail: '', Icon: X },
] as const;
export function ScreenTelemetryDrawer({
  detail,
  progress,
  busy,
  canEdit,
  onSave,
  onSeason,
  onToggle,
  onNotes,
  onClose,
  openMobile,
}: {
  detail: ScreenDetail;
  progress: ScreenUserProgress;
  busy: boolean;
  canEdit: boolean;
  onSave: (patch: Partial<ScreenUserProgress>) => void;
  onSeason: (season: number) => void;
  onToggle: (key: number) => void;
  onNotes: (notes: string) => void;
  onClose: () => void;
  openMobile: boolean;
}) {
  const adaptation = screenAdaptation(detail.tmdbId, detail.mediaType);
  const season = screenSeasonProgress(detail, progress);
  const primary =
    detail.providers.find((provider) => provider.offer === 'subscription') ?? detail.providers[0];
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(Boolean(progress.notes));
  const notesId = useId();
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const [shareFeedback, setShareFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  async function handleShareToChat() {
    if (sharingRef.current || busy || !canEdit) return;
    sharingRef.current = true;
    setSharing(true);
    setShareFeedback(null);
    try {
      await api('discord/messages', {
        channel: 'web-chat',
        ...screenChatCheckpoint(detail, progress),
      });
      setShareFeedback({ ok: true, message: '¡Compartido en el Chat Global!' });
    } catch (error) {
      setShareFeedback({
        ok: false,
        message:
          error instanceof Error ? error.message : 'No se pudo compartir. Inténtalo de nuevo.',
      });
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }
  return (
    <ScreenDrawerShell title={detail.title} openMobile={openMobile} onClose={onClose}>
      <div className="screen-drawer-heading">
        <span className="screen-drawer-eyebrow">// TELEMETRÍA DETALLADA</span>
        <div className="screen-drawer-heading-actions">
          <span className="screen-drawer-live-hud">[ LIVE HUD ]</span>
          <button
            className="screen-drawer-close"
            type="button"
            aria-label="Cerrar ficha Screen"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {detail.backdropUrl && (
        <div className="screen-drawer-art">
          <Image src={detail.backdropUrl} alt="" width={600} height={338} unoptimized />
        </div>
      )}
      <h2>{detail.title}</h2>
      {adaptation?.developerOrPublisher && (
        <p className="screen-drawer-studio">{adaptation.developerOrPublisher}</p>
      )}
      <div className="screen-drawer-pills">
        <span className="screen-drawer-pill">
          {detail.mediaType === 'tv' ? `${detail.totalEpisodes} Episodios` : 'Película'}
        </span>
        <span className="screen-drawer-pill">
          {detail.runtimeMinutes
            ? `${detail.runtimeMinutes} min${detail.mediaType === 'tv' ? '/ep' : ''}`
            : 'Duración por confirmar'}
        </span>
        <span className="screen-drawer-pill">{detail.releaseYear ?? 'Año por confirmar'}</span>
        <span className="screen-drawer-pill accent">Audio y doblaje: consultar plataforma</span>
      </div>
      <div className="screen-drawer-quick-actions">
        <button
          type="button"
          className={`button ${progress.followed ? '' : 'outline'} small`}
          disabled={busy || !canEdit}
          aria-pressed={progress.followed === true}
          onClick={() => onSave({ followed: !progress.followed })}
        >
          {progress.followed ? <Check size={14} /> : <Bell size={14} />}
          {progress.followed ? 'Siguiendo en Radar' : 'Seguir en Radar'}
        </button>
        {detail.trailerVideoId && (
          <button
            type="button"
            className="button outline small"
            onClick={() => setTrailerOpen(true)}
          >
            <Play size={14} /> Ver Tráiler
          </button>
        )}
      </div>
      <p className="screen-synopsis">{detail.overview || 'Sin sinopsis disponible.'}</p>
      <p className="screen-drawer-source muted">
        {detail.source === 'demo'
          ? 'DEMO // ficha de ejemplo'
          : `TMDB · ${detail.voteCount.toLocaleString('es-CL')} votos`}
      </p>
      {!canEdit && (
        <p className="notice">
          <Link href="/login?next=/screen">Conecta tu cuenta</Link> para guardar tu bitácora.
        </p>
      )}
      <fieldset disabled={busy || !canEdit} className="screen-drawer-status-section">
        <legend>ESTADO EN TU BITÁCORA:</legend>
        <div className="screen-status-grid-2x2">
          {statuses.map(({ status, label, detail: caption, Icon }) => (
            <button
              type="button"
              key={status}
              className={`screen-status-btn${progress.status === status ? ' active' : ''}`}
              aria-pressed={progress.status === status}
              onClick={() =>
                onSave({
                  status,
                  currentEpisode:
                    detail.mediaType === 'movie' && status === 'completed'
                      ? 1
                      : progress.currentEpisode,
                })
              }
            >
              <Icon size={15} />
              <span>
                {label} {caption && <small>{caption}</small>}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <section className="screen-drawer-rating-section" aria-labelledby={`${notesId}-rating`}>
        <h3 id={`${notesId}-rating`}>TU CALIFICACIÓN PERSONAL</h3>
        <div className="screen-drawer-rating-row">
          <div className="screen-stars" role="group" aria-label="Calificación personal">
            {[2, 4, 6, 8, 10].map((rating) => {
              const filled = progress.rating !== null && progress.rating >= rating;
              const partial =
                progress.rating !== null &&
                progress.rating > rating - 2 &&
                progress.rating < rating;
              return (
                <button
                  type="button"
                  key={rating}
                  className={filled || partial ? 'active' : ''}
                  disabled={busy || !canEdit}
                  aria-label={`Calificar ${rating} de 10`}
                  aria-pressed={filled}
                  onClick={() => onSave({ rating })}
                >
                  {partial ? <StarHalf size={21} /> : <Star size={21} />}
                </button>
              );
            })}
          </div>
          <span className="screen-drawer-rating-value">
            {progress.rating !== null ? (progress.rating / 2).toFixed(1) : '—'} / 5.0
          </span>
          <button
            className="screen-drawer-notes-toggle"
            type="button"
            aria-label="Mostrar u ocultar notas privadas"
            title="Notas privadas"
            aria-expanded={notesOpen}
            aria-controls={notesId}
            onClick={() => setNotesOpen((open) => !open)}
          >
            <FileText size={17} />
          </button>
        </div>
        <button
          type="button"
          className="screen-drawer-clear-rating"
          disabled={busy || !canEdit || progress.rating === null}
          onClick={() => onSave({ rating: null })}
        >
          Quitar nota
        </button>
      </section>
      {notesOpen && (
        <section className="screen-drawer-notes" id={notesId}>
          <label>
            Notas privadas
            <textarea
              value={progress.notes}
              maxLength={2000}
              rows={3}
              disabled={busy || !canEdit}
              onChange={(event) => onNotes(event.target.value)}
            />
          </label>
          <button
            className="button outline small"
            type="button"
            disabled={busy || !canEdit}
            onClick={() => onSave({})}
          >
            {busy ? 'Guardando…' : 'Guardar notas'}
          </button>
        </section>
      )}
      {detail.mediaType === 'tv' && (
        <section className="screen-drawer-checklist-section" aria-label="Checklist de episodios">
          <div className="screen-drawer-checklist-header">
            <h3>
              <FileText size={13} /> CHECKLIST // TEMPORADA {progress.currentSeason}
            </h3>
            <strong>
              {season.watched} / {season.total} VISTOS
            </strong>
          </div>
          {detail.seasons.length > 1 && (
            <label className="screen-drawer-season-label">
              Temporada
              <select
                value={progress.currentSeason}
                disabled={busy}
                onChange={(event) => onSeason(Number(event.target.value))}
              >
                {detail.seasons.map((season) => (
                  <option key={season.number} value={season.number}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <progress
            max={100}
            value={season.percent}
            aria-label="Episodios vistos en esta temporada"
          />
          <div className="screen-episode-list">
            {detail.episodes.map((episode) => {
              const key = screenEpisodeKey(episode.seasonNumber, episode.episodeNumber),
                watched = progress.watchedEpisodes.includes(key);
              return (
                <label
                  key={key}
                  aria-label={`Episodio ${episode.episodeNumber}: ${episode.title}`}
                  className={`screen-drawer-episode-item${watched ? ' watched' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={watched}
                    disabled={busy || !canEdit}
                    onChange={() => onToggle(key)}
                  />
                  <span className="screen-drawer-episode-copy">
                    <strong>
                      Ep {String(episode.episodeNumber).padStart(2, '0')} · {episode.title}
                    </strong>
                    {!watched && <small>{episode.airDate ?? 'Fecha por confirmar'}</small>}
                  </span>
                  {watched && <span className="screen-drawer-visto-badge">VISTO</span>}
                </label>
              );
            })}
            {!detail.episodes.length && (
              <p className="muted">No hay episodios disponibles para esta temporada.</p>
            )}
          </div>
        </section>
      )}
      <section className="screen-drawer-where-section">
        <div className="screen-drawer-section-heading">
          <h3>DÓNDE VER HOY:</h3>
          <small>Powered by JustWatch</small>
        </div>
        {primary ? (
          <>
            <a
              className="screen-drawer-where-card"
              href={primary.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {primary.logoUrl ? (
                <Image src={primary.logoUrl} alt="" width={36} height={36} unoptimized />
              ) : (
                <span className="screen-drawer-provider-symbol" aria-hidden="true">
                  <Play size={18} />
                </span>
              )}
              <span>
                <strong>{primary.name}</strong>
                <small>
                  {primary.offer === 'subscription'
                    ? 'Suscripción'
                    : primary.offer === 'rent'
                      ? 'Alquiler'
                      : 'Compra'}{' '}
                  · Ver disponibilidad
                </small>
                <small>Calidad, subtítulos y doblaje: consultar</small>
              </span>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
            {detail.providers.length > 1 && (
              <details className="screen-drawer-provider-options">
                <summary>Más opciones de streaming, alquiler y compra</summary>
                <div className="screen-providers-chips">
                  {detail.providers
                    .filter((provider) => provider !== primary)
                    .map((provider) => (
                      <a
                        key={`${provider.id}-${provider.offer}`}
                        className="screen-provider-chip"
                        href={provider.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {provider.logoUrl && (
                          <Image src={provider.logoUrl} alt="" width={22} height={22} unoptimized />
                        )}{' '}
                        {provider.name} ·{' '}
                        {provider.offer === 'subscription'
                          ? 'Suscripción'
                          : provider.offer === 'rent'
                            ? 'Alquiler'
                            : 'Compra'}{' '}
                        <ExternalLink size={12} />
                      </a>
                    ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="muted">
            {detail.source === 'demo'
              ? 'Configura TMDB para consultar proveedores reales.'
              : 'Sin disponibilidad informada en esta región.'}
          </p>
        )}
      </section>
      {!!detail.credits.length && (
        <details className="screen-drawer-cast">
          <summary>Reparto</summary>
          {detail.credits.map((actor) => (
            <p key={`${actor.name}-${actor.character}`}>
              {actor.name} <span className="muted">{actor.character}</span>
            </p>
          ))}
        </details>
      )}
      {adaptation && (
        <section className="screen-drawer-game-section screen-drawer-game-card">
          <h4>
            <Gamepad2 size={14} /> IP ORIGINAL // {adaptation.gameTitle.toUpperCase()}
          </h4>
          <p>
            Explora la ficha del videojuego original, sus reseñas y la colección de la comunidad en
            SaveState.
          </p>
          <Link
            className="button outline small screen-game-link"
            href={`/games/${adaptation.gameSlug}`}
          >
            Ir a ficha de juego de {adaptation.gameTitle} →
          </Link>
        </section>
      )}
      {canEdit && (
        <section className="screen-share-section" aria-label="Compartir checkpoint">
          <p className="muted">
            Comparte tu avance y calificación. Tus notas siguen siendo privadas.
          </p>
          <button
            type="button"
            className="button outline screen-share-button"
            disabled={busy || sharing}
            aria-busy={sharing}
            onClick={() => void handleShareToChat()}
          >
            <Share2 size={15} /> {sharing ? 'Compartiendo…' : 'Compartir en Chat Global'}
          </button>
          <div role="status" aria-live="polite">
            {shareFeedback && (
              <p className={`screen-share-feedback ${shareFeedback.ok ? 'success' : 'error'}`}>
                {shareFeedback.message}{' '}
                {shareFeedback.ok && (
                  <Link className="screen-chat-link" href="/chat">
                    Ir al chat →
                  </Link>
                )}
              </p>
            )}
          </div>
        </section>
      )}
      <footer className="screen-drawer-footer-hud">
        <span className={canEdit ? 'screen-drawer-cloud-ready' : ''}>
          <span aria-hidden="true">●</span> SYNC:{' '}
          {busy ? 'GUARDANDO…' : canEdit ? 'LISTO PARA GUARDAR' : 'INICIA SESIÓN'}
        </span>
        <span>LATENCY: — // CORE-04</span>
      </footer>
      {trailerOpen && detail.trailerVideoId && (
        <ScreenTrailerModal
          videoId={detail.trailerVideoId}
          title={detail.title}
          onClose={() => setTrailerOpen(false)}
        />
      )}
    </ScreenDrawerShell>
  );
}
