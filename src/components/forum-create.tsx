'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ForumCategory } from '@/domain/forum';
import type { Game } from '@/domain/model';
import { ForumEditor } from './forum-editor';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
export function ForumCreate({
  categories,
  initialCategory,
  initialGame,
  toolbar,
}: {
  categories: ForumCategory[];
  initialCategory?: string;
  initialGame?: Game | null;
  toolbar?: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(initialGame)),
    [category, setCategory] = useState(initialCategory ?? categories[0]?.id ?? 'general-gaming'),
    [title, setTitle] = useState(''),
    [content, setContent] = useState(''),
    [query, setQuery] = useState(''),
    [games, setGames] = useState<Game[]>([]),
    [selected, setSelected] = useState<Game | null>(initialGame ?? null),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => {
    if (!open || query.trim().length < 3) return;
    const controller = new AbortController(),
      timer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/catalogue?q=${encodeURIComponent(query.trim())}`, {
            signal: controller.signal,
          });
          const data = await readJsonResponse<{ games: Game[] }>(response);
          if (!controller.signal.aborted) setGames(data.games.slice(0, 8));
        } catch {
          if (!controller.signal.aborted) setError('No se pudo buscar el juego.');
        }
      }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);
  return (
    <section className="forum-create">
      <div className="forum-toolbar">
        {toolbar}
        <button
          type="button"
          className="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Cerrar editor' : '+ Crear nuevo hilo'}
        </button>
      </div>
      {open ? (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            setPending(true);
            setError('');
            try {
              const result = await api<{ id: string; category_id: string }>('forum', {
                action: 'create',
                category_id: category,
                title,
                content,
                game_id: selected?.id ?? null,
              });
              router.push(`/forum/${result.category_id}/${result.id}`);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo publicar.');
            } finally {
              setPending(false);
            }
          }}
        >
          <p className="muted">Este hilo será público. Evita compartir datos personales.</p>
          <label>
            Canal
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título
            <input
              required
              minLength={3}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Juego asociado (opcional)
            <input
              maxLength={80}
              value={query}
              placeholder="Buscar en el catálogo…"
              onChange={(e) => {
                setQuery(e.target.value);
                setGames([]);
              }}
            />
          </label>
          {selected ? (
            <p>
              Juego: {selected.title}{' '}
              <button
                type="button"
                className="button outline small"
                onClick={() => setSelected(null)}
              >
                Quitar
              </button>
            </p>
          ) : null}
          <div className="tags">
            {games.map((g) => (
              <button
                className="button outline small"
                type="button"
                key={g.id}
                onClick={() => {
                  setSelected(g);
                  setGames([]);
                  setQuery('');
                }}
              >
                {g.title} ({g.release_year ?? 'sin fecha'})
              </button>
            ))}
          </div>
          <ForumEditor value={content} onChange={setContent} max={10000} />
          <button className="button" disabled={pending || content.trim().length < 5}>
            {pending ? 'Publicando…' : 'Publicar hilo'}
          </button>
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
