'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { MutationForm } from '@/components/ui/form';
import { safeNext } from '@/domain/validation';
export function AuthForm({ configured, reset = false }: { configured: boolean; reset?: boolean }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'recover' | 'reset'>(
    reset ? 'reset' : 'signin',
  );
  const [notice, setNotice] = useState(''),
    [oauthError, setOauthError] = useState(''),
    [pending, setPending] = useState(false);
  const router = useRouter();
  async function oauth(provider: 'discord' | 'google') {
    setPending(true);
    setOauthError('');
    try {
      const { error } = await browserClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setOauthError('No se pudo iniciar el acceso externo. Revisa la configuración del proveedor.');
      setPending(false);
    }
  }
  return (
    <div className="panel auth-panel">
      <p className="eyebrow">PLAYER AUTHENTICATION</p>
      <h1>{mode === 'reset' ? 'Nueva contraseña' : 'Conecta tu partida.'}</h1>
      <p className="muted">Un lugar para todas tus aventuras.</p>
      {!reset ? (
        <div className="auth-tabs">
          {(
            [
              ['signin', 'Entrar'],
              ['signup', 'Registrarse'],
              ['recover', 'Recuperar'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setNotice('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <MutationForm
        label={
          mode === 'signup'
            ? 'Crear cuenta'
            : mode === 'recover'
              ? 'Enviar enlace'
              : mode === 'reset'
                ? 'Actualizar contraseña'
                : 'Iniciar sesión'
        }
        submit={async (form) => {
          if (!configured) throw new Error('Supabase aún no está configurado.');
          const db = browserClient();
          const email = String(form.get('email') ?? '').trim(),
            password = String(form.get('password') ?? '');
          if (mode === 'recover') {
            const { error } = await db.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });
            if (error) throw new Error('No se pudo enviar el enlace. Inténtalo más tarde.');
            setNotice('Si existe una cuenta para ese correo, recibirás las instrucciones.');
            return;
          }
          if (mode === 'signup') {
            const status = await fetch('/api/system-status', { cache: 'no-store' });
            if (!status.ok)
              throw new Error(
                'No se pudo verificar si el registro está abierto. Inténtalo de nuevo.',
              );
            if (!(await status.json()).switches.registrations_open)
              throw new Error('El registro de nuevos usuarios está cerrado temporalmente.');
            const { error } = await db.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error)
              throw new Error('No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.');
            setNotice('Revisa tu correo para confirmar tu cuenta.');
            return;
          }
          const { error } =
            mode === 'reset'
              ? await db.auth.updateUser({ password })
              : await db.auth.signInWithPassword({ email, password });
          if (error)
            throw new Error(
              mode === 'reset'
                ? 'No se pudo actualizar la contraseña. Solicita un nuevo enlace.'
                : 'Correo o contraseña incorrectos.',
            );
          const next = safeNext(new URLSearchParams(window.location.search).get('next'));
          router.push(mode === 'reset' ? '/settings' : next);
          router.refresh();
        }}
      >
        {mode !== 'reset' ? (
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={!configured}
            />
          </label>
        ) : null}
        {mode !== 'recover' ? (
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={mode === 'signin' ? 1 : 12}
              maxLength={128}
              required
              disabled={!configured}
            />
          </label>
        ) : null}
        {mode === 'signup' || mode === 'reset' ? (
          <p className="muted">Usa al menos 12 caracteres.</p>
        ) : null}
      </MutationForm>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      {mode === 'signin' || mode === 'signup' ? (
        <div className="oauth-buttons">
          <button
            className="button secondary"
            type="button"
            disabled={!configured || pending}
            onClick={() => oauth('discord')}
          >
            Discord ↗
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!configured || pending}
            onClick={() => oauth('google')}
          >
            Google ↗
          </button>
        </div>
      ) : null}
      {oauthError ? (
        <p role="alert" className="error-text">
          {oauthError}
        </p>
      ) : null}
    </div>
  );
}
