'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
export function ForumEditor({
  value,
  onChange,
  max = 8000,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  const [preview, setPreview] = useState(false),
    [html, setHtml] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (!preview || !value.trim()) return;
    let disposed = false;
    const timer = setTimeout(() => {
      void api<{ html: string }>('forum', { action: 'preview', content: value })
        .then((result) => {
          if (!disposed) {
            setHtml(result.html);
            setError('');
          }
        })
        .catch(() => {
          if (!disposed) setError('No se pudo generar la vista previa.');
        });
    }, 300);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [preview, value]);
  return (
    <div className="forum-editor">
      <label>
        Mensaje
        <textarea
          required
          value={value}
          maxLength={max}
          minLength={1}
          onChange={(e) => {
            onChange(e.target.value);
            setHtml('');
          }}
          rows={7}
        />
      </label>
      <p className="muted">
        Markdown: **negrita**, `código`, enlaces y ||spoilers||. {value.length}/{max}
      </p>
      <button
        type="button"
        className="button outline small"
        aria-expanded={preview}
        onClick={() => setPreview((v) => !v)}
      >
        {preview ? 'Ocultar vista previa' : 'Vista previa'}
      </button>
      {preview ? (
        <div className="review-body panel" aria-label="Vista previa del mensaje">
          {value.trim() ? (
            html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p role="status">Preparando vista previa…</p>
            )
          ) : (
            <p>Escribe un mensaje.</p>
          )}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
