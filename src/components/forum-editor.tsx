'use client';
import { useEffect, useRef, useState } from 'react';
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
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!preview || !value.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<{ html: string }>('forum', { action: 'preview', content: value }, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setHtml(result.html);
            setError('');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('No se pudo generar la vista previa.');
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [preview, value]);
  function format(kind: string) {
    const field = textarea.current;
    if (!field || preview) return;
    const start = field.selectionStart,
      end = field.selectionEnd,
      selection = value.slice(start, end);
    const wrappers: Record<string, [string, string, string]> = {
      bold: ['**', '**', 'texto'],
      italic: ['*', '*', 'texto'],
      code: ['`', '`', 'código'],
      spoiler: ['||', '||', 'spoiler'],
      link: ['[', '](https://)', 'texto'],
    };
    const wrapper = wrappers[kind];
    let inserted: string, selectionStart: number, selectionEnd: number;
    if (wrapper) {
      const body = selection || wrapper[2];
      inserted = wrapper[0] + body + wrapper[1];
      selectionStart = start + wrapper[0].length;
      selectionEnd = selectionStart + body.length;
    } else {
      const prefix = kind === 'heading' ? '## ' : kind === 'quote' ? '> ' : '- ',
        body =
          selection || (kind === 'heading' ? 'Subtítulo' : kind === 'quote' ? 'Cita' : 'elemento');
      const breakBefore = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
      inserted =
        breakBefore +
        body
          .split('\n')
          .map((line) => prefix + line)
          .join('\n') +
        (end < value.length && value[end] !== '\n' ? '\n' : '');
      selectionStart = start + breakBefore.length + prefix.length;
      selectionEnd = start + inserted.length;
    }
    const next = value.slice(0, start) + inserted + value.slice(end);
    if (next.length > max) {
      setError('El formato supera el límite de caracteres.');
      return;
    }
    onChange(next);
    setHtml('');
    setError('');
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(selectionStart, selectionEnd);
    });
  }
  const tools = [
    ['bold', 'B', 'Negrita (Ctrl+B / Cmd+B)'],
    ['italic', 'I', 'Cursiva (Ctrl+I / Cmd+I)'],
    ['heading', 'H2', 'Subtítulo'],
    ['code', '<>', 'Código'],
    ['quote', '❝', 'Cita'],
    ['spoiler', '👁️ Spoiler', 'Ocultar spoiler'],
    ['link', '🔗 Enlace', 'Insertar enlace'],
    ['list', '• Lista', 'Lista'],
  ] as const;
  return (
    <div className="forum-editor">
      <div className="forum-editor-toolbar">
        <div className="forum-editor-modes" role="group" aria-label="Modo del editor">
          <button
            type="button"
            className={'button outline small ' + (!preview ? 'is-active' : '')}
            aria-pressed={!preview}
            onClick={() => {
              setPreview(false);
              setError('');
            }}
          >
            ✍️ Escribir
          </button>
          <button
            type="button"
            className={'button outline small ' + (preview ? 'is-active' : '')}
            aria-pressed={preview}
            onClick={() => {
              setPreview(true);
              setHtml('');
              setError('');
            }}
          >
            👁️ Vista previa
          </button>
        </div>
        <div className="forum-format-buttons" role="group" aria-label="Formato Markdown">
          {tools.map(([kind, label, title]) => (
            <button
              key={kind}
              type="button"
              className="button outline small"
              title={title}
              aria-label={title}
              disabled={preview}
              onClick={() => format(kind)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!preview ? (
        <label>
          Mensaje
          <textarea
            ref={textarea}
            required
            value={value}
            maxLength={max}
            minLength={1}
            onChange={(e) => {
              onChange(e.target.value);
              setHtml('');
              setError('');
            }}
            onKeyDown={(e) => {
              if (
                (e.ctrlKey || e.metaKey) &&
                !e.altKey &&
                ['b', 'i'].includes(e.key.toLowerCase())
              ) {
                e.preventDefault();
                format(e.key.toLowerCase() === 'b' ? 'bold' : 'italic');
              }
            }}
            rows={7}
          />
        </label>
      ) : null}
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
      <div className="forum-editor-footer">
        <span className="muted">Markdown: **negrita**, `código`, enlaces y ||spoilers||.</span>
        <span aria-label="Caracteres usados">
          {value.length} / {max}
        </span>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
