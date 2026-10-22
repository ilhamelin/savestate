'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { SUPPORT_CATEGORIES, type SupportTicketType, type SupportTicketCreated } from '@/domain/support-ticket';

export function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SupportTicketType>('bug');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<SupportTicketCreated | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    else if (!open && node?.open) node.close();
  }, [open]);
  return <>
    <button type="button" className="button outline small" onClick={() => setOpen(true)}>
      👾 Reportar bug / Sugerir juego
    </button>
    <dialog ref={dialog} className="support-feedback-dialog" aria-labelledby={titleId}
      onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="support-feedback-content">
        <header className="support-feedback-header">
          <div><p className="eyebrow">COMMUNITY SUPPORT // SAVESTATE</p><h2 id={titleId}>Transmitir un reporte</h2></div>
          <button type="button" className="button outline small" onClick={() => setOpen(false)} aria-label="Cerrar reporte">✕</button>
        </header>
        {result ? <div role="status" className="support-success">
          <strong>✓ {result.ticketId}</strong>
          <p>{result.message}</p>
          {result.jiraUrl && <a href={result.jiraUrl} target="_blank" rel="noopener noreferrer">Ver ticket en Jira ↗</a>}
          <button type="button" className="button outline small" onClick={() => { setResult(null); setNotice(''); }}>Nuevo reporte</button>
        </div> : <form onSubmit={async (event) => {
          event.preventDefault();
          if (sending.current) return;
          sending.current = true;
          setBusy(true); setNotice('');
          const data = new FormData(event.currentTarget);
          try {
            const response = await fetch('/api/support/tickets', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type, title: data.get('title'), description: data.get('description'),
                contactEmail: data.get('email') || null, pageUrl: window.location.pathname,
                systemContext: { userAgent: navigator.userAgent.slice(0,300),
                  screenResolution: window.innerWidth + '×' + window.innerHeight },
              }),
              signal: AbortSignal.timeout(20000),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'No se pudo transmitir el reporte.');
            setResult(payload.data);
          } catch (error) {
            setNotice(error instanceof Error && error.name === 'TimeoutError'
              ? 'La respuesta tardó demasiado. El reporte puede haberse guardado; comprueba antes de reenviarlo.'
              : error instanceof Error ? error.message : 'Sin conexión al canal de soporte.');
          } finally { sending.current = false; setBusy(false); }
        }}>
          <fieldset disabled={busy}><legend>Categoría</legend><div className="filter-buttons">
            {SUPPORT_CATEGORIES.map(([id, label]) => <button key={id} type="button"
              className="button outline small" aria-pressed={type === id} onClick={() => setType(id)}>{label}</button>)}
          </div></fieldset>
          <label>Título<input name="title" required minLength={5} maxLength={200} disabled={busy} autoComplete="off" /></label>
          <label>Detalle<textarea name="description" required minLength={10} maxLength={8000} rows={5} disabled={busy} /></label>
          <label>Correo de contacto (opcional)<input name="email" type="email" maxLength={254} disabled={busy} autoComplete="email" /></label>
          <p className="muted">Enviaremos el texto, la ruta y datos básicos del navegador al Portal de soporte y Jira. No incluyas contraseñas, claves ni datos sensibles.</p>
          <button type="submit" className="button" disabled={busy}>{busy ? 'Transmitiendo…' : 'Transmitir ticket →'}</button>
          {notice && <p role="alert" className="notice">{notice}</p>}
        </form>}
      </div>
    </dialog>
  </>;
}
