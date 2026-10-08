'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CataloguePicker } from '@/components/catalogue-picker';
import { CATEGORY_LABELS, POST_CATEGORIES, youtubeId } from '@/domain/highlights';
import { api } from '@/lib/client-api';
import { browserClient } from '@/integrations/supabase/browser';
import { highlightImage } from '@/lib/highlight-image';

export function PostForm({ userId }: { userId: string }) {
  const [files, setFiles] = useState<File[]>([]),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  const router = useRouter();
  const attempt = useRef<{ id: string; paths: string[] } | null>(null);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget,
      data = new FormData(form),
      video = String(data.get('youtube') ?? '');
    setPending(true);
    setMessage('');
    try {
      youtubeId(video);
      if (files.length > 4) throw new Error('Selecciona hasta cuatro capturas.');
      if (video && files.length) throw new Error('Elige un video o capturas, no ambos.');
      attempt.current ??= { id: crypto.randomUUID(), paths: [] };
      const { id, paths } = attempt.current;
      const db = browserClient();
      for (const file of files.slice(paths.length)) {
        const blob = await highlightImage(file),
          path = `${userId}/${id}/${crypto.randomUUID()}.webp`;
        const result = await db.storage
          .from('highlights')
          .upload(path, blob, { contentType: 'image/webp', upsert: false, cacheControl: '0' });
        if (result.error) throw new Error('No se pudo subir la captura. Inténtalo de nuevo.');
        paths.push(path);
      }
      await api('highlights', {
        action: 'create',
        id,
        title: String(data.get('title')),
        content: String(data.get('content') ?? ''),
        category: String(data.get('category')),
        game_id: String(data.get('game') ?? ''),
        youtube_url: video,
        image_urls: paths,
        is_private: data.get('private') === 'on',
      });
      form.reset();
      attempt.current = null;
      setFiles([]);
      setVersion((value) => value + 1);
      setMessage('Momento publicado.');
      setError(false);
      router.refresh();
    } catch (error) {
      setError(true);
      setMessage(error instanceof Error ? error.message : 'No se pudo publicar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="panel">
      <summary className="accent">+ Compartir un momento</summary>
      <form method="post" onSubmit={publish} className="form-stack highlight-form">
        <fieldset disabled={pending}>
          <label>
            Título
            <input name="title" minLength={3} maxLength={120} required />
          </label>
          <label>
            Categoría
            <select name="category">
              {POST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción (Markdown)
            <textarea name="content" maxLength={5000} rows={5} />
          </label>
          <p className="muted">
            Juego relacionado (opcional). Deja la selección vacía para publicar sin juego.
          </p>
          <CataloguePicker key={version} games={[]} required={false} />
          <label>
            Video de YouTube o Shorts
            <input name="youtube" type="url" maxLength={500} placeholder="https://youtu.be/..." />
          </label>
          <label>
            O capturas (hasta 4)
            <input
              name="captures"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => {
                attempt.current = null;
                setFiles(Array.from(event.target.files ?? []));
              }}
            />
          </label>
          {files.length ? (
            <p className="muted">{files.map((file) => file.name).join(' · ')}</p>
          ) : null}
          <p className="muted">Las capturas se convierten a WebP, hasta 1 MB cada una.</p>
          <label className="checkbox">
            <input type="checkbox" name="private" />
            Solo yo
          </label>
          <p className="muted">
            Los demás momentos respetan la privacidad de tu biblioteca: pública o solo amigos.
          </p>
        </fieldset>
        <div className="form-footer">
          <button className="button" disabled={pending}>
            {pending ? 'Publicando…' : 'Publicar momento'}
          </button>
          <p className={error ? 'error-text' : 'muted'} role={error ? 'alert' : 'status'}>
            {message}
          </p>
        </div>
      </form>
    </details>
  );
}
