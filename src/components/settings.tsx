'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MutationForm, ActionButton } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import { browserClient } from '@/integrations/supabase/browser';
import type { Profile } from '@/domain/model';
import { ProfileIdentity } from '@/components/profile-identity';

export function Settings({ profile }: { profile: Profile }) {
  const [avatar, setAvatar] = useState(profile.avatar_url),
    [banner, setBanner] = useState(profile.banner_url),
    [uploadError, setUploadError] = useState(''),
    [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [terminal, setTerminal] = useState(profile.terminal_status);
  const [theme, setTheme] = useState(profile.theme_color);
  const router = useRouter();
  async function upload(file: File | undefined, kind: 'avatar' | 'banner') {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error('Selecciona PNG, JPG o WebP de hasta 10 MB.');
      const bitmap = await createImageBitmap(file);
      try {
        const max = kind === 'avatar' ? 512 : 1600,
          scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('El navegador no puede convertir imágenes.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        let blob: Blob | null = null;
        for (const quality of [0.85, 0.65, 0.45, 0.25]) {
          blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/webp', quality),
          );
          if (blob && blob.size <= 512000) break;
        }
        if (!blob || blob.type !== 'image/webp' || blob.size > 512000)
          throw new Error('La imagen no puede comprimirse a 500 KB. Prueba una más pequeña.');
        const db = browserClient();
        const path = `${profile.id}/${kind}.webp`;
        const { error } = await db.storage
          .from('profiles')
          .upload(path, blob, { contentType: 'image/webp', upsert: true, cacheControl: '0' });
        if (error) throw new Error('No se pudo subir la imagen. Revisa el bucket y sus permisos.');
        const { data } = db.storage.from('profiles').getPublicUrl(path);
        const url = `${data.publicUrl}?v=${Date.now()}`;
        if (kind === 'avatar') setAvatar(url);
        else setBanner(url);
      } finally {
        bitmap.close();
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo subir.');
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <section className={`profile-preview theme-${theme}`} aria-label="Vista previa de mi perfil">
        <ProfileIdentity
          profile={{ username, terminal_status: terminal, avatar_url: avatar, banner_url: banner }}
          headingLevel={2}
        />
        <p className="muted">Vista previa de tu perfil. Guarda para aplicar los cambios.</p>
      </section>
      <div className="panel">
        <h2>Identidad de jugador</h2>
        <MutationForm
          submit={async (form) => {
            if (uploading) throw new Error('Espera a que termine la subida.');
            const result = await api<Profile>('profile', {
              username: String(form.get('username')),
              terminal_status: String(form.get('terminal')),
              theme_color: String(form.get('theme')),
              library_private: form.get('private') === 'on',
              avatar_url: avatar,
              banner_url: banner,
              social_links: Object.fromEntries(
                ['steam', 'discord', 'twitch', 'github', 'x'].map((key) => [
                  key,
                  String(form.get(key) ?? ''),
                ]),
              ),
            });
            router.replace('/settings');
            router.refresh();
            setAvatar(result.avatar_url);
            setBanner(result.banner_url);
            setUsername(result.username);
            setTerminal(result.terminal_status);
            setTheme(result.theme_color);
          }}
        >
          <div className="form-row">
            <label>
              Nombre de usuario
              <input
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                pattern="[A-Za-z0-9_]{3,30}"
                minLength={3}
                maxLength={30}
                required
              />
            </label>
            <label>
              Color del perfil
              <select
                name="theme"
                value={theme}
                onChange={(event) => setTheme(event.target.value as Profile['theme_color'])}
              >
                <option value="cyan">Cian neón</option>
                <option value="green">Verde fósforo</option>
                <option value="pink">Magenta</option>
                <option value="amber">Ámbar</option>
              </select>
            </label>
          </div>
          <label>
            Estado de terminal
            <input
              name="terminal"
              value={terminal}
              onChange={(event) => setTerminal(event.target.value)}
              maxLength={160}
              placeholder="Playing Chrono Trigger"
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="private" defaultChecked={profile.library_private} />
            Biblioteca visible solo para amigos
          </label>
          <p className="muted">
            Incluye partidas, favoritos, reseñas y actividad de biblioteca. Seguirte no concede
            acceso. Tu nombre y avatar siguen siendo públicos.
          </p>
          <div className="form-row">
            <label>
              Avatar de galería
              <select
                value={avatar?.startsWith('/avatars/') ? avatar : ''}
                onChange={(event) => setAvatar(event.target.value || null)}
              >
                <option value="">Sin avatar de galería</option>
                {['cyan', 'green', 'pink', 'amber'].map((color) => (
                  <option value={`/avatars/${color}.svg`} key={color}>
                    Pixel {color}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subir avatar
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => upload(event.target.files?.[0], 'avatar')}
                disabled={uploading}
              />
            </label>
          </div>
          <label>
            Subir banner
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => upload(event.target.files?.[0], 'banner')}
              disabled={uploading}
            />
          </label>
          <p className="muted">
            {uploading
              ? 'Comprimiendo y subiendo…'
              : 'Se convierte a WebP y se limita a 500 KB. Guarda el perfil para aplicar la imagen.'}
          </p>
          {uploadError ? (
            <p role="alert" className="error-text">
              {uploadError}
            </p>
          ) : null}
          <div className="form-row">
            {['steam', 'discord', 'twitch', 'github', 'x'].map((key) => (
              <label key={key}>
                Enlace {key}
                <input
                  name={key}
                  type="url"
                  defaultValue={profile.social_links[key] ?? ''}
                  maxLength={300}
                  placeholder="https://…"
                />
              </label>
            ))}
          </div>
        </MutationForm>
        <Link className="text-link" href={`/players/${profile.username}`}>
          Ver mi perfil ↗
        </Link>
      </div>
      <div className="panel">
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
