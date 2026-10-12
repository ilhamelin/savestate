# Especificación Técnica: Soporte de Banners de Perfil Multiformato y Animados (WebP Animado, GIF, APNG, AVIF, WebM/MP4)

## 1. Contexto y Problema Actual
Actualmente, el selector **"Cambiar banner"** en `ProfileStudio` (`src/components/profile-studio.tsx`) presenta cuatro limitaciones que impiden usar banners animados o en otros formatos:
1. **Filtro del `<input type="file">`**: Solo acepta `image/png,image/jpeg,image/webp`.
2. **Aplanado en `<canvas>` (`src/lib/profile-image.ts`)**: La función `profileImage()` convierte cualquier archivo mediante `createImageBitmap(file)` + `canvas.getContext('2d').drawImage(...)` + `canvas.toBlob(..., 'image/webp')`. Esto **destruye todos los fotogramas de animación** de un WebP animado (dejando solo el primer fotograma estático) y rechaza formatos como `GIF`, `APNG`, `AVIF`, `WebM` o `MP4`.
3. **Restricción del Bucket `profiles` y RLS**: La configuración inicial del bucket `profiles` limitaba `file_size_limit` a `512000` (500 KB), `allowed_mime_types` a `['image/webp']`, y la política RLS de `storage.objects` solo admitía el nombre `banner.webp`.
4. **Validación en `src/services/profile.ts` y renderizado en `src/components/profile-identity.tsx`**: `mediaUrl()` exige que `url.pathname.endsWith('.webp')` y `.profile-banner` solo contempla `<Image>` sin soporte para `<video>` en bucle ni estilos de ajuste unificados para medios en movimiento.

---

## 2. Formatos y Animaciones Soportados para el Banner
El marco del banner (`.profile-banner`, `height: 180px`, `overflow: hidden`) debe aceptar y reproducir dentro de sus límites:

| Formato | MIME Type | Extensión en Storage | Soporte de Animación / Movimiento |
| :--- | :--- | :--- | :--- |
| **WebP (Estático y Animado)** | `image/webp` | `.webp` | Sí — Si contiene cabecera animada (`VP8X` bit de animación / chunk `ANIM`), se preserva el binario original sin pasar por `<canvas>`. |
| **GIF Animado / Estático** | `image/gif` | `.gif` | Sí — Se preserva el binario original intacto. |
| **APNG / PNG Animado** | `image/apng`, `image/png` | `.apng` / `.png` | Sí — Si es `image/apng` o un PNG con chunk `acTL` antes de `IDAT`, se preserva intacto con animación. |
| **AVIF (Estático y Secuencia Animada)** | `image/avif` | `.avif` | Sí — Se preserva el archivo original (incluyendo secuencias `avis`). |
| **JPEG / PNG Estático** | `image/jpeg`, `image/png` | `.webp` (optimizado) o `.jpg`/`.png` | Estático — Se redimensiona/optimiza hasta 1600px en WebP como hasta ahora. |
| **Video Corto en Bucle (WebM / MP4)** | `video/webm`, `video/mp4` | `.webm`, `.mp4` | Sí — Reproducción silenciosa en bucle (`autoPlay loop muted playsInline`) encajada en el marco con `object-fit: cover`. |

- **Límite de tamaño para banners animados / video**: Hasta **8 MB** (`8 * 1024 * 1024` bytes).

---

## 3. Diseño de la Solución

### 3.1. Dominio de Medios de Banner (`src/domain/banner-media.ts`)
Crear `src/domain/banner-media.ts` con funciones puras y pruebas unitarias en `src/domain/banner-media.test.ts`:
- `MAX_BANNER_BYTES = 8 * 1024 * 1024` (8 MB).
- `BANNER_ACCEPT = 'image/webp,image/gif,image/png,image/apng,image/avif,image/jpeg,video/webm,video/mp4'`.
- `BANNER_ALLOWED_MIMES`:
  ```ts
  export const BANNER_MIME_EXTENSIONS: Record<string, string> = {
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/png': 'png',
    'image/apng': 'apng',
    'image/avif': 'avif',
    'image/jpeg': 'jpg',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
  };
  ```
- **Detección binaria de animación (`isAnimatedBannerBytes(bytes: Uint8Array, mimeType: string): boolean`)**:
  1. Si `mimeType` es `'image/gif'`, `'image/apng'`, `'video/webm'` o `'video/mp4'`, retorna `true`.
  2. Si `mimeType === 'image/webp'` (o cabecera `RIFF....WEBP`):
     - Verifica si en los primeros 64 bytes existe el chunk `VP8X` con el bit de animación activo (`(bytes[20] & 0x02) !== 0`) o si aparece la secuencia ASCII `ANIM` / `ANMF`.
  3. Si `mimeType === 'image/png'`:
     - Escanea los chunks PNG antes del primer `IDAT`; si encuentra el chunk `acTL` (`0x61, 0x63, 0x54, 0x4C`), retorna `true`.
  4. Si `mimeType === 'image/avif'`:
     - Verifica si la caja `ftyp` en los primeros 64 bytes contiene la marca `avis` (AVIF animado), o trata `image/avif` como preservación directa si pesa `<= MAX_BANNER_BYTES`.
- **Helpers de URL y extensión**:
  - `isValidBannerStoragePath(pathname: string, userId: string): boolean`:
    Valida que la ruta sea `/storage/v1/object/public/profiles/${userId}/banner.(webp|gif|png|apng|avif|jpg|webm|mp4)`.
  - `isVideoBannerSource(src: string | null | undefined, mimeType?: string | null): boolean`:
    Retorna `true` si `mimeType` empieza por `video/` o si la URL (sin query string `?v=...`) termina en `.webm` o `.mp4`.

### 3.2. Preparación de Medios en Cliente (`src/lib/profile-image.ts`)
Actualizar `profileImage(file: File, kind: 'avatar' | 'banner' | 'wallpaper')`:
- Si `kind === 'banner'`:
  1. Validar que `file.type` esté en `BANNER_MIME_EXTENSIONS` y `file.size <= MAX_BANNER_BYTES` (8 MB). Si no, lanzar error claro: `'Selecciona WebP, GIF, APNG, PNG, JPG, AVIF, WebM o MP4 de hasta 8 MB.'`.
  2. Leer los primeros 4 KB del archivo (`new Uint8Array(await file.slice(0, 4096).arrayBuffer())`) y evaluar `isAnimatedBannerBytes(headerBytes, file.type)`.
  3. Si es **animado**, **video** (`video/webm`, `video/mp4`) o **AVIF** (`image/avif`):
     - **NO pasar por `<canvas>`** para conservar todos los fotogramas y el movimiento original.
     - Devolver el `file` (o `new Blob([file], { type: normalizedMime })`) directamente.
  4. Si es una imagen estática (`PNG` estático, `JPEG` o `WebP` estático):
     - Redimensionar en `<canvas>` hasta `1600px` y comprimir a `image/webp` (permitiendo hasta `2 MB` para banners estáticos de alta definición o `500 KB`).

### 3.3. Subida Resiliente del Banner (`/api/profile/banner` + `ProfileStudio`)
Para garantizar que los nuevos formatos (`GIF`, `WebP` animado > 500 KB, `APNG`, `AVIF`, `WebM`, `MP4`) funcionen tanto con la nueva migración SQL como inmediatamente en producción:
1. **Crear ruta autenticada `POST /api/profile/banner/route.ts`**:
   - Verifica la sesión del usuario mediante `authenticated()`.
   - Recibe un `FormData` con el campo `file`.
   - Valida que `file` sea un `File`/`Blob` con `file.type` en `BANNER_MIME_EXTENSIONS` y `file.size <= MAX_BANNER_BYTES`.
   - Determina la extensión canónica `ext = BANNER_MIME_EXTENSIONS[file.type]` y la ruta `path = `${user.id}/banner.${ext}``.
   - Si `process.env.SUPABASE_SERVICE_ROLE_KEY` está disponible:
     - Actualiza de forma idempotente la configuración del bucket `profiles` (`storage.updateBucket('profiles', { public: true, fileSizeLimit: MAX_BANNER_BYTES, allowedMimeTypes: Object.keys(BANNER_MIME_EXTENSIONS) })`).
     - Sube el archivo a `profiles/${user.id}/banner.${ext}` con `upsert: true`, `contentType: file.type`, `cacheControl: '0'`.
   - Si no hay `SUPABASE_SERVICE_ROLE_KEY`, sube con el cliente autenticado `db.storage.from('profiles').upload(...)`.
   - Devuelve `{ url: `${publicUrl}?v=${Date.now()}`, path, contentType: file.type }`.
2. **En `src/components/profile-studio.tsx`**:
   - Actualizar el `<input ref={bannerInput}>` para que tenga `accept={BANNER_ACCEPT}`.
   - Guardar en `pendingMediaTypes` (o a partir de `blob.type`) si el banner pendiente es un video (`video/webm`, `video/mp4`) para que la vista previa en vivo (`ProfileIdentity`) lo reproduzca como `<video>` inmediatamente incluso cuando el `src` sea un `blob:...` URL.
   - Al guardar (`save()`): para `kind === 'banner'`, intentar subir vía `/api/profile/banner` (o fallback directo a `db.storage.from('profiles')`) usando la extensión real según `blob.type` (`banner.gif`, `banner.webp`, `banner.apng`, `banner.avif`, `banner.webm`, `banner.mp4`).
   - Actualizar el texto informativo en `ProfileStudio` para indicar que el banner admite **WebP animado, GIF, APNG, AVIF, PNG, JPG y video corto WebM/MP4 (hasta 8 MB)**.

### 3.4. Renderizado Encajado en el Marco (`src/components/profile-identity.tsx` y `src/app/globals.css`)
1. En `src/components/profile-identity.tsx`:
   - Aceptar una prop opcional `bannerMimeType?: string | null` (útil para previsualizar `blob:` URLs de video en `ProfileStudio`).
   - Dentro de `<div className="profile-banner">`:
     - Si `profile.banner_url` existe y `isVideoBannerSource(profile.banner_url, bannerMimeType)` es `true`:
       ```tsx
       <video
         src={profile.banner_url}
         className="profile-banner-media"
         autoPlay
         loop
         muted
         playsInline
         aria-label={`Banner de ${profile.username}`}
       />
       ```
     - Si `profile.banner_url` existe y es imagen (WebP animado, GIF, APNG, AVIF, etc.):
       ```tsx
       <Image
         src={profile.banner_url}
         alt={`Banner de ${profile.username}`}
         fill
         sizes="(max-width: 800px) 100vw, 1200px"
         unoptimized
         className="profile-banner-media"
       />
       ```
2. En `src/app/globals.css`:
   - Asegurar que tanto `img` como `video` dentro de `.profile-banner` respeten estrictamente el marco (`height: 180px; overflow: hidden;`):
     ```css
     .profile-banner img,
     .profile-banner video,
     .profile-banner-media {
       width: 100%;
       height: 100%;
       object-fit: cover;
       object-position: center;
       display: block;
     }
     ```

### 3.5. Validación Backend (`src/services/profile.ts`) y Migración SQL (`supabase/migrations/202610120027_animated_profile_banners.sql`)
1. En `src/services/profile.ts`:
   - Actualizar `mediaUrl(input: unknown, userId: string, kind: 'avatar' | 'banner' | 'wallpaper' = 'avatar')`:
     - Para `kind === 'banner'`, validar el pathname con `isValidBannerStoragePath(url.pathname, userId)` (permitiendo `banner.webp`, `banner.gif`, `banner.png`, `banner.apng`, `banner.avif`, `banner.jpg`, `banner.webm`, `banner.mp4`).
     - Para `avatar` y `wallpaper`, mantener la validación existente.
2. En `supabase/migrations/202610120027_animated_profile_banners.sql`:
   - Actualizar `storage.buckets` para `id = 'profiles'` con `file_size_limit = 8388608` y `allowed_mime_types = array['image/webp','image/gif','image/png','image/apng','image/avif','image/jpeg','video/webm','video/mp4']`.
   - Actualizar las políticas `profile_media_add`, `profile_media_edit` y `profile_media_remove` en `storage.objects` para permitir los nombres de archivo de banner con cualquiera de esas extensiones dentro de la carpeta `auth.uid()::text`.
