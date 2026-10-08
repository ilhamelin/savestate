'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ActionButton } from '@/components/ui/form';
import { browserClient } from '@/integrations/supabase/browser';
import type { Profile } from '@/domain/model';
import { ProfileStudio } from '@/components/profile-studio';
import { AudioToggle } from '@/components/ui/audio-toggle';
export function Settings({ profile }: { profile: Profile }) {
  const router = useRouter();
  return (
    <>
      <ProfileStudio profile={profile} />
      <div className="panel">
        <h2>Accesibilidad y sonido</h2>
        <p className="muted">Los sonidos retro son opcionales y se guardan en este navegador.</p>
        <AudioToggle />
        <h2>Seguridad y sesiones</h2>
        <Link className="accent" href="/login">
          Recuperar contraseña por correo →
        </Link>
        <div className="inline-actions" style={{ marginTop: 20 }}>
          <ActionButton
            action={async () => {
              const { error } = await browserClient().auth.signOut({ scope: 'local' });
              if (error) throw new Error('No se pudo cerrar la sesión.');
              router.push('/');
              router.refresh();
            }}
          >
            Cerrar esta sesión
          </ActionButton>
          <ActionButton
            danger
            action={async () => {
              const { error } = await browserClient().auth.signOut({ scope: 'global' });
              if (error) throw new Error('No se pudieron revocar las sesiones.');
              router.push('/');
              router.refresh();
            }}
          >
            Cerrar todas las sesiones
          </ActionButton>
        </div>
        <p className="muted">
          Al revocar sesiones, los tokens de acceso ya emitidos caducan según el plazo configurado
          en Supabase.
        </p>
      </div>
    </>
  );
}
