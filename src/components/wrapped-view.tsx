'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { WrappedSummary } from '@/domain/wrapped';
import { exportWrapped } from '@/lib/wrapped-export';
export function WrappedView({
  summary,
  username,
  userId,
}: {
  summary: WrappedSummary;
  username: string;
  userId: string;
}) {
  const [slide, setSlide] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const month = (index: number) =>
    new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(summary.year, index, 1)),
    );
  const titles = [
    'Tus checkpoints',
    'Tu juego del año',
    'Tu ADN gamer',
    'Tu momento épico',
    'Tu ritmo de juego',
  ];
  async function download() {
    setPending(true);
    setError('');
    try {
      await exportWrapped(summary, username);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo exportar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="wrapped-console" aria-label={`Resumen anual ${summary.year}`}>
      <p className="eyebrow">
        SAVE SLOT / {summary.year} / @{username}
      </p>
      <div
        className="wrapped-screen"
        role="group"
        aria-roledescription="diapositiva"
        aria-label={`${slide + 1} de 5: ${titles[slide]}`}
      >
        <h2>{titles[slide]}</h2>
        {slide === 0 ? (
          <div className="wrapped-metrics">
            <p>
              <strong>{summary.registered}</strong> registrados
            </p>
            <p>
              <strong>{summary.played}</strong> jugados
            </p>
            <p>
              <strong>{summary.completed}</strong> completados
            </p>
            <p>
              <strong>{summary.hours.toFixed(1)}</strong> horas registradas
            </p>
          </div>
        ) : null}
        {slide === 1 ? (
          <>
            {summary.goty ? (
              <>
                <h3 className="wrapped-goty">
                  <Link href={`/games/${summary.goty.slug}`}>{summary.goty.title}</Link>
                </h3>
                <p className="accent">
                  {summary.goty.rating === null
                    ? 'Tu favorito del año'
                    : `${summary.goty.rating} / 10`}
                </p>
              </>
            ) : (
              <p>
                Puntúa un juego jugado este año o fíjalo entre tus favoritos para elegir tu GOTY.
              </p>
            )}
          </>
        ) : null}
        {slide === 2 ? (
          <>
            {summary.genres.length ? (
              summary.genres.map((genre) => (
                <div className="wrapped-genre" key={genre.name}>
                  <span>{genre.name}</span>
                  <progress
                    value={genre.percent}
                    max={100}
                    aria-label={`${genre.name}: ${genre.percent}%`}
                  />
                  <strong>{genre.percent}%</strong>
                </div>
              ))
            ) : (
              <p>Aún no hay juegos registrados como jugados en este año.</p>
            )}
          </>
        ) : null}
        {slide === 3 ? (
          <>
            {summary.moment ? (
              <>
                <h3>{summary.moment.title}</h3>
                <p className="accent">{summary.moment.reactions} reacciones</p>
                <Link href={`/tavern?tab=momentos&player=${userId}`}>
                  Ver Momentos del jugador →
                </Link>
              </>
            ) : (
              <p>El siguiente momento épico está por llegar.</p>
            )}
          </>
        ) : null}
        {slide === 4 ? (
          <>
            <p className="wrapped-goty">
              {summary.peakMonth === null ? 'Tu próxima meta te espera' : month(summary.peakMonth)}
            </p>
            <p>Mes con más juegos completados.</p>
            <div className="wrapped-months">
              {summary.months.map((count, index) => (
                <div key={index}>
                  <span>{month(index).slice(0, 3)}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <nav className="wrapped-controls" aria-label="Diapositivas del resumen">
        <button
          className="button secondary"
          disabled={slide === 0}
          onClick={() => setSlide(slide - 1)}
        >
          Anterior
        </button>
        <span role="status">{slide + 1} / 5</span>
        <button
          className="button secondary"
          disabled={slide === 4}
          onClick={() => setSlide(slide + 1)}
        >
          Siguiente
        </button>
      </nav>
      <button className="button" disabled={pending} onClick={() => void download()}>
        {pending ? 'Generando PNG…' : 'Exportar Ficha de Guardado (PNG)'}
      </button>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      <p className="muted wrapped-notes">
        Año en UTC. Registros según el primer evento disponible; completados una vez por título, por
        cambio de estado o fecha de fin. Las horas se atribuyen a la fecha de fin, inicio o registro
        de la partida; Steam acumulado queda excluido. Géneros ponderados por juego. GOTY usa tu
        nota/favoritos actuales entre juegos jugados ese año. Solo se incluyen Momentos públicos
        visibles para ti.
      </p>
    </section>
  );
}
