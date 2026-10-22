'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AUDIO_FILTER_CONFIGS,
  RADIO_STATIONS,
  radioAllowedAtPath,
  radioTime,
  readRadioPreferences,
  writeRadioPreferences,
  type AudioFilterPreset,
  type RadioStationId,
} from '@/domain/retro-audio';
import { INITIAL_RADIO_SNAPSHOT, RetroAudioEngine } from '@/lib/retro-audio/audio-engine';
import { AUDIO_FOCUS_EVENT } from '@/lib/retro-audio/audio-focus';
import { CassetteSlot } from './cassette-slot';
import { EqualizerVisualizer } from './equalizer-visualizer';

export function RetroRadioDeck() {
  const [state, setState] = useState(INITIAL_RADIO_SNAPSHOT);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const engine = useRef<RetroAudioEngine | null>(null);
  const panel = useRef<HTMLElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const id = useId();
  const pathname = usePathname() ?? '';
  const allowed = radioAllowedAtPath(pathname);
  useEffect(() => {
    let preferences;
    try {
      preferences = readRadioPreferences(window.localStorage);
    } catch {
      preferences = readRadioPreferences();
    }
    const controller = new RetroAudioEngine(preferences);
    engine.current = controller;
    const sync = () => {
      setState(controller.snapshot);
      setAnalyser(controller.analyser);
    };
    const unsubscribe = controller.subscribe(sync);
    sync();
    const focus = (event: Event) => {
      if ((event as CustomEvent<unknown>).detail === 'worlds-music') controller.pause();
    };
    window.addEventListener(AUDIO_FOCUS_EVENT, focus);
    const mobileFocus = (event: FocusEvent) => {
      const target = event.target;
      if (
        window.matchMedia('(max-width: 600px)').matches &&
        target instanceof HTMLElement &&
        !panel.current?.contains(target) &&
        (target.matches('input,textarea') || target.isContentEditable)
      )
        controller.setMinimized(true);
    };
    document.addEventListener('focusin', mobileFocus);
    return () => {
      document.removeEventListener('focusin', mobileFocus);
      window.removeEventListener(AUDIO_FOCUS_EVENT, focus);
      unsubscribe();
      controller.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    // Do not overwrite restored preferences with the server's initial defaults.
    if (!engine.current) return;
    try {
      writeRadioPreferences(window.localStorage, engine.current.snapshot);
    } catch {
      /* Storage access is optional. */
    }
  }, [state.isMinimized, state.volume, state.activeFilter, state.rainFxEnabled]);
  useEffect(() => {
    if (!allowed) engine.current?.pause();
  }, [allowed]);
  useEffect(() => {
    const update = () => {
      if (clock.current) clock.current.textContent = radioTime(engine.current?.position ?? 0);
    };
    update();
    if (!allowed || !state.isPlaying) return;
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [allowed, state.isPlaying, state.activeStationId, state.userTrack]);
  useEffect(() => {
    if (!allowed || !panel.current) return;
    const update = () =>
      document.documentElement.style.setProperty(
        '--retro-radio-height',
        panel.current!.getBoundingClientRect().height + 'px',
      );
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(panel.current);
    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty('--retro-radio-height');
    };
  }, [allowed]);
  const toggle = () => {
    const controller = engine.current;
    if (!controller) return;
    if (controller.snapshot.isPlaying || controller.snapshot.pending) controller.pause();
    else void controller.play();
  };
  if (!allowed) return null;
  const station = RADIO_STATIONS.find((item) => item.id === state.activeStationId);
  const title =
    state.activeStationId === 'user_cassette'
      ? (state.userTrack?.name ?? 'Sin casete')
      : (station?.name ?? 'SaveState Radio');
  return (
    <aside
      ref={panel}
      className={'retro-radio-deck' + (state.isMinimized ? ' is-minimized' : '')}
      aria-label="SaveState Retro Radio"
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (
          event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          event.repeat ||
          target.isContentEditable ||
          target.closest('input,select,textarea')
        )
          return;
        if (event.key.toLowerCase() === 'm') {
          event.preventDefault();
          engine.current?.toggleMute();
        }
      }}
    >
      <div className="radio-deck-header">
        <button
          type="button"
          className="radio-expand"
          aria-expanded={!state.isMinimized}
          aria-controls={id}
          onClick={() => engine.current?.setMinimized(!state.isMinimized)}
          aria-label={state.isMinimized ? 'Expandir Retro Radio' : 'Minimizar Retro Radio'}
        >
          <span aria-hidden="true">📼</span>
          <span>{state.isMinimized ? title : 'SAVESTATE // RADIO DECK'}</span>
          <span aria-hidden="true">{state.isMinimized ? '▴' : '▾'}</span>
        </button>
        <EqualizerVisualizer analyser={analyser} active={state.isPlaying && !state.isMuted} />
        <button
          type="button"
          className="button outline small radio-quick-play"
          aria-label={state.isPlaying || state.pending ? 'Pausar radio' : 'Reproducir radio'}
          aria-pressed={state.isPlaying}
          aria-keyshortcuts="Space"
          onClick={toggle}
        >
          {state.pending ? '⏳' : state.isPlaying ? '⏸' : '▶'}
        </button>
      </div>
      <div id={id} className="radio-deck-controls" hidden={state.isMinimized}>
        <div className="radio-lcd">
          <strong>
            {state.activeStationId === 'user_cassette' ? 'CASSETTE' : 'RADIO'} // {title}
          </strong>
          <span>
            {(state.sampleRate / 1000).toFixed(1)} kHz ·{' '}
            <span ref={clock} aria-label="Tiempo reproducido">
              00:00
            </span>{' '}
            · {AUDIO_FILTER_CONFIGS[state.activeFilter].label}
          </span>
        </div>
        <div className={'radio-tape' + (state.isPlaying ? ' is-playing' : '')} aria-hidden="true">
          <i className="radio-spool" />
          <span>SIDE A // PLAYER SOUNDTRACK</span>
          <i className="radio-spool" />
        </div>
        <label className="radio-station-label">
          Frecuencia
          <select
            value={state.activeStationId}
            onChange={(event) => {
              const controller = engine.current;
              if (controller) {
                controller.setStation(event.target.value as RadioStationId);
                void controller.play();
              }
            }}
          >
            {RADIO_STATIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.genre}
              </option>
            ))}
            <option value="user_cassette" disabled={!state.userTrack}>
              📼 Tu casete local
            </option>
          </select>
        </label>
        <div className="radio-filter-switches" role="group" aria-label="Filtro de audio">
          {(
            Object.entries(AUDIO_FILTER_CONFIGS) as [
              AudioFilterPreset,
              typeof AUDIO_FILTER_CONFIGS.hifi,
            ][]
          ).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className="button outline small"
              title={config.label}
              aria-pressed={state.activeFilter === key}
              onClick={() => engine.current?.setFilter(key)}
            >
              {key === 'hifi' ? 'HI-FI' : key === 'gameboy' ? 'GAME BOY' : 'TAPE'}
            </button>
          ))}
        </div>
        <div className="radio-mixer">
          <button
            type="button"
            className="button outline small"
            aria-label={state.isMuted ? 'Activar sonido' : 'Silenciar radio'}
            aria-pressed={state.isMuted}
            aria-keyshortcuts="M"
            onClick={() => engine.current?.toggleMute()}
          >
            {state.isMuted ? '🔇' : '🔊'}
          </button>
          <label>
            Volumen {Math.round(state.volume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={state.volume}
              onChange={(event) => engine.current?.setVolume(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="button outline small"
            aria-pressed={state.rainFxEnabled}
            onClick={() => engine.current?.setRain(!state.rainFxEnabled)}
          >
            🌧 Lluvia
          </button>
        </div>
        <CassetteSlot
          track={state.userTrack}
          onFile={(file) => {
            const controller = engine.current;
            if (controller?.loadCassette(file)) void controller.play();
          }}
          onEject={() => engine.current?.eject()}
        />
        <small className="muted">
          Espacio en Play/Pausa · M en el deck · Melodías generadas en tu dispositivo.
        </small>
      </div>
      <p className="radio-error" role="status" aria-live="polite">
        {state.error ?? ''}
      </p>
    </aside>
  );
}
