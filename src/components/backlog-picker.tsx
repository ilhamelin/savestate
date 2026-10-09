'use client';
import { useEffect, useRef, useState } from 'react';
import { backlogCandidates, chooseBacklog } from '@/domain/backlog';
import { GameCard } from '@/components/game-card';
import type { Game, PlayLog, UserGame } from '@/domain/model';
import { libraryPlatformOptions } from '@/domain/library-platforms';
export function BacklogPicker({
  entries,
  games,
  logs = [],
}: {
  entries: UserGame[];
  games: Game[];
  logs?: PlayLog[];
}) {
  const [platform, setPlatform] = useState('');
  const [genre, setGenre] = useState('');
  const [chosen, setChosen] = useState<Game | null>(null);
  const [spinning, setSpinning] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const all = backlogCandidates(entries, games);
  const candidates = backlogCandidates(entries, games, platform, genre, logs);
  const platforms = libraryPlatformOptions(
    entries.filter((entry) => entry.status === 'backlog'),
    games,
    logs,
  );
  const visibleChoice = candidates.find((game) => game.id === chosen?.id);
  return (
    <section className="panel">
      <h2>¿Qué juego hoy?</h2>
      <p className="muted">
        Elige al azar entre tus juegos en Backlog. Tu estado y puntuación se conservan.
      </p>
      <div className="form-row">
        <label>
          Plataforma
          <select
            value={platform}
            disabled={spinning}
            onChange={(event) => {
              setPlatform(event.target.value);
              setChosen(null);
            }}
          >
            <option value="">Todas</option>
            {platforms.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Género
          <select
            value={genre}
            disabled={spinning}
            onChange={(event) => {
              setGenre(event.target.value);
              setChosen(null);
            }}
          >
            <option value="">Todos</option>
            {[...new Set(all.flatMap((game) => game.genres).filter((value) => value?.trim()))]
              .sort((a, b) => a.localeCompare(b, 'es'))
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
      </div>
      <p role="status">
        {candidates.length} juegos disponibles
        {!candidates.length ? '. Agrega juegos a Backlog o cambia los filtros.' : '.'}
      </p>
      <button
        className="button"
        disabled={!candidates.length || spinning}
        onClick={() => {
          stop.current?.();
          const winner = chooseBacklog(candidates);
          const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
          if (motion.matches || candidates.length === 1) {
            setChosen(winner);
            return;
          }
          setSpinning(true);
          setChosen(chooseBacklog(candidates));
          const interval = setInterval(() => setChosen(chooseBacklog(candidates)), 150);
          const finish = () => {
            stop.current?.();
            setChosen(winner);
            setSpinning(false);
          };
          const timer = setTimeout(finish, 1500);
          const changed = () => {
            if (motion.matches) finish();
          };
          motion.addEventListener('change', changed);
          stop.current = () => {
            clearInterval(interval);
            clearTimeout(timer);
            motion.removeEventListener('change', changed);
            stop.current = null;
          };
        }}
      >
        {spinning ? 'Barajando aventuras…' : '🎰 Elegir mi próxima aventura'}
      </button>
      <p role="status">
        {!spinning && visibleChoice
          ? `La consola ha hablado: tu próxima partida es ${visibleChoice.title}.`
          : spinning
            ? 'La ruleta está girando.'
            : ''}
      </p>
      {visibleChoice ? (
        <div
          className="backlog-result"
          aria-hidden={spinning || undefined}
          inert={spinning || undefined}
        >
          <GameCard game={visibleChoice} prefetch={false} />
        </div>
      ) : null}
    </section>
  );
}
