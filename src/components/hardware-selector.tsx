'use client';
import { useState } from 'react';
import {
  POPULAR_HARDWARE,
  MAX_HARDWARE,
  MAX_HARDWARE_NAME,
  ownedPlatforms,
} from '@/domain/hardware';
export function HardwareSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  function toggle(name: string) {
    try {
      onChange(
        ownedPlatforms(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]),
      );
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Plataforma inválida.');
    }
  }
  function add() {
    try {
      onChange(ownedPlatforms([...value, custom]));
      setCustom('');
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Plataforma inválida.');
    }
  }
  const names = [...new Set([...POPULAR_HARDWARE, ...value])];
  return (
    <section aria-label="Mis consolas y hardware" className="hardware-selector">
      <h3>Mis consolas y hardware</h3>
      <p className="muted">
        Marca las plataformas que posees. Hasta {MAX_HARDWARE}; visibles en tu perfil público.
      </p>
      <div className="studio-statuses" role="group" aria-label="Plataformas propias">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            className="studio-chip"
            aria-pressed={value.includes(name)}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <label>
        Plataforma personalizada
        <input
          value={custom}
          maxLength={MAX_HARDWARE_NAME}
          placeholder="Ej. Sega Dreamcast"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      </label>
      <button
        type="button"
        className="button outline small"
        disabled={!custom.trim()}
        onClick={add}
      >
        + Añadir plataforma
      </button>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </section>
  );
}
