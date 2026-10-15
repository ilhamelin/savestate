'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  getCountdownTo,
  RELEASE_COUNTDOWNS,
  pinnedReleaseCountdown,
  type ReleaseCountdownId,
} from '@/domain/gta6-countdown';
export function Gta6Countdown() {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinnedId, setPinnedId] = useState<ReleaseCountdownId | null>(null);
  const id = useId(),
    tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = RELEASE_COUNTDOWNS[activeIndex] ?? RELEASE_COUNTDOWNS[0]!;
  const countdown = nowMs !== null ? getCountdownTo(active.releaseDate, nowMs) : null;
  useEffect(() => {
    const initial = window.setTimeout(() => {
      try {
        const saved = pinnedReleaseCountdown(
          window.localStorage.getItem('savestate_pinned_countdown'),
        );
        if (saved) {
          setPinnedId(saved);
          setActiveIndex(RELEASE_COUNTDOWNS.findIndex((item) => item.id === saved));
        }
      } catch {
        /* Storage may be restricted. */
      }
    }, 0);
    return () => window.clearTimeout(initial);
  }, []);
  function togglePin(targetId: ReleaseCountdownId) {
    const next = pinnedId === targetId ? null : targetId;
    setPinnedId(next);
    try {
      if (next) window.localStorage.setItem('savestate_pinned_countdown', next);
      else window.localStorage.removeItem('savestate_pinned_countdown');
    } catch {
      /* The current selection still works without persistence. */
    }
  }
  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);
  function keydown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % RELEASE_COUNTDOWNS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + RELEASE_COUNTDOWNS.length) % RELEASE_COUNTDOWNS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? RELEASE_COUNTDOWNS.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      setActiveIndex(next);
      tabs.current[next]?.focus();
    }
  }
  return (
    <div className="countdown-showcase">
      <div className="countdown-selector-bar">
        <div className="countdown-tabs" role="tablist" aria-label="Selector de cuentas regresivas">
          {RELEASE_COUNTDOWNS.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              id={`${id}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls={`${id}-panel`}
              tabIndex={index === activeIndex ? 0 : -1}
              className={`countdown-tab ${index === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => keydown(event, index)}
            >
              <Image src={item.iconImage} alt="" width={20} height={20} unoptimized />
              <span className="countdown-tab-index">{item.tabNumber}</span>
              <span>{item.tabLabel}</span>
              {item.id === pinnedId && (
                <span
                  className="countdown-tab-pin-badge"
                  title="Fijado como principal"
                  aria-hidden="true"
                >
                  📌
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <section
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active.id}`}
        className={`gta6-countdown-banner ${active.themeClass}`}
        style={{ '--countdown-hero': `url("${active.heroImage}")` } as CSSProperties}
      >
        <button
          type="button"
          className={`countdown-pin-btn${pinnedId === active.id ? ' is-pinned' : ''}`}
          onClick={() => togglePin(active.id)}
          aria-pressed={pinnedId === active.id}
          title={
            pinnedId === active.id
              ? 'Contador fijado como principal (clic para desfijar)'
              : 'Fijar este contador como principal al ingresar a SaveState'
          }
        >
          <span aria-hidden="true">{pinnedId === active.id ? '📌' : '📍'}</span>
          <span>{pinnedId === active.id ? 'Fijado' : 'Fijar'}</span>
        </button>
        <p className="gta6-radar">
          <Image src={active.iconImage} alt="" width={40} height={40} unoptimized />
          {active.radarLabel}
        </p>
        <h2>
          <Image
            src={active.logoImage}
            alt={active.title}
            width={260}
            height={170}
            className="gta6-logo"
            unoptimized
          />
        </h2>
        <p>{active.releaseText}</p>
        <div className="gta6-platforms">
          {active.platforms.map((platform) => (
            <span className="platform-tag" key={platform.label}>
              <Image src={platform.icon} alt="" width={18} height={18} unoptimized />
              {platform.label}
            </span>
          ))}
        </div>
        {countdown?.released ? (
          <p className="gta6-released">{active.releasedText}</p>
        ) : (
          <div
            className="gta6-clock"
            role="timer"
            aria-label={active.timerAriaLabel}
            aria-live="off"
          >
            {(['days', 'hours', 'minutes', 'seconds'] as const).map((key, index) => (
              <div key={key}>
                <strong>{countdown ? String(countdown[key]).padStart(2, '0') : '—'}</strong>
                <span>{['DÍAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'][index]}</span>
              </div>
            ))}
          </div>
        )}
        <small className="muted">{active.referenceNote}</small>
      </section>
      <div className="countdown-slider-footer">
        <button
          type="button"
          className="button outline small"
          aria-label="Contador anterior"
          onClick={() =>
            setActiveIndex(
              (previous) => (previous - 1 + RELEASE_COUNTDOWNS.length) % RELEASE_COUNTDOWNS.length,
            )
          }
        >
          ←
        </button>
        <span className="countdown-slider-status" aria-live="polite">
          {activeIndex + 1} / {RELEASE_COUNTDOWNS.length}
        </span>
        <button
          type="button"
          className="button outline small"
          aria-label="Siguiente contador"
          onClick={() => setActiveIndex((previous) => (previous + 1) % RELEASE_COUNTDOWNS.length)}
        >
          →
        </button>
      </div>
    </div>
  );
}
