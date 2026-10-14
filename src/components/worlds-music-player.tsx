'use client';
import Image from 'next/image';
import { useId, useState } from 'react';
import {
  WORLDS_ANTHEMS,
  KDA_TRACKS,
  ALL_WORLDS_TRACKS,
  worldsMusicUrl,
  trackThumbnailUrl,
  nextTrackIndex,
  prevTrackIndex,
} from '@/domain/worlds-features';

function Equalizer({ active }: { active: boolean }) {
  return (
    <span className={`worlds-equalizer${active ? ' is-playing' : ''}`} aria-hidden="true">
      {[0, 1, 2, 3].map((bar) => (
        <span className="worlds-eq-bar" key={bar} />
      ))}
    </span>
  );
}

export function WorldsMusicPlayer() {
  const [selected, setSelected] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'video'>('art');
  const [activeTab, setActiveTab] = useState<'all' | 'anthems' | 'kda'>('all');
  const [showInfo, setShowInfo] = useState(false);
  const [origin, setOrigin] = useState('');
  const controlsId = useId();

  const isKda = selected >= WORLDS_ANTHEMS.length;
  const track = ALL_WORLDS_TRACKS[selected]!;

  function togglePlayback() {
    setOrigin(window.location.origin);
    setIsPlaying((value) => !value);
  }

  function handleSelectTrack(index: number) {
    setSelected(index);
    if (
      (activeTab === 'kda' && index < WORLDS_ANTHEMS.length) ||
      (activeTab === 'anthems' && index >= WORLDS_ANTHEMS.length)
    )
      setActiveTab('all');
    setOrigin(window.location.origin);
    setIsPlaying(true);
  }

  function handlePrev() {
    handleSelectTrack(prevTrackIndex(selected, ALL_WORLDS_TRACKS.length));
  }
  function handleNext() {
    handleSelectTrack(nextTrackIndex(selected, ALL_WORLDS_TRACKS.length));
  }

  return (
    <aside
      className={`worlds-music-hud ${isKda ? 'theme-kda' : 'theme-worlds'}${
        minimized ? ' is-minimized' : ''
      }`}
      aria-label="Reproductor de música de Worlds y K/DA"
    >
      {minimized ? (
        <div className="worlds-minibar">
          <Image
            width={320}
            height={180}
            unoptimized
            src={trackThumbnailUrl(track.id)}
            alt=""
            className={`worlds-mini-thumb${isPlaying ? ' is-spinning' : ''}`}
          />
          <div className="worlds-minibar-meta">
            <strong className="worlds-minibar-title">{track.title}</strong>
            <span className="worlds-minibar-artist">{track.artist}</span>
          </div>
          <Equalizer active={isPlaying} />
          <div className="worlds-minibar-controls">
            <button
              type="button"
              className="button outline small"
              onClick={handlePrev}
              title="Pista anterior"
              aria-label="Pista anterior"
            >
              ⏮
            </button>
            <button
              type="button"
              className="button primary small"
              onClick={togglePlayback}
              title={isPlaying ? 'Pausar' : 'Reproducir'}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              className="button outline small"
              onClick={handleNext}
              title="Siguiente pista"
              aria-label="Siguiente pista"
            >
              ⏭
            </button>
            <button
              type="button"
              className="button outline small"
              onClick={() => setMinimized(false)}
              title="Expandir reproductor"
              aria-label="Expandir reproductor"
            >
              ▴
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="worlds-music-heading">
            <div className="worlds-music-branding">
              <strong>🎵 {isKda ? 'K/DA UNIVERSE' : 'WORLDS SOUNDTRACK'}</strong>
              <span className="worlds-track-badge">
                {isKda ? 'Riot Music' : 'Himno Oficial'} · {track.year}
              </span>
            </div>
            <button
              type="button"
              className="button outline small"
              aria-expanded={!minimized}
              aria-controls={controlsId}
              onClick={() => setMinimized(true)}
            >
              ▾ Minimizar
            </button>
          </div>

          <div id={controlsId} className="worlds-music-controls">
            <div className="worlds-music-tabs">
              <button
                type="button"
                className={`worlds-tab-pill${activeTab === 'all' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                Todos (17)
              </button>
              <button
                type="button"
                className={`worlds-tab-pill${activeTab === 'anthems' ? ' is-active' : ''}`}
                onClick={() => {
                  if (isKda) handleSelectTrack(0);
                  setActiveTab('anthems');
                }}
              >
                🏆 Worlds ({WORLDS_ANTHEMS.length})
              </button>
              <button
                type="button"
                className={`worlds-tab-pill${activeTab === 'kda' ? ' is-active' : ''}`}
                onClick={() => {
                  if (!isKda) handleSelectTrack(WORLDS_ANTHEMS.length);
                  setActiveTab('kda');
                }}
              >
                👑 K/DA ({KDA_TRACKS.length})
              </button>
            </div>

            <select
              value={selected}
              className="worlds-music-select"
              aria-label="Pista oficial"
              onChange={(event) => handleSelectTrack(Number(event.target.value))}
            >
              {(activeTab === 'all' || activeTab === 'anthems') && (
                <optgroup label="🏆 Himnos Oficiales de Worlds">
                  {WORLDS_ANTHEMS.map((song, index) => (
                    <option key={song.id} value={index}>
                      {song.year} · {song.title} — {song.artist}
                    </option>
                  ))}
                </optgroup>
              )}
              {(activeTab === 'all' || activeTab === 'kda') && (
                <optgroup label="👑 K/DA Universe (Riot Games)">
                  {KDA_TRACKS.map((song, index) => (
                    <option key={song.id} value={WORLDS_ANTHEMS.length + index}>
                      {song.year} · {song.title} — {song.artist}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <div className="worlds-music-visual-wrap">
              {viewMode === 'art' ? (
                <div className="worlds-music-art-card">
                  <Image
                    width={320}
                    height={180}
                    unoptimized
                    src={trackThumbnailUrl(track.id)}
                    alt={`${track.title} cover`}
                    className="worlds-music-art-img"
                  />
                  <div className="worlds-music-art-overlay">
                    <div
                      className={`worlds-vinyl-disc${isPlaying ? ' is-spinning' : ''}`}
                      aria-hidden="true"
                    >
                      <div className="worlds-vinyl-center" />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="worlds-mode-toggle"
                    onClick={() => setViewMode('video')}
                    title="Ver video musical de YouTube"
                  >
                    🎬 Ver Video
                  </button>
                </div>
              ) : (
                <div className="worlds-video-preview-wrap">
                  <button
                    type="button"
                    className="worlds-mode-toggle"
                    onClick={() => setViewMode('art')}
                    title="Volver a modo carátula"
                  >
                    🎵 Modo Carátula
                  </button>
                </div>
              )}
            </div>

            <div className="worlds-music-info-row">
              <div className="worlds-music-title-wrap">
                <span className="worlds-song-title">{track.title}</span>
                <span className="worlds-song-artist">{track.artist}</span>
              </div>
              <Equalizer active={isPlaying} />
            </div>

            <div className="worlds-music-transport">
              <button
                type="button"
                className="button outline small"
                onClick={handlePrev}
                title="Pista anterior"
                aria-label="Pista anterior"
              >
                ⏮
              </button>
              <button
                type="button"
                className="button primary small worlds-play-btn"
                aria-pressed={isPlaying}
                onClick={togglePlayback}
              >
                {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
              </button>
              <button
                type="button"
                className="button outline small"
                onClick={handleNext}
                title="Siguiente pista"
                aria-label="Siguiente pista"
              >
                ⏭
              </button>
            </div>
          </div>
        </>
      )}

      <div
        className={
          minimized || viewMode === 'art'
            ? 'worlds-music-stream-hidden'
            : 'worlds-music-stream-visible'
        }
        aria-hidden={minimized || viewMode === 'art'}
        inert={minimized || viewMode === 'art'}
      >
        {isPlaying && (
          <iframe
            key={track.id}
            className="worlds-music-frame"
            src={worldsMusicUrl(track.id, origin)}
            title={`${track.year} · ${track.title} — ${track.artist}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}
      </div>

      {!minimized && (
        <div className="worlds-music-footer">
          <a
            className="button outline small worlds-yt-link"
            href={`https://www.youtube.com/watch?v=${track.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Abrir en YouTube
          </a>
          <button
            type="button"
            className="button outline small worlds-info-btn"
            onClick={() => setShowInfo((val) => !val)}
            title="Información de reproducción"
            aria-label="Información de reproducción"
            aria-expanded={showInfo}
            aria-controls={`${controlsId}-info`}
          >
            ℹ
          </button>
        </div>
      )}

      {!minimized && showInfo && (
        <div id={`${controlsId}-info`} className="worlds-music-infobox">
          <small>
            🎵 <strong>Audio continuo</strong>: Al minimizar o cambiar de vista, el audio continúa
            mientras permaneces en /worlds. Pausar detiene el video; al reanudar comienza de nuevo.
          </small>
          <small>
            🛡 <strong>Restricción regional</strong>: Si algún sello (ej. LatinAutor/UMPG en LATAM)
            restringe la reproducción embebida en tu navegador, usa el botón directo a YouTube.
          </small>
        </div>
      )}
    </aside>
  );
}
