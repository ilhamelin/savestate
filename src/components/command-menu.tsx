'use client';
import { Command } from 'cmdk';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { Game } from '@/domain/model';
import { readJsonResponse } from '@/lib/api-response';
import { browserClient } from '@/integrations/supabase/browser';
import { isAudioEnabled, subscribeAudio, toggleAudio, soundFx } from '@/lib/sound';
import { toggleCrt } from '@/components/ui/crt-toggle';
export function CommandMenu({
  authenticated,
  username,
}: {
  authenticated: boolean;
  username: string | null;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const [results, setResults] = useState<Game[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const enabled = useSyncExternalStore(subscribeAudio, isAudioEnabled, () => false);
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const restoreFocus = wasOpen.current && !open;
    wasOpen.current = open;
    if (restoreFocus) {
      const frame = requestAnimationFrame(() => trigger.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);
  function changeOpen(value: boolean) {
    setOpen(value);
    setQuery('');
    setResults([]);
    setError('');
    setLoading(false);
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        !event.repeat &&
        !event.isComposing &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen((previous) => !previous);
        setQuery('');
        setResults([]);
        setError('');
        setLoading(false);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!open || query.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/catalogue?${new URLSearchParams({ q: query.trim() })}`, {
          signal: controller.signal,
        });
        const data = await readJsonResponse<{ games: Game[]; message: string | null }>(response);
        if (!controller.signal.aborted) {
          setResults(data.games.slice(0, 8));
          setError(data.message ?? '');
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'No se pudo buscar.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  function navigate(path: string) {
    soundFx.click();
    changeOpen(false);
    router.push(path);
  }
  const links: [string, string][] = [
    ['Explorar catálogo', '/explore'],
    ['Mi biblioteca', '/library'],
    ['Mis listas', '/lists'],
    ['Transmisión', '/feed'],
    ['Buscar compañeros de partida', '/parties'],
    ['Momentos Gamer', '/highlights'],
    ['Foro · SaveState Boards', '/forum'],
    [
      authenticated ? 'Mi perfil' : 'Iniciar sesión',
      authenticated
        ? username
          ? `/players/${encodeURIComponent(username)}`
          : '/settings'
        : '/login',
    ],
  ];
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="crt-toggle"
        aria-label="Buscar juegos, Control o Comando K"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          soundFx.click();
          changeOpen(true);
        }}
      >
        <Search size={16} />
        <span>Ctrl K</span>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={changeOpen}
        label="Buscar y navegar en Savestate"
        shouldFilter={false}
        loop
      >
        <h2 className="command-title">Tu próximo checkpoint</h2>
        <Command.Input
          aria-label="Buscar juegos o secciones"
          placeholder="Buscar juego o sección…"
          maxLength={80}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setResults([]);
            setError('');
            setLoading(value.trim().length >= 3);
          }}
        />
        <p className="muted command-help" role="status">
          {loading ? 'Buscando…' : '↑ ↓ elegir · Enter abrir · Esc cerrar'}
        </p>
        {error ? (
          <p role="alert" className="notice">
            {error}
          </p>
        ) : null}
        <Command.List>
          <Command.Empty>
            {loading ? 'Consultando catálogo…' : 'Sin resultados. Prueba otro nombre.'}
          </Command.Empty>
          <Command.Group heading="Navegación">
            {links
              .filter(([label]) => label.toLowerCase().includes(query.toLowerCase().trim()))
              .map(([label, path]) => (
                <Command.Item key={path} value={path} onSelect={() => navigate(path)}>
                  {label}
                </Command.Item>
              ))}
          </Command.Group>
          {query.trim().length >= 3 ? (
            <Command.Group heading="Juegos">
              {results.map((game) => (
                <Command.Item
                  key={game.id}
                  value={game.id}
                  onSelect={() => navigate(`/games/${game.slug}`)}
                >
                  {game.title}
                  <small>
                    {game.release_year ?? 'Sin fecha'} · {game.platforms.slice(0, 2).join(', ')}
                  </small>
                </Command.Item>
              ))}
              <Command.Item
                value="all-results"
                onSelect={() => navigate(`/explore?q=${encodeURIComponent(query.trim())}`)}
              >
                Ver todos los resultados en Explorar
              </Command.Item>
            </Command.Group>
          ) : null}
          {!query ? (
            <Command.Group heading="Sistema">
              <Command.Item
                value="crt"
                onSelect={() => {
                  toggleCrt();
                  changeOpen(false);
                }}
              >
                Conmutar monitor CRT
              </Command.Item>
              <Command.Item
                value="audio"
                onSelect={() => {
                  if (toggleAudio()) soundFx.click();
                }}
              >
                Sonidos retro: {enabled ? 'activados — silenciar' : 'silenciados — activar'}
              </Command.Item>
              {authenticated ? (
                <Command.Item
                  value="logout"
                  onSelect={async () => {
                    try {
                      const { error } = await browserClient().auth.signOut({ scope: 'local' });
                      if (error) throw error;
                      changeOpen(false);
                      router.push('/login');
                      router.refresh();
                    } catch {
                      setError('No se pudo cerrar sesión. Inténtalo desde Ajustes.');
                    }
                  }}
                >
                  Cerrar sesión en este dispositivo
                </Command.Item>
              ) : null}
            </Command.Group>
          ) : null}
        </Command.List>
        <button type="button" className="button secondary" onClick={() => changeOpen(false)}>
          Cerrar
        </button>
      </Command.Dialog>
    </>
  );
}
