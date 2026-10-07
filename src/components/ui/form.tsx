'use client';
import { useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
export function MutationForm({
  children,
  submit,
  label = 'Guardar',
  className = '',
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false);
  const router = useRouter();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage('');
    try {
      await submit(data);
      setError(false);
      setMessage('Guardado.');
      router.refresh();
    } catch (error) {
      setError(true);
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className={`form-stack ${className}`}>
      <fieldset disabled={pending}>{children}</fieldset>
      <div className="form-footer">
        <button className="button" disabled={pending}>
          {pending ? 'Procesando…' : label}
        </button>
        <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'muted'}>
          {message}
        </p>
      </div>
    </form>
  );
}
export function ActionButton({
  action,
  children,
  danger = false,
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  danger?: boolean;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  return (
    <span className="action-wrapper">
      <button
        type="button"
        className={`button ${danger ? 'danger' : 'secondary'}`}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            await action();
            router.refresh();
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Error al guardar.');
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? '…' : children}
      </button>
      {error ? (
        <span role="alert" className="error-text">
          {error}
        </span>
      ) : null}
    </span>
  );
}
