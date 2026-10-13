'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import type { DiscordRoleStats } from '@/domain/discord-linked-roles';
type Status = {
  username: string;
  stats: DiscordRoleStats;
  connected: boolean;
  configured: boolean;
};
export function DiscordLinkedRoleCard() {
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/discord/role-connection', { signal: controller.signal, cache: 'no-store' })
      .then((response) => readJsonResponse<{ data: Status }>(response))
      .then((result) => {
        if (controller.signal.aborted) return;
        setStatus(result.data);
        const flag = new URLSearchParams(window.location.search).get('linkedRoles');
        if (flag === 'success' && result.data.connected)
          setMessage('Estadísticas sincronizadas con Discord.');
        if (flag === 'error') {
          setError(true);
          setMessage(
            'No se completó la autorización. Revisa la configuración y vuelve a intentarlo.',
          );
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(true);
          setMessage(failure instanceof Error ? failure.message : 'No se pudo consultar el rol.');
        }
      });
    return () => controller.abort();
  }, []);
  async function sync() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      const result = await api<{ authorizeRequired?: boolean; stats?: DiscordRoleStats }>(
        'discord/role-connection',
        { action: 'sync' },
      );
      if (result.authorizeRequired) {
        const auth = await api<{ url: string }>('discord/role-connection', { action: 'authorize' });
        const url = new URL(auth.url);
        if (url.origin !== 'https://discord.com')
          throw new Error('Destino de autorización inválido.');
        window.location.assign(url.href);
      } else {
        if (result.stats)
          setStatus((old) => (old ? { ...old, stats: result.stats!, connected: true } : old));
        setMessage('Estadísticas sincronizadas con Discord.');
      }
    } catch (failure) {
      setError(true);
      setMessage(failure instanceof Error ? failure.message : 'No se pudo sincronizar.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel discord-linked-role-card">
      <h2>ROL VERIFICADO EN DISCORD</h2>
      <p className="muted">
        Vincula tus estadísticas verificadas de SaveState para cumplir los requisitos de roles del
        servidor.
      </p>
      {status && (
        <ul>
          <li>✦ Nivel: {status.stats.level}</li>
          <li>🎮 Terminados: {status.stats.completed_games}</li>
          <li>🏆 Platinos: {status.stats.platinum_games}</li>
        </ul>
      )}
      <p className="muted">
        Al autorizar, compartes tu usuario y estos conteos con Discord, incluidos los de tu
        biblioteca privada. El rol se concede según las reglas que configure el servidor.
      </p>
      <button
        type="button"
        className="button outline"
        disabled={busy || !status?.configured}
        onClick={() => void sync()}
      >
        {busy ? 'Sincronizando…' : '🛡️ Sincronizar Rango y Rol'}
      </button>
      {status && !status.configured && (
        <p className="notice">
          Vinculación pendiente de configurar la aplicación OAuth de Discord en el servidor.
        </p>
      )}
      {message && (
        <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'muted'}>
          {message}
        </p>
      )}
    </section>
  );
}
