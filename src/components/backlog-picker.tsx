'use client';
import { useState } from 'react';
import { backlogCandidates, chooseBacklog } from '@/domain/backlog';
import { GameCard } from '@/components/game-card';
import type { Game, UserGame } from '@/domain/model';
export function BacklogPicker({ entries, games }: { entries: UserGame[]; games: Game[] }) {
  const [platform, setPlatform] = useState('');
  const [genre, setGenre] = useState('');
  const [chosen, setChosen] = useState<Game | null>(null);
  const all = backlogCandidates(entries, games);
  const candidates = backlogCandidates(entries, games, platform, genre);
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
            onChange={(event) => {
              setPlatform(event.target.value);
              setChosen(null);
            }}
          >
            <option value="">Todas</option>
            {[...new Set(all.flatMap((game) => game.platforms))].sort().map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Género
          <select
            value={genre}
            onChange={(event) => {
              setGenre(event.target.value);
              setChosen(null);
            }}
          >
            <option value="">Todos</option>
            {[...new Set(all.flatMap((game) => game.genres))].sort().map((value) => (
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
        disabled={!candidates.length}
        onClick={() => setChosen(chooseBacklog(candidates))}
      >
        {chosen ? 'Elegir otra vez' : 'Elegir mi próxima partida'}
      </button>
      {visibleChoice ? (
        <div className="game-grid" aria-live="polite">
          <GameCard game={visibleChoice} />
        </div>
      ) : null}
    </section>
  );
}
