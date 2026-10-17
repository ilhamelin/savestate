'use client';
import { useState } from 'react';
import { safeNext } from '@/domain/validation';
export function GatekeeperForm() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="gatekeeper-fullscreen-lock">
      <section className="panel gatekeeper-card">
        <p className="eyebrow">GUARDIAN // CHECKPOINT DE ACCESO</p>
        <h1>Ingresa la señal de 20 segundos.</h1>
        <p className="muted">Introduce la clave activa del operador para desbloquear SaveState.</p>
        <form
          className="guardian-code-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError('');
            const code = String(new FormData(event.currentTarget).get('code') ?? '');
            try {
              const response = await fetch('/api/gatekeeper/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code,
                  next: safeNext(new URLSearchParams(window.location.search).get('next') ?? '/'),
                }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error ?? 'No se pudo validar la clave.');
              window.location.assign(safeNext(result.redirect));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo conectar.');
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Clave activa
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              placeholder="000000"
            />
          </label>
          <button className="button" disabled={pending}>
            {pending ? 'Verificando…' : 'Desbloquear checkpoint →'}
          </button>
        </form>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
