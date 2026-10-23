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
  const [tab, setTab] = useState<
    'token' | 'players' | 'alert' | 'switches' | 'hud' | 'jira' | 'cloud'
  >('token');
  const [online, setOnline] = useState(true);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [code, setCode] = useState('------');
  const [remaining, setRemaining] = useState(20);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [players, setPlayers] = useState<GuardianPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/guardian-sw.js', { scope: '/guardian' }).catch(() => {
        if (active) {
          setNotice('No se pudo preparar el modo offline. Vuelve a abrir Guardian con conexión.');
        }
      });
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!key) return;
    let active = true;
    const tick = async () => {
      try {
        const now = Date.now();
        const value = await gateCodeFromKey(key, now);
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
        if (!controller.signal.aborted) {
          setNotice(err instanceof Error ? err.message : 'Sin conexión al directorio.');
        }
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
        <div className="flex items-center gap-2">
          <span className="text-base">🛡️</span>
          <strong className="text-xs tracking-wider text-slate-100 uppercase">
            SAVESTATE GUARDIAN
          </strong>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              online
                ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                : 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
            }`}
          ></span>
          <span
            className={`text-[11px] font-semibold ${online ? 'text-emerald-300' : 'text-amber-300'}`}
          >
            {online ? 'ONLINE' : 'OFFLINE'} @{username}
          </span>
        </div>
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
          ) {
            setRefresh((value) => value + 1);
          }
          touchStart.current = null;
        }}
      >
        {tab !== 'cloud' && (
          <div className="guardian-screen-header">
            <h1 className="guardian-screen-title">
              {
                {
                  token: '🔐 Security Token',
                  players: '👥 Directorio de jugadores',
                  alert: '🚨 Transmisión y alertas',
                  switches: '🎛️ Interruptores maestros',
                  hud: '📊 Monitor de salud',
                  jira: '🎫 Jira / Tickets de soporte',
                  cloud: '☁️ Cloud & CI Observer',
                }[tab]
              }
            </h1>
            <p className="guardian-screen-subtitle">
              Panel de control del Operador Supremo SaveState
            </p>
          </div>
        )}

        {tab === 'token' ? (
          <div className="guardian-token-card">
            <div className="guardian-cloud-header mb-2">
              <div className="guardian-cloud-title-group">
                <span className="provider-badge">🔐 TOTP RFC 6238</span>
                <span className="provider-sub">Autenticación local</span>
              </div>
              <div className={`status-pill ${key ? 'status-ready' : 'status-neutral'}`}>
                <span className={`pulse-dot ${key ? 'dot-green' : ''}`}></span>
                <span>{key ? 'ACTIVO' : 'SIN ACTIVAR'}</span>
              </div>
            </div>

            <div className="guardian-token-screen">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block text-center mb-1">
                CLAVE DINÁMICA DE PASO
              </span>
              <output className="guardian-digits" aria-label="Clave activa" aria-live="off">
                {code.slice(0, 3)} {code.slice(3)}
              </output>
              <div className="guardian-timer-track">
                <div
                  className="guardian-timer-bar"
                  style={{ width: `${key ? (remaining / 20) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
                <span className="font-mono text-cyan-300 font-bold">
                  {key ? `${remaining}s restantes` : '0s'}
                </span>
                <span className="text-[11px] text-slate-400">Offline · Ciclos de 20s</span>
              </div>
            </div>

            <div className="guardian-token-action-grid">
              <button
                className="btn-cloud-primary"
                type="button"
                disabled={!key || !/^\d{6}$/.test(code)}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setNotice('Clave copiada al portapapeles.');
                  } catch {
                    setNotice('No se pudo copiar. Selecciona la clave manualmente.');
                  }
                }}
              >
                📋 Copiar clave
              </button>
              <button
                className="btn-cloud-secondary"
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
                {key ? '🔄 Reactivar' : '⚡ Activar en este equipo'}
              </button>
              {key && (
                <button
                  className="btn-cloud-danger"
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
                  ✕ Olvidar
                </button>
              )}
            </div>

            <div className="cloud-details-box text-xs mt-3">
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Algoritmo:</span>
                <span className="cloud-detail-value">HMAC-SHA1 (RFC 6238)</span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Semilla criptográfica:</span>
                <span className="cloud-detail-value text-emerald-400">
                  {key ? 'Almacenada localmente' : 'No enlazada'}
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Seguridad de red:</span>
                <span className="cloud-detail-value">Cero fugas de semilla</span>
              </div>
            </div>
          </div>
        ) : tab === 'players' ? (
          <section className="guardian-players-section">
            <div className="guardian-players-search-card">
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  className="guardian-search-input"
                  placeholder="🔍 Buscar por nombre de usuario..."
                  maxLength={30}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                />
                <button
                  className="btn-cloud-refresh"
                  type="button"
                  title="Actualizar directorio"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  ↻
                </button>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                <span>{total} jugadores registrados</span>
                <span className="text-cyan-300 font-bold">{count} coincidencias</span>
              </div>
            </div>

            <ul className="guardian-players-list">
              {players.map((player) => (
                <li key={player.id} className="guardian-player-card">
                  <div className="guardian-player-avatar-wrap">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        width={42}
                        height={42}
                        alt=""
                        loading="lazy"
                        className="rounded-lg object-cover border border-cyan-800/40"
                      />
                    ) : (
                      <div className="guardian-player-avatar-fallback">
                        {player.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="guardian-player-lvl-pill">LVL {player.level}</span>
                  </div>

                  <div className="guardian-player-info">
                    <div className="guardian-player-top">
                      <strong className="guardian-player-name truncate">@{player.username}</strong>
                      <span
                        className={`guardian-lock-badge ${player.access_locked ? 'is-locked' : 'is-ok'}`}
                      >
                        {player.access_locked ? '🔒 Bloqueado' : '🟢 Normal'}
                      </span>
                    </div>
                    <p
                      className="guardian-player-status truncate"
                      title={player.terminal_status || ''}
                    >
                      {player.terminal_status || 'Sin estado de terminal'}
                    </p>
                    <div className="guardian-player-meta">
                      <small className="text-slate-500 text-[10px]">
                        {new Date(player.created_at).toLocaleDateString('es-CL', {
                          timeZone: 'America/Santiago',
                        })}
                      </small>
                      <button
                        type="button"
                        className="btn-cloud-pr"
                        disabled={!online}
                        onClick={() => setManaged(player)}
                      >
                        {player.id === adminId ? '🛡️ Tu cuenta' : '⚙️ Administrar'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="guardian-pagination-bar">
              <button
                type="button"
                className="btn-cloud-secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Anterior
              </button>
              <span className="pagination-counter">
                {page + 1} / {Math.max(1, Math.ceil(count / 50))}
              </span>
              <button
                type="button"
                className="btn-cloud-secondary"
                disabled={(page + 1) * 50 >= count}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente →
              </button>
            </div>
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

      {/* REDESIGNED BOTTOM NAVIGATION (SLEEK, UNCONGESTED CYBER BAR) */}
      <nav className="guardian-bottom-nav" aria-label="Secciones de Guardian">
        {(
          [
            ['token', '🔐', 'Token'],
            ['players', '👥', 'Jugadores'],
            ['alert', '🚨', 'Alerta'],
            ['switches', '🎛️', 'Switches'],
            ['hud', '📊', 'HUD'],
            ['jira', '🎫', 'Jira'],
            ['cloud', '☁️', 'Cloud'],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className="guardian-nav-btn"
            aria-pressed={tab === id}
            disabled={!online && id !== 'token'}
            onClick={() => setTab(id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="nav-label">{label}</span>
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
