'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CataloguePicker } from '@/components/catalogue-picker';
import { api } from '@/lib/client-api';
import { partyInput, PARTY_PLATFORMS, PARTY_STYLES, PARTY_STYLE_LABELS } from '@/domain/arcade';

export function PartyModal({ onCreated }: { onCreated?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    busy.current = true; setPending(true); setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const input = partyInput({
        game_id: data.get('game'), platform: data.get('platform'),
        playstyle: data.get('playstyle'), schedule: data.get('schedule'), contact_note: data.get('contact_note'),
      });
      await api('parties', { action: 'create', ...input }, controller.signal);
      if (!mounted.current) return;
      dialog.current?.close();
      setVersion(value => value + 1);
      onCreated?.();
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'No se pudo publicar.');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return <>
    <button type="button" ref={trigger} className="button" aria-haspopup="dialog" onClick={() => {
      setError(''); dialog.current?.showModal();
    }}>+ Publicar Convocatoria</button>
    <dialog ref={dialog} className="party-dialog panel" aria-labelledby={id + '-title'} aria-describedby={id + '-help'}
      onClose={() => trigger.current?.focus()}>
      <h2 id={id + '-title'}>Busco compañero de partida</h2>
      <p id={id + '-help'} className="muted">Visible durante 48 horas. Usa un alias de contacto y evita datos personales. Escape cierra este diálogo.</p>
      <form onSubmit={create} key={version} className="form-stack">
        <fieldset disabled={pending}>
          <legend className="sr-only">Datos de la convocatoria</legend>
          <CataloguePicker games={[]} />
          <div className="form-row">
            <label htmlFor={id + '-platform'}>Plataforma
              <select id={id + '-platform'} name="platform" required>{PARTY_PLATFORMS.map(value => <option key={value}>{value}</option>)}</select>
            </label>
            <label htmlFor={id + '-style'}>Estilo
              <select id={id + '-style'} name="playstyle" required>{PARTY_STYLES.map(value =>
                <option key={value} value={value}>{PARTY_STYLE_LABELS[value]}</option>)}</select>
            </label>
          </div>
          <label htmlFor={id + '-schedule'}>Horario disponible
            <input id={id + '-schedule'} name="schedule" required minLength={3} maxLength={100} placeholder="Viernes 21:00, GMT-3" />
          </label>
          <label htmlFor={id + '-contact'}>Nota de contacto
            <textarea id={id + '-contact'} name="contact_note" required minLength={3} maxLength={500} rows={3} placeholder="Buscamos 2 para una raid. Discord: @player" />
          </label>
        </fieldset>
        {error ? <p role="alert" className="error-text">{error}</p> : null}
        <div className="inline-actions">
          <button type="submit" className="button" disabled={pending}>{pending ? 'Publicando…' : 'Publicar convocatoria'}</button>
          <button type="button" className="button outline" onClick={() => dialog.current?.close()}>Cerrar</button>
        </div>
        {pending ? <p role="status" className="muted">El envío en curso continuará aunque cierres el diálogo.</p> : null}
      </form>
    </dialog>
  </>;
}
