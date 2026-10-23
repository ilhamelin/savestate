'use client';
import { useEffect, useRef, useState } from 'react';
import { gateCodeFromKey, gateSecretBytes } from '@/domain/gatekeeper';
import { loadGuardianKey, saveGuardianKey, removeGuardianKey } from '@/lib/guardian-device';
import { GuardianCloudPanel } from './guardian-cloud-panel';
import { GuardianJiraPanel } from './guardian-jira-panel';
import { PlayerManagementDialog } from './player-management-dialog';
import { GuardianAlertPanel, GuardianSwitchPanel, GuardianHudPanel } from './operator-panels';
interface GuardianPlayer {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  terminal_status: string | null;
  created_at: string;
  access_locked?: boolean;
}
export function GuardianConsole({ username, adminId }: { username: string; adminId: string }) {
  const [managed, setManaged] = useState<GuardianPlayer | null>(null);
  const [tab, setTab] = useState<'token' | 'players' | 'alert' | 'switches' | 'hud' | 'jira' | 'cloud'>(
    'token',
  );
  const [online, setOnline] = useState(true);
  const [key, setKey] = useState<CryptoKey | null>(null),
    [code, setCode] = useState('------');
  const [remaining, setRemaining] = useState(20),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [players, setPlayers] = useState<GuardianPlayer[]>([]),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [count, setCount] = useState(0),
    [total, setTotal] = useState(0),
    [refresh, setRefresh] = useState(0);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const timer = window.setTimeout(update, 0);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    loadGuardianKey()
      .then((value) => {
        if (active) setKey(value);
      })
      .catch(() => {
        if (active) setNotice('Almacenamiento local no disponible.');
      });
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/guardian-sw.js', { scope: '/guardian' }).catch(() => {
        if (active)
          setNotice('No se pudo preparar el modo offline. Vuelve a abrir Guardian con conexión.');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!key) return;
    let active = true;
    const tick = async () => {
      try {
        const now = Date.now(),
          value = await gateCodeFromKey(key, now);
        if (active) {
          setCode(value);
          setRemaining(20 - (Math.floor(now / 1000) % 20));
        }
      } catch {
        if (active) setNotice('No se pudo generar la clave. Reactiva este dispositivo.');
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [key]);
  useEffect(() => {
    if (tab !== 'players') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/guardian/players?${new URLSearchParams({ q: query, page: String(page) })}`,
          { cache: 'no-store', signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar el directorio.');
        if (!controller.signal.aborted) {
          setPlayers(result.players);
          setCount(result.count);
          setTotal(result.total);
        }
      } catch (err) {
        if (!controller.signal.aborted)
          setNotice(err instanceof Error ? err.message : 'Sin conexión al directorio.');
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, query, page, refresh]);
  useEffect(() => {
    if (tab !== 'players') return;
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') setRefresh((value) => value + 1);
    };
    const timer = window.setInterval(refreshVisible, 30000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [tab]);
  return (
    <div className="guardian-app-viewport">
      <header className="guardian-mobile-header">
        <strong>🛡️ SAVESTATE GUARDIAN</strong>
        <span className={`guardian-online-state${online ? '' : ' is-offline'}`}>
          {online ? '● ONLINE' : '○ OFFLINE'} @{username}
        </span>
      </header>
      <div
        className="guardian-mobile-body"
        onTouchStart={(event) => {
          touchStart.current =
            event.currentTarget.scrollTop <= 0 ? (event.touches[0]?.clientY ?? null) : null;
        }}
        onTouchEnd={(event) => {
          if (
            tab === 'players' &&
            touchStart.current !== null &&
            (event.changedTouches[0]?.clientY ?? 0) - touchStart.current > 80
          )
            setRefresh((value) => value + 1);
          touchStart.current = null;
        }}
      >
        <h1 className="guardian-screen-title">
          {
            {
              token: 'Security Token',
              players: 'Directorio de jugadores',
              alert: 'Alerta global',
              switches: 'Interruptores maestros',
              hud: 'Monitor de salud',
              jira: 'Jira / Tickets',
              cloud: 'Cloud / CI',
            }[tab]
          }
        </h1>
        <p className="muted">
          En el navegador del teléfono, usa «Instalar aplicación» o «Agregar a pantalla de inicio».
          Sincroniza la hora automáticamente.
        </p>
        {tab === 'token' ? (
          <div className="guardian-token">
            <p className="muted">RFC 6238 · 6 dígitos · paso de 20 segundos</p>
            <output className="guardian-digits" aria-label="Clave activa" aria-live="off">
              {code.slice(0, 3)} {code.slice(3)}
            </output>
            <progress
              max={20}
              value={key ? remaining : 0}
              aria-label="Segundos restantes de la clave"
            />
            <p>
              {key
                ? `${remaining}s · Generación local, disponible offline`
                : 'Dispositivo sin activar'}
            </p>
            <div className="guardian-token-actions">
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setNotice('');
                  try {
                    const response = await fetch('/api/guardian/enroll', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: '{}',
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error ?? 'No se pudo activar.');
                    const imported = await crypto.subtle.importKey(
                      'raw',
                      gateSecretBytes(result.data.secret),
                      { name: 'HMAC', hash: 'SHA-1' },
                      false,
                      ['sign'],
                    );
                    await saveGuardianKey(imported);
                    setKey(imported);
                    setNotice('Activado en este dispositivo. Conserva el teléfono protegido.');
                  } catch (err) {
                    setNotice(err instanceof Error ? err.message : 'No se pudo activar.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {key ? 'Reactivar dispositivo' : 'Activar en este dispositivo'}
              </button>
              <button
                className="button guardian-copy-button"
                type="button"
                disabled={!key || !/^\d{6}$/.test(code)}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setNotice('Clave copiada.');
                  } catch {
                    setNotice('No se pudo copiar. Selecciona la clave manualmente.');
                  }
                }}
              >
                Copiar clave
              </button>
              {key && (
                <button
                  className="button outline"
                  type="button"
                  onClick={async () => {
                    try {
                      await removeGuardianKey();
                      setKey(null);
                      setCode('------');
                      setNotice('Clave eliminada de este dispositivo.');
                    } catch {
                      setNotice('No se pudo eliminar la clave local.');
                    }
                  }}
                >
                  Olvidar dispositivo
                </button>
              )}
            </div>
            <p className="muted">
              Activa solo un teléfono de confianza: la clave criptográfica local permite generar
              códigos offline hasta que se rote la semilla del servidor.
            </p>
          </div>
        ) : tab === 'players' ? (
          <section>
            <p>
              {total} jugadores registrados · {count} coincidencias
            </p>
            <label>
              Buscar jugador
              <input
                type="search"
                maxLength={30}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <button
              className="button outline small"
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              ↻ Actualizar directorio
            </button>
            <ul className="guardian-players">
              {players.map((player) => (
                <li key={player.id}>
                  {player.avatar_url ? (
                    <img src={player.avatar_url} width={40} height={40} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">▣</span>
                  )}
                  <div>
                    <strong>@{player.username}</strong>
                    <span className="guardian-player-level">LVL {player.level}</span>
                    <span>{player.terminal_status || 'Sin estado de terminal'}</span>
                    <small>
                      {player.access_locked ? '🔒 Acceso Bloqueado' : '🟢 Acceso Normal'}
                    </small>
                    <small>
                      Registro:{' '}
                      {new Date(player.created_at).toLocaleDateString('es-CL', {
                        timeZone: 'America/Santiago',
                      })}
                    </small>
                    <button
                      type="button"
                      className="button outline small"
                      disabled={!online}
                      onClick={() => setManaged(player)}
                    >
                      {player.id === adminId ? '🛡️ Tu cuenta (Operador)' : '⚙️ Administrar'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="filter-buttons">
              <button
                type="button"
                className="button outline small"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Anterior
              </button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(count / 50))}
              </span>
              <button
                type="button"
                className="button outline small"
                disabled={(page + 1) * 50 >= count}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente →
              </button>
            </div>
            <p className="muted">
              Desliza hacia abajo desde el inicio para actualizar. El directorio requiere conexión y
              sesión de administrador.
            </p>
          </section>
        ) : tab === 'alert' ? (
          <GuardianAlertPanel />
        ) : tab === 'cloud' ? (
          <GuardianCloudPanel />
        ) : tab === 'jira' ? (
          <GuardianJiraPanel />
        ) : tab === 'switches' ? (
          <GuardianSwitchPanel />
        ) : (
          <GuardianHudPanel adminId={adminId} />
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </div>
      <nav className="guardian-bottom-nav" aria-label="Secciones de Guardian">
        {(
          [
            ['token', '🔐', 'Token'],
            ['players', '👥', 'Jugadores'],
            ['alert', '🚨', 'Alerta'],
            ['switches', '🎛️', 'Switches'],
            ['hud', '📊', 'HUD'],
            ['jira', '🎫', 'Jira / Tickets'],
            ['cloud', '☁️', 'Cloud / CI'],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className="button outline"
            aria-pressed={tab === id}
            disabled={!online && id !== 'token'}
            onClick={() => setTab(id)}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {managed && (
        <PlayerManagementDialog
          key={managed.id}
          player={managed}
          adminId={adminId}
          onClose={() => setManaged(null)}
          onUpdated={(action) => {
            setPlayers((current) =>
              ['reward', 'kick', 'whisper'].includes(action)
                ? current
                : action === 'delete'
                  ? current.filter((player) => player.id !== managed.id)
                  : current.map((player) =>
                      player.id !== managed.id
                        ? player
                        : {
                            ...player,
                            ...(action === 'reset'
                              ? { level: 1, terminal_status: '' }
                              : { access_locked: action === 'lock' }),
                          },
                    ),
            );
            setNotice(
              action === 'kick' || action === 'whisper'
                ? 'Señal enviada. Se aplica si el jugador está conectado.'
                : action === 'reward'
                  ? 'Premio actualizado. El directorio reflejará el nuevo nivel.'
                  : action === 'delete'
                    ? 'Cuenta eliminada definitivamente.'
                    : action === 'reset'
                      ? 'Cuenta reiniciada a Nivel 1.'
                      : action === 'lock'
                        ? 'Acceso revocado. Se exigirá una nueva clave.'
                        : 'Acceso desbloqueado.',
            );
            setManaged(null);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
