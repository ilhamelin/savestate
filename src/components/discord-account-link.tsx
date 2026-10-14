'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserIdentity } from '@supabase/supabase-js';
import { browserClient } from '@/integrations/supabase/browser';

export function DiscordAccountLink({ next = '/settings' }: { next?: '/settings' | '/chat' }) {
  const router = useRouter();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const load = async () => {
      try {
        const db = browserClient();
        const { data, error } = await db.auth.getUser();
        if (error) throw error;
        if (active) setIdentities(data.user?.identities ?? []);
      } catch {
        if (active) {
          setMessage('No se pudieron consultar tus cuentas. Recarga para reintentar.');
          setFailed(true);
        }
      }
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      void load();
      try {
        const { data } = browserClient().auth.onAuthStateChange(() => {
          // Leave the auth callback before querying the session again.
          setTimeout(() => {
            if (active) void load();
          }, 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        /* load() reports unavailable auth. */
      }
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  const discord = identities?.find((identity) => identity.provider === 'discord');
  const name = discord?.identity_data?.full_name ?? discord?.identity_data?.name ?? 'Discord';
  const avatar = discord?.identity_data?.avatar_url;
  const safeAvatar =
    typeof avatar === 'string' &&
    /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//.test(avatar)
      ? avatar
      : null;
  async function change() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      const db = browserClient();
      if (discord) {
        const { error } = await db.auth.unlinkIdentity(discord);
        if (error) throw error;
        const { data, error: refreshError } = await db.auth.getUser();
        if (refreshError) throw refreshError;
        setIdentities(data.user?.identities ?? []);
        setMessage('Cuenta de Discord desvinculada.');
        router.refresh();
      } else {
        const { error } = await db.auth.linkIdentity({
          provider: 'discord',
          options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
        });
        if (error) throw error;
      }
    } catch (error) {
      setFailed(true);
      const code = typeof error === 'object' && error && 'code' in error ? error.code : '';
      setMessage(
        code === 'manual_linking_disabled'
          ? 'Activa Enable Manual Linking en la configuración de autenticación de Supabase.'
          : error instanceof Error
            ? error.message
            : 'No se pudo actualizar la vinculación.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel discord-account-link">
      <p className="eyebrow">IDENTITY LINK // DISCORD</p>
      <h2>Cuentas Vinculadas</h2>
      <p className="muted">Asocia tu identidad para verificar tus permisos del canal privado.</p>
      {discord && (
        <div className="discord-linked-identity">
          {safeAvatar && <Image src={safeAvatar} alt="" width={36} height={36} unoptimized />}
          <span>✅ Discord Vinculado · {String(name)}</span>
        </div>
      )}
      <button
        type="button"
        className="button outline"
        disabled={busy || identities === null || Boolean(discord && identities.length < 2)}
        onClick={() => void change()}
      >
        {busy ? 'Procesando…' : discord ? 'Desvincular' : '🔗 Vincular cuenta de Discord'}
      </button>
      {discord && identities && identities.length < 2 && (
        <p className="muted">Añade otro método de acceso antes de desvincular Discord.</p>
      )}
      {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    </section>
  );
}
