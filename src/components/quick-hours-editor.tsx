'use client';
import { useState } from 'react';
import { MutationForm } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import type { PlayLog } from '@/domain/model';
import { consoleHours } from '@/domain/console-import';
export function QuickHoursEditor({ logs }: { logs: PlayLog[] }) {
  const [id, setId] = useState(
    (logs.find((log) => Number(log.hours_played) === 0) ?? logs[0])?.id ?? '',
  );
  const selected = logs.find((log) => log.id === id) ?? logs[0];
  if (!selected) return null;
  return (
    <details className="quick-session">
      <summary>✎ Editar horas</summary>
      <MutationForm
        key={`${selected.id}:${selected.hours_played}`}
        label="Guardar horas"
        submit={async (form) => {
          await api('library', {
            action: 'set_hours',
            id: selected.id,
            expected_hours: Number(selected.hours_played),
            hours: consoleHours(String(form.get('hours'))),
          });
        }}
      >
        <label>
          Partida
          <select value={selected.id} onChange={(event) => setId(event.target.value)}>
            {logs.map((log) => (
              <option key={log.id} value={log.id}>
                {log.platform_played} · {log.start_date ?? log.created_at.slice(0, 10)} ·{' '}
                {log.hours_played} h
              </option>
            ))}
          </select>
        </label>
        <label>
          Horas totales de esta partida
          <input
            name="hours"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={selected.hours_played}
            required
          />
        </label>
        <p className="muted">
          Sustituye las horas de la partida elegida. Conserva sus notas y fechas; los totales y
          gráficos se actualizan al guardar. Corregir una estimación no otorga XP de sesión.
        </p>
      </MutationForm>
    </details>
  );
}
