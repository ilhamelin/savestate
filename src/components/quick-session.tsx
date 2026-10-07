'use client';
import { useState } from 'react';
import { MutationForm } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import type { PlayLog } from '@/domain/model';
export function QuickSession({ logs }: { logs: PlayLog[] }) {
  const [minutes, setMinutes] = useState('60');
  if (!logs.length)
    return <p className="muted">Crea una partida para registrar sesiones rápidas.</p>;
  return (
    <details className="quick-session">
      <summary>+ Registrar sesión rápida</summary>
      <MutationForm
        label="Sumar tiempo a la partida"
        submit={async (form) => {
          await api('library', {
            action: 'quick_session',
            id: String(form.get('log')),
            minutes: Number(form.get('minutes')),
          });
          setMinutes('');
        }}
      >
        <label>
          Partida
          <select
            name="log"
            defaultValue={(logs.find((log) => !log.finish_date) ?? logs[0])?.id}
            required
          >
            {logs.map((log) => (
              <option key={log.id} value={log.id}>
                {log.platform_played} · {log.start_date ?? log.created_at.slice(0, 10)} ·{' '}
                {log.hours_played} h{log.finish_date ? ' · terminada' : ''}
                {log.note ? ` · ${log.note.slice(0, 40)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Minutos jugados
          <input
            name="minutes"
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <p className="muted">
          Se suman al total de esta partida, redondeado a 0.01 h. Sus fechas y notas se conservan.
        </p>
      </MutationForm>
    </details>
  );
}
