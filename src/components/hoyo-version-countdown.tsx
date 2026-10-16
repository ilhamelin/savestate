'use client';
import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import {
  HOYO_VERSION_SCHEDULES,
  calculateHoyoCountdown,
  hoyoCycleProgress,
  type HoyoGame,
} from '@/domain/hoyo-hub';

function scheduleDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(value));
}
export function HoyoVersionCountdown({ game }: { game: HoyoGame }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'hidden') setNow(Date.now());
    };
    const initial = window.setTimeout(tick, 0),
      timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const schedule = HOYO_VERSION_SCHEDULES[game];
  const countdown = now === null ? null : calculateHoyoCountdown(schedule.nextReleaseDate, now);
  const progress = now === null ? null : hoyoCycleProgress(schedule, now);
  return (
    <section className="hoyo-countdown-card" aria-labelledby="hoyo-countdown-title">
      <div className="hoyo-countdown-header">
        <div>
          <p className="eyebrow">
            <Clock3 size={14} aria-hidden="true" /> RADAR DE VERSIÓN
          </p>
          <h2 id="hoyo-countdown-title">Próxima versión {schedule.nextVersion}</h2>
        </div>
        <span className="hoyo-tag">Calendario de referencia</span>
      </div>
      <p className="muted">
        Ciclo {schedule.currentVersion} · {schedule.currentTitle}
      </p>
      <div
        className="hoyo-timer-digits"
        role="timer"
        aria-label={
          countdown ? `Tiempo restante: ${countdown.formatted}` : 'Preparando cuenta regresiva'
        }
        aria-live="off"
      >
        {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit, index) => (
          <div className="hoyo-timer-block" key={unit}>
            <span className="hoyo-timer-val">
              {countdown ? String(countdown[unit]).padStart(2, '0') : '--'}
            </span>
            <span className="hoyo-timer-lbl">{['Días', 'Horas', 'Min', 'Seg'][index]}</span>
          </div>
        ))}
      </div>
      {countdown?.isPast && (
        <p role="status" className="hoyo-countdown-status">
          Fecha de referencia alcanzada. Consulta el anuncio oficial para conocer el estado de la
          versión.
        </p>
      )}
      <div className="hoyo-progress-summary">
        <span>Ciclo de {schedule.cycleTotalDays} días</span>
        <span>
          {progress
            ? `${progress.daysIntoCycle} días · ${progress.progressPercent}%`
            : 'Calculando…'}
        </span>
      </div>
      <div
        className="hoyo-progress-bar-bg"
        role="progressbar"
        aria-label="Progreso del ciclo de referencia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress?.progressPercent}
      >
        <div
          className="hoyo-progress-bar-fill"
          style={{ width: `${progress?.progressPercent ?? 0}%` }}
        />
      </div>
      <dl className="hoyo-schedule-details">
        <div>
          <dt>Lanzamiento previsto</dt>
          <dd>
            <time dateTime={schedule.nextReleaseDate}>
              {scheduleDate(schedule.nextReleaseDate)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Programa especial previsto</dt>
          <dd>
            <time dateTime={schedule.specialProgramDate}>
              {scheduleDate(schedule.specialProgramDate)}
            </time>
          </dd>
        </div>
      </dl>
      <p className="hoyo-player-help muted">
        Horarios de Santiago. Fechas de referencia sujetas a confirmación oficial; la cuenta
        regresiva no confirma disponibilidad del parche.
      </p>
    </section>
  );
}
