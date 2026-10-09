'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Monitor, Smartphone, Save, Undo2 } from 'lucide-react';
import type { Profile, Theme } from '@/domain/model';
import {
  PROFILE_COLORS,
  QUICK_STATUSES,
  SOCIAL_KEYS,
  profileChanged,
  profileDraft,
  type DraftProfile,
} from '@/domain/profile-studio';
import { ProfileIdentity } from '@/components/profile-identity';
import { GamerRoom } from '@/components/gamer-room';
import { ROOM_THEMES, ROOM_LABELS, roomTheme } from '@/domain/arcade';
import { browserClient } from '@/integrations/supabase/browser';
import { profileImage } from '@/lib/profile-image';
import { api } from '@/lib/client-api';
import { username, text, socialLinks } from '@/domain/validation';
import { HardwareSelector } from '@/components/hardware-selector';
import { ownedPlatforms } from '@/domain/hardware';
import { WALLPAPERS } from '@/domain/wallpaper';
import { ProfileWallpaper } from '@/components/profile-wallpaper';
import {
  PLAYER_TITLES,
  AVATAR_FRAMES,
  equippedRewards,
  type PlayerTitle,
  type AvatarFrame,
} from '@/domain/progression';

type Media = 'avatar' | 'banner' | 'wallpaper';
const MEDIA_KEYS = {
  avatar: 'avatar_url',
  banner: 'banner_url',
  wallpaper: 'wallpaper_url',
} as const;
export function ProfileStudio({ profile }: { profile: Profile }) {
  const [saved, setSaved] = useState(() => profileDraft(profile));
  const [draft, setDraft] = useState(() => profileDraft(profile));
  const [mobile, setMobile] = useState(false),
    [preparing, setPreparing] = useState(false),
    [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''),
    [error, setError] = useState(false);
  const form = useRef<HTMLFormElement>(null),
    avatarInput = useRef<HTMLInputElement>(null),
    bannerInput = useRef<HTMLInputElement>(null),
    wallpaperInput = useRef<HTMLInputElement>(null);
  const pendingMedia = useRef<Partial<Record<Media, Blob>>>({});
  const previews = useRef<Partial<Record<Media, string>>>({});
  const busy = useRef(false),
    id = useId(),
    router = useRouter();
  const alive = useRef(true);
  const isDirty = profileChanged(draft, saved);
  function update<K extends keyof DraftProfile>(key: K, value: DraftProfile[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setMessage('');
  }
  function clearMedia(kind: Media) {
    const url = previews.current[kind];
    if (url) URL.revokeObjectURL(url);
    delete previews.current[kind];
    delete pendingMedia.current[kind];
  }
  useEffect(() => {
    alive.current = true;
    const urls = previews.current;
    return () => {
      alive.current = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (isDirty && !busy.current) form.current?.requestSubmit();
      }
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    function navigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const target = new URL(link.href);
      if (
        target.origin === location.origin &&
        target.pathname === location.pathname &&
        target.search === location.search
      )
        return;
      if (!window.confirm('Tienes cambios de perfil sin guardar. ¿Salir y descartarlos?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener('keydown', shortcut);
    if (isDirty || preparing || saving) {
      window.addEventListener('beforeunload', beforeUnload);
      document.addEventListener('click', navigation, true);
    }
    return () => {
      window.removeEventListener('keydown', shortcut);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', navigation, true);
    };
  }, [isDirty, preparing, saving]);
  async function prepare(file: File | undefined, kind: Media) {
    if (!file || busy.current) return;
    busy.current = true;
    setPreparing(true);
    setMessage('');
    try {
      const blob = await profileImage(file, kind);
      if (!alive.current) return;
      clearMedia(kind);
      pendingMedia.current[kind] = blob;
      const url = URL.createObjectURL(blob);
      previews.current[kind] = url;
      update(MEDIA_KEYS[kind], url);
      setError(false);
    } catch (failure) {
      setError(true);
      setMessage(failure instanceof Error ? failure.message : 'No se pudo preparar la imagen.');
    } finally {
      busy.current = false;
      setPreparing(false);
    }
  }
  function discard() {
    clearMedia('avatar');
    clearMedia('banner');
    clearMedia('wallpaper');
    setDraft(profileDraft(saved));
    setMessage('Cambios descartados.');
    setError(false);
    if (avatarInput.current) avatarInput.current.value = '';
    if (bannerInput.current) bannerInput.current.value = '';
    if (wallpaperInput.current) wallpaperInput.current.value = '';
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    const db = browserClient();
    const undo: { path: string; previous: Blob | null }[] = [];
    let committed = false;
    try {
      const next = profileDraft(draft);
      next.username = username(next.username);
      next.terminal_status = text(next.terminal_status, 'Estado', 160, 0);
      next.social_links = socialLinks(next.social_links);
      next.room_theme = roomTheme(next.room_theme);
      next.owned_platforms = ownedPlatforms(next.owned_platforms);
      Object.assign(
        next,
        equippedRewards(next.equipped_title, next.equipped_frame, profile.level ?? 1),
      );
      const hasMedia = Object.keys(pendingMedia.current).length > 0;
      const objects = hasMedia
        ? await db.storage.from('profiles').list(profile.id, { limit: 10 })
        : { data: [], error: null };
      if (objects.error)
        throw new Error('No se pudo comprobar el archivo anterior. Reintenta guardar.');
      for (const kind of ['avatar', 'banner', 'wallpaper'] as const) {
        const blob = pendingMedia.current[kind];
        if (!blob) continue;
        const path = `${profile.id}/${kind}.webp`;
        let previous: Blob | null = null;
        if (objects.data?.some((file) => file.name === `${kind}.webp`)) {
          const backup = await db.storage.from('profiles').download(path);
          if (backup.error || !backup.data)
            throw new Error('No se pudo respaldar la imagen anterior. Reintenta guardar.');
          previous = backup.data;
        }
        undo.push({ path, previous });
        const result = await db.storage
          .from('profiles')
          .upload(path, blob, { contentType: 'image/webp', upsert: true, cacheControl: '0' });
        if (result.error)
          throw new Error(
            'No se pudo subir la imagen. Tu borrador sigue disponible para reintentar.',
          );
        const url = db.storage.from('profiles').getPublicUrl(path).data.publicUrl;
        next[MEDIA_KEYS[kind]] = `${url}?v=${Date.now()}`;
      }
      const result = await api<Profile>('profile', next);
      committed = true;
      clearMedia('avatar');
      clearMedia('banner');
      clearMedia('wallpaper');
      const persisted = profileDraft(result);
      setSaved(persisted);
      setDraft(profileDraft(persisted));
      setError(false);
      setMessage('Perfil guardado.');
      router.refresh();
    } catch (failure) {
      let restored = true;
      if (!committed) {
        for (const item of undo.reverse()) {
          try {
            const rollback = item.previous
              ? await db.storage.from('profiles').upload(item.path, item.previous, {
                  contentType: 'image/webp',
                  upsert: true,
                  cacheControl: '0',
                })
              : await db.storage.from('profiles').remove([item.path]);
            if (rollback.error) restored = false;
          } catch {
            restored = false;
          }
        }
      }
      setError(true);
      setMessage(
        restored
          ? failure instanceof Error
            ? failure.message
            : 'No se pudo guardar el perfil.'
          : 'Falló el guardado y no se pudieron restaurar todas las imágenes. Tu borrador se conserva; reintenta guardar antes de salir.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const style = {
    '--profile-accent': PROFILE_COLORS[draft.theme_color],
    '--profile-bg': `${PROFILE_COLORS[draft.theme_color]}18`,
    '--accent': PROFILE_COLORS[draft.theme_color],
  } as CSSProperties;
  const blocked = saving || preparing;
  return (
    <section className="profile-studio" style={style} aria-label="Estudio visual de perfil">
      <div className="studio-toolbar">
        <p className="eyebrow">LIVE PROFILE STUDIO</p>
        <div className="inline-actions" role="group" aria-label="Tamaño de vista previa">
          <button
            type="button"
            className="button secondary small"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            <Smartphone size={16} /> Móvil
          </button>
          <button
            type="button"
            className="button secondary small"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            <Monitor size={16} /> Escritorio
          </button>
        </div>
      </div>
      <form id={id} ref={form} method="post" onSubmit={save} className="form-stack">
        <fieldset disabled={blocked}>
          <div className={`studio-preview ${mobile ? 'studio-preview-mobile' : ''}`}>
            <ProfileWallpaper url={draft.wallpaper_url}>
              <GamerRoom theme={draft.room_theme}>
                <ProfileIdentity
                  profile={{ ...draft, xp: profile.xp ?? 0, level: profile.level ?? 1 }}
                  headingLevel={2}
                  avatarOverlay={
                    <button
                      type="button"
                      className="studio-camera studio-camera-avatar"
                      disabled={blocked}
                      onClick={() => avatarInput.current?.click()}
                    >
                      <Camera size={16} aria-hidden="true" />
                      <span>Cambiar avatar</span>
                    </button>
                  }
                  bannerOverlay={
                    <button
                      type="button"
                      className="studio-camera studio-camera-banner"
                      disabled={blocked}
                      onClick={() => bannerInput.current?.click()}
                    >
                      <Camera size={16} aria-hidden="true" />
                      <span>Cambiar banner</span>
                    </button>
                  }
                  usernameEditor={
                    <label className="studio-username">
                      <span className="sr-only">Nombre de usuario</span>
                      <span aria-hidden="true">@</span>
                      <input
                        name="username"
                        aria-label="Nombre de usuario"
                        value={draft.username}
                        pattern="[A-Za-z0-9_]{3,30}"
                        minLength={3}
                        maxLength={30}
                        required
                        onChange={(event) => update('username', event.target.value)}
                      />
                    </label>
                  }
                  terminalEditor={
                    <label className="studio-terminal">
                      <span>{draft.username || 'player'}@savestate:~$</span>
                      <input
                        aria-label="Estado de terminal"
                        name="terminal"
                        value={draft.terminal_status}
                        maxLength={160}
                        placeholder="Ready to play"
                        onChange={(event) => update('terminal_status', event.target.value)}
                      />
                    </label>
                  }
                />
              </GamerRoom>
            </ProfileWallpaper>
            <div className="studio-statuses" role="group" aria-label="Estados rápidos">
              {QUICK_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className="studio-chip"
                  aria-pressed={draft.terminal_status === status}
                  onClick={() => update('terminal_status', status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="studio-palette" role="group" aria-label="Color del perfil">
              {(Object.keys(PROFILE_COLORS) as Theme[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Color ${color}`}
                  aria-pressed={draft.theme_color === color}
                  className="studio-swatch"
                  style={{ background: PROFILE_COLORS[color] }}
                  onClick={() => update('theme_color', color)}
                />
              ))}
            </div>
            <p className="muted">Edita sobre tu tarjeta. Los cambios se aplican al guardar.</p>
          </div>
          <input
            ref={avatarInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Seleccionar avatar"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void prepare(event.target.files?.[0], 'avatar');
              event.target.value = '';
            }}
          />
          <input
            ref={bannerInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Seleccionar banner"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void prepare(event.target.files?.[0], 'banner');
              event.target.value = '';
            }}
          />
          <div className="panel form-stack">
            <h2>Detalles y privacidad</h2>
            <div className="form-stack">
              <h3>Wallpaper de la habitación</h3>
              <div className="wallpaper-presets" role="group" aria-label="Wallpapers retro">
                <button
                  type="button"
                  className="studio-chip"
                  aria-pressed={!draft.wallpaper_url}
                  onClick={() => {
                    clearMedia('wallpaper');
                    update('wallpaper_url', null);
                  }}
                >
                  Sin wallpaper
                </button>
                {WALLPAPERS.map((preset) => (
                  <button
                    type="button"
                    className="wallpaper-preset"
                    key={preset.id}
                    aria-pressed={draft.wallpaper_url === preset.url}
                    onClick={() => {
                      clearMedia('wallpaper');
                      update('wallpaper_url', preset.url);
                    }}
                  >
                    <img src={preset.url} alt="" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => wallpaperInput.current?.click()}
              >
                <Camera size={16} /> Subir wallpaper propio
              </button>
              <input
                ref={wallpaperInput}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Seleccionar wallpaper"
                onChange={(event) => {
                  void prepare(event.target.files?.[0], 'wallpaper');
                  event.target.value = '';
                }}
              />
              <p className="muted">
                Vista previa en vivo. Se guarda junto al perfil; visible para todos.
              </p>
            </div>
            <HardwareSelector
              value={draft.owned_platforms}
              onChange={(value) => update('owned_platforms', value)}
            />
            <section className="panel form-stack" aria-label="Nivel y Cosméticos">
              <h2>Nivel y Cosméticos</h2>
              <label>
                Título activo
                <select
                  value={draft.equipped_title}
                  onChange={(event) => update('equipped_title', event.target.value as PlayerTitle)}
                >
                  {PLAYER_TITLES.filter((item) => item.level <= (profile.level ?? 1)).map(
                    (item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Marco de avatar
                <select
                  value={draft.equipped_frame}
                  onChange={(event) => update('equipped_frame', event.target.value as AvatarFrame)}
                >
                  {AVATAR_FRAMES.filter((item) => item.level <= (profile.level ?? 1)).map(
                    (item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <p className="muted">
                La tarjeta muestra tus cosméticos al instante; guarda para equiparlos.
              </p>
            </section>
            <label>
              Habitación gamer
              <select
                value={draft.room_theme}
                onChange={(event) => update('room_theme', roomTheme(event.target.value))}
              >
                {ROOM_THEMES.map((theme) => (
                  <option value={theme} key={theme}>
                    {ROOM_LABELS[theme]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Avatar de galería
              <select
                value={
                  !draft.avatar_url
                    ? ''
                    : draft.avatar_url.startsWith('/avatars/')
                      ? draft.avatar_url
                      : 'custom'
                }
                onChange={(event) => {
                  if (event.target.value === 'custom') return;
                  clearMedia('avatar');
                  update('avatar_url', event.target.value || null);
                }}
              >
                <option value="custom" disabled>
                  Avatar personalizado
                </option>
                <option value="">Sin avatar</option>
                {(Object.keys(PROFILE_COLORS) as Theme[]).map((color) => (
                  <option key={color} value={`/avatars/${color}.svg`}>
                    Pixel {color}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.library_private}
                onChange={(event) => update('library_private', event.target.checked)}
              />
              Biblioteca visible solo para amigos
            </label>
            <p className="muted">
              Incluye partidas, favoritos, reseñas y actividad. Seguirte no concede acceso. Tu
              nombre y avatar siguen siendo públicos.
            </p>
            <div className="form-row">
              {SOCIAL_KEYS.map((key) => (
                <label key={key}>
                  Enlace {key}
                  <input
                    name={key}
                    type="url"
                    maxLength={300}
                    placeholder="https://…"
                    value={draft.social_links[key] ?? ''}
                    onChange={(event) =>
                      update('social_links', { ...draft.social_links, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="form-row">
              <label>
                PSN Online ID (público)
                <input
                  minLength={3}
                  maxLength={30}
                  value={draft.psn_id ?? ''}
                  onChange={(event) => update('psn_id', event.target.value || null)}
                />
              </label>
              <label>
                Xbox Gamertag (público)
                <input
                  minLength={3}
                  maxLength={30}
                  value={draft.xbox_gamertag ?? ''}
                  onChange={(event) => update('xbox_gamertag', event.target.value || null)}
                />
              </label>
            </div>
            <p className="muted">
              {preparing
                ? 'Comprimiendo imagen…'
                : 'PNG, JPG o WebP hasta 10 MB. Se convierte a WebP de hasta 500 KB; se sube al guardar.'}
            </p>
            <Link className="text-link" href={`/players/${saved.username}`}>
              Ver mi perfil ↗
            </Link>
          </div>
        </fieldset>
        {isDirty ? (
          <div className="studio-dock" role="region" aria-label="Cambios pendientes">
            <span className="eyebrow">CAMBIOS PENDIENTES</span>
            <button className="button small" disabled={blocked}>
              <Save size={16} />
              {saving ? 'Guardando…' : 'Guardar (Ctrl+S)'}
            </button>
            <button
              type="button"
              className="button secondary small"
              disabled={blocked}
              onClick={discard}
            >
              <Undo2 size={16} />
              Descartar
            </button>
          </div>
        ) : null}
        <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'muted'}>
          {message}
        </p>
      </form>
    </section>
  );
}
