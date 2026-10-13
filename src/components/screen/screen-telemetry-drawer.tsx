'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Star, ExternalLink, Gamepad2, X } from 'lucide-react';
import { screenAdaptation } from '@/domain/game-adaptations';
import { ScreenDrawerShell } from './screen-drawer-shell';
import {
  screenEpisodeKey,
  screenPercent,
  type ScreenDetail,
  type ScreenUserProgress,
  type ScreenUserStatus,
} from '@/domain/screen';
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
  return (
    <ScreenDrawerShell title={detail.title} openMobile={openMobile} onClose={onClose}>
      <div className="screen-drawer-heading">
        <span className="eyebrow">TELEMETRÍA // {detail.mediaType.toUpperCase()}</span>
        <button
          className="button outline small"
          type="button"
          aria-label="Cerrar ficha Screen"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      {detail.backdropUrl && (
        <div className="screen-drawer-art">
          <Image src={detail.backdropUrl} alt="" width={600} height={250} unoptimized />
        </div>
      )}
      <h2>{detail.title}</h2>
      <p className="screen-synopsis">{detail.overview || 'Sin sinopsis disponible.'}</p>
      <p className="muted">
        {detail.source === 'demo'
          ? 'DEMO // ficha de ejemplo'
          : `TMDB · ${detail.voteCount.toLocaleString('es-CL')} votos`}
      </p>
      {!canEdit && (
        <p className="notice">
          <Link href="/login?next=/screen">Conecta tu cuenta</Link> para guardar tu bitácora.
        </p>
      )}
      <fieldset disabled={busy || !canEdit}>
        <legend>Estado del checkpoint</legend>
        <div className="screen-status-grid">
          {(
            [
              ['watching', 'Viendo'],
              ['plan_to_watch', 'Por ver'],
              ['completed', 'Completada'],
              ['dropped', 'Abandonada'],
            ] as [ScreenUserStatus, string][]
          ).map(([status, label]) => (
            <button
              type="button"
              key={status}
              className={`button ${progress.status === status ? '' : 'outline'} small`}
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
              {label}
            </button>
          ))}
        </div>
        <p>Tu calificación {progress.rating === null ? '—' : `${progress.rating}/10`}</p>
        <div className="screen-stars">
          {[2, 4, 6, 8, 10].map((rating) => (
            <button
              type="button"
              key={rating}
              className={progress.rating !== null && progress.rating >= rating ? 'active' : ''}
              aria-label={`Calificar ${rating} de 10`}
              aria-pressed={progress.rating !== null && progress.rating >= rating}
              onClick={() => onSave({ rating })}
            >
              <Star size={20} />
            </button>
          ))}
          <button
            type="button"
            className="button outline small"
            onClick={() => onSave({ rating: null })}
          >
            Quitar nota
          </button>
        </div>
      </fieldset>
      {detail.mediaType === 'tv' && (
        <>
          <label>
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
          <p>
            {progress.watchedEpisodes.length} / {detail.totalEpisodes} episodios ·{' '}
            {screenPercent(progress)}%
          </p>
          <progress max={100} value={screenPercent(progress)} aria-label="Episodios vistos" />
          <div className="screen-episode-list">
            {detail.episodes.map((episode) => {
              const key = screenEpisodeKey(episode.seasonNumber, episode.episodeNumber),
                watched = progress.watchedEpisodes.includes(key);
              return (
                <label
                  key={key}
                  aria-label={`Episodio ${episode.episodeNumber}: ${episode.title}`}
                  className={watched ? 'screen-episode watched' : 'screen-episode'}
                >
                  <input
                    type="checkbox"
                    checked={watched}
                    disabled={busy || !canEdit}
                    onChange={() => onToggle(key)}
                  />
                  <span>
                    <strong>
                      Ep {String(episode.episodeNumber).padStart(2, '0')} · {episode.title}
                    </strong>
                    <small>
                      {watched ? (
                        <>
                          <Check size={12} /> VISTO
                        </>
                      ) : (
                        (episode.airDate ?? 'Fecha por confirmar')
                      )}
                    </small>
                  </span>
                </label>
              );
            })}
            {!detail.episodes.length && (
              <p className="muted">No hay episodios disponibles para esta temporada.</p>
            )}
          </div>
        </>
      )}
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
      <section className="screen-where">
        <h3>Dónde ver hoy</h3>
        <p className="muted">
          Disponibilidad de JustWatch vía TMDB · comprueba precios y catálogo antes de contratar.
        </p>
        {detail.providers.length ? (
          detail.providers.map((provider) => (
            <a
              key={`${provider.id}-${provider.offer}`}
              className="screen-provider-link"
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {provider.logoUrl && (
                <Image src={provider.logoUrl} alt="" width={24} height={24} unoptimized />
              )}
              {provider.name}
              <small>
                {provider.offer === 'subscription'
                  ? 'Suscripción'
                  : provider.offer === 'rent'
                    ? 'Alquiler'
                    : 'Compra'}
              </small>
              <ExternalLink size={12} />
            </a>
          ))
        ) : (
          <p className="muted">
            {detail.source === 'demo'
              ? 'Configura TMDB para consultar proveedores reales.'
              : 'Sin disponibilidad informada en esta región.'}
          </p>
        )}
      </section>
      {!!detail.credits.length && (
        <details>
          <summary>Reparto</summary>
          {detail.credits.map((actor) => (
            <p key={`${actor.name}-${actor.character}`}>
              {actor.name} <span className="muted">{actor.character}</span>
            </p>
          ))}
        </details>
      )}
      {adaptation && (
        <Link className="button outline screen-game-link" href={`/games/${adaptation.gameSlug}`}>
          <Gamepad2 size={15} /> {adaptation.gameTitle} ↗
        </Link>
      )}
    </ScreenDrawerShell>
  );
}
