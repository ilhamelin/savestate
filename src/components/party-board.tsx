'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CataloguePicker } from '@/components/catalogue-picker';
import { api } from '@/lib/client-api';
import {
  PARTY_PLATFORMS,
  PARTY_STYLES,
  PARTY_STYLE_LABELS,
  remainingPartyTime,
  type PartyCardData,
} from '@/domain/arcade';
export function PartyComposer() {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const id = useId(),
    router = useRouter();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api('parties', {
        action: 'create',
        game_id: data.get('game'),
        platform: data.get('platform'),
        playstyle: data.get('playstyle'),
        schedule: data.get('schedule'),
        contact_note: data.get('contact_note'),
      });
      dialog.current?.close();
      setVersion((n) => n + 1);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo publicar.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="button"
        onClick={() => {
          setError('');
          dialog.current?.showModal();
        }}
      >
        Crear convocatoria
      </button>
      <dialog
        ref={dialog}
        className="party-dialog panel"
        aria-labelledby={id}
        onCancel={(event) => {
          if (busy.current) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={id}>Busco compañero de partida</h2>
        <p className="muted">
          Visible para todos durante 48 horas. Usa un alias de contacto y evita compartir datos
          personales.
        </p>
        <form method="post" onSubmit={create} key={version} className="form-stack">
          <fieldset disabled={pending}>
            <CataloguePicker games={[]} />
            <div className="form-row">
              <label>
                Plataforma
                <select name="platform">
                  {PARTY_PLATFORMS.map((platform) => (
                    <option key={platform}>{platform}</option>
                  ))}
                </select>
              </label>
              <label>
                Estilo
                <select name="playstyle">
                  {PARTY_STYLES.map((style) => (
                    <option value={style} key={style}>
                      {PARTY_STYLE_LABELS[style]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Horario disponible
              <input
                name="schedule"
                required
                minLength={3}
                maxLength={100}
                placeholder="Viernes 21:00, GMT-3"
              />
            </label>
            <label>
              Nota de contacto
              <textarea
                name="contact_note"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                placeholder="Buscamos 2 para una raid. Discord: @player"
              />
            </label>
          </fieldset>
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
          <div className="inline-actions">
            <button className="button" disabled={pending}>
              {pending ? 'Publicando…' : 'Publicar convocatoria'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
export function PartyBoard({
  items,
  viewerId,
  generatedAt,
}: {
  items: PartyCardData[];
  viewerId: string | null;
  generatedAt: number;
}) {
  const [now, setNow] = useState(generatedAt),
    [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState('');
  const busy = useRef(false),
    router = useRouter();
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 30000);
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(id);
    setError('');
    try {
      await api('parties', { action: 'delete', id });
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo retirar.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  const currentTime = Math.max(now, generatedAt);
  const visible = items.filter((item) => Date.parse(item.expires_at) > currentTime);
  return (
    <>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      {!visible.length ? (
        <div className="empty-state">
          No hay convocatorias activas con estos filtros. ¡Abre la próxima partida!
        </div>
      ) : null}
      <div className="party-grid">
        {visible.map((item) => (
          <article key={item.id} className="party-card panel">
            <div className="party-game">
              <Link href={`/games/${item.game.slug}`} className="party-cover">
                {item.game.cover_url ? (
                  <Image src={item.game.cover_url} alt={item.game.title} fill sizes="80px" />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}
              </Link>
              <div>
                <h2>
                  <Link href={`/games/${item.game.slug}`}>{item.game.title}</Link>
                </h2>
                <div className="tags">
                  <span className="tag">{item.platform}</span>
                  <span className="tag">{PARTY_STYLE_LABELS[item.playstyle]}</span>
                </div>
              </div>
            </div>
            <Link className="party-author text-link" href={`/players/${item.author.username}`}>
              {item.author.avatar_url ? (
                <Image src={item.author.avatar_url} alt="" width={32} height={32} unoptimized />
              ) : (
                <span aria-hidden="true">▣</span>
              )}{' '}
              @{item.author.username}
            </Link>
            <p>
              <strong>Horario:</strong> {item.schedule}
            </p>
            <p className="party-note">{item.contact_note}</p>
            <div className="inline-actions">
              <span className="tag">{remainingPartyTime(item.expires_at, currentTime)}</span>
              {viewerId === item.user_id ? (
                <button
                  className="button secondary small"
                  disabled={pending !== null}
                  onClick={() => void remove(item.id)}
                >
                  {pending === item.id ? 'Retirando…' : 'Retirar convocatoria'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
