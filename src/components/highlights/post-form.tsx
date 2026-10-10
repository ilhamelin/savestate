'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CataloguePicker } from '@/components/catalogue-picker';
import { CATEGORY_LABELS, POST_CATEGORIES, youtubeId, type Post } from '@/domain/highlights';
import { api } from '@/lib/client-api';
import { browserClient } from '@/integrations/supabase/browser';
import { highlightImage } from '@/lib/highlight-image';

export function PostForm({
  userId,
  initialPost,
  onDone,
  initialDraft,
  initialTitle,
}: {
  userId: string;
  initialPost?: Post;
  onDone?: () => void;
  initialDraft?: string;
  initialTitle?: string;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  const [media, setMedia] = useState<Post['media_type']>(initialPost?.media_type ?? 'none');
  const [retained, setRetained] = useState(initialPost?.image_urls ?? []);
  const router = useRouter();
  const attempt = useRef<{ id: string; paths: string[] } | null>(null);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget,
      data = new FormData(form),
      video = initialPost && media !== 'youtube' ? '' : String(data.get('youtube') ?? '');
    setPending(true);
    setMessage('');
    try {
      youtubeId(video);
      const kept = initialPost && media === 'images' ? retained : [];
      const uploads = initialPost && media !== 'images' ? [] : files;
      if (uploads.length + kept.length > 4)
        throw new Error('Selecciona hasta cuatro capturas en total.');
      if (video && uploads.length) throw new Error('Elige un video o capturas, no ambos.');
      attempt.current ??= { id: initialPost?.id ?? crypto.randomUUID(), paths: [] };
      const { id, paths } = attempt.current;
      const db = browserClient();
      for (const file of uploads.slice(paths.length)) {
        const blob = await highlightImage(file),
          path = `${userId}/${id}/${crypto.randomUUID()}.webp`;
        const result = await db.storage
          .from('highlights')
          .upload(path, blob, { contentType: 'image/webp', upsert: false, cacheControl: '0' });
        if (result.error) throw new Error('No se pudo subir la captura. Inténtalo de nuevo.');
        paths.push(path);
      }
      await api('highlights', {
        action: initialPost ? 'update' : 'create',
        id,
        expected_updated_at: initialPost?.updated_at,
        title: String(data.get('title')),
        content: String(data.get('content') ?? ''),
        category: String(data.get('category')),
        game_id: initialPost ? initialPost.game_id : String(data.get('game') ?? ''),
        youtube_url: video,
        image_urls: [...kept, ...(initialPost && media !== 'images' ? [] : paths)],
        is_private: data.get('private') === 'on',
      });
      form.reset();
      attempt.current = null;
      setFiles([]);
      setVersion((value) => value + 1);
      setMessage(initialPost ? 'Cambios guardados.' : 'Momento publicado.');
      setError(false);
      router.refresh();
      onDone?.();
    } catch (error) {
      setError(true);
      setMessage(error instanceof Error ? error.message : 'No se pudo publicar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="panel" open={initialPost || initialDraft ? true : undefined}>
      <summary className="accent">
        {initialPost ? 'Editar momento' : '+ Compartir un momento'}
      </summary>
      <form method="post" onSubmit={publish} className="form-stack highlight-form">
        <fieldset disabled={pending}>
          <label>
            Título
            <input
              name="title"
              minLength={3}
              maxLength={120}
              required
              defaultValue={initialPost?.title ?? initialTitle}
            />
          </label>
          <label>
            Categoría
            <select name="category" defaultValue={initialPost?.category}>
              {POST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción (Markdown)
            <textarea
              name="content"
              maxLength={5000}
              rows={5}
              defaultValue={initialPost?.content ?? initialDraft}
            />
          </label>
          {!initialPost ? (
            <>
              <p className="muted">
                Juego relacionado (opcional). Deja la selección vacía para publicar sin juego.
              </p>
              <CataloguePicker key={version} games={[]} required={false} />
            </>
          ) : null}
          {initialPost ? (
            <label>
              Multimedia
              <select
                value={media}
                onChange={(event) => {
                  setMedia(event.target.value as Post['media_type']);
                  attempt.current = null;
                  setFiles([]);
                }}
              >
                <option value="none">Sin multimedia</option>
                <option value="images">Capturas</option>
                <option value="youtube">YouTube</option>
              </select>
            </label>
          ) : null}
          {!initialPost || media === 'youtube' ? (
            <label>
              Video de YouTube o Shorts
              <input
                name="youtube"
                type="url"
                maxLength={500}
                placeholder="https://youtu.be/..."
                required={Boolean(initialPost && media === 'youtube')}
                defaultValue={
                  initialPost?.youtube_video_id
                    ? `https://youtu.be/${initialPost.youtube_video_id}`
                    : ''
                }
              />
            </label>
          ) : null}
          {initialPost && media === 'images' ? (
            <div>
              <p className="muted">Conservar capturas actuales:</p>
              {initialPost.image_urls.map((path, index) => (
                <label className="checkbox" key={path}>
                  <input
                    type="checkbox"
                    checked={retained.includes(path)}
                    onChange={(event) => {
                      setRetained((previous) =>
                        event.target.checked
                          ? [...previous, path]
                          : previous.filter((item) => item !== path),
                      );
                    }}
                  />{' '}
                  Captura {index + 1}
                </label>
              ))}
            </div>
          ) : null}
          {!initialPost || media === 'images' ? (
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
          ) : null}
          {files.length ? (
            <p className="muted">{files.map((file) => file.name).join(' · ')}</p>
          ) : null}
          <p className="muted">Las capturas se convierten a WebP, hasta 1 MB cada una.</p>
          <label className="checkbox">
            <input type="checkbox" name="private" defaultChecked={initialPost?.is_private} />
            Solo yo
          </label>
          <p className="muted">
            Los demás momentos respetan la privacidad de tu biblioteca: pública o solo amigos.
          </p>
        </fieldset>
        <div className="form-footer">
          <button className="button" disabled={pending}>
            {pending ? 'Guardando…' : initialPost ? 'Guardar cambios' : 'Publicar momento'}
          </button>
          {onDone ? (
            <button type="button" className="button outline" disabled={pending} onClick={onDone}>
              Cancelar
            </button>
          ) : null}
          <p className={error ? 'error-text' : 'muted'} role={error ? 'alert' : 'status'}>
            {message}
          </p>
        </div>
      </form>
    </details>
  );
}
