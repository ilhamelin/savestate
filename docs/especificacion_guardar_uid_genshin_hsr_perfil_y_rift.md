# Especificación Técnica: Guardar UID de Genshin Impact y Honkai: Star Rail en Editar Perfil y Sugerencias Predeterminadas en `/rift`

## 1. Resumen Ejecutivo

1. **Guardar UID de Genshin Impact y Honkai: Star Rail en Editar Perfil (`/settings` · `ProfileStudio`)**:
   - Añadir dos campos en el editor de perfil (`src/components/profile-studio.tsx`) junto a `PSN Online ID` y `Xbox Gamertag`:
     - **Genshin Impact UID (público)**: `9` o `10` dígitos numéricos (`/^\d{9,10}$/`).
     - **Honkai: Star Rail UID (público)**: `9` o `10` dígitos numéricos (`/^\d{9,10}$/`).
   - Almacenar ambos valores de forma segura dentro del objeto JSONB `social_links` de `public.profiles` (bajo las claves `genshin_uid` y `hsr_uid` o helpers dedicados en `src/domain/validation.ts` y `src/domain/profile-studio.ts`), lo que permite persistencia inmediata en Supabase **sin necesidad de ejecutar una nueva migración SQL manual**.
2. **Mostrar Badges Interactivos de UID en la Tarjeta de Perfil (`/players/[username]` y Vista Previa de `ProfileStudio`)**:
   - En la sección de insignias de identidad (debajo de `PSN`, `Xbox` y redes sociales), renderizar insignias clicables con el icono oficial de cada juego (`/icons/games/genshin.png` y `/icons/games/hsr.png`) que lleven directamente a `/rift?game=genshin&uid={genshin_uid}` y `/rift?game=hsr&uid={hsr_uid}`.
3. **Pre-rellenado y Chips de Sugerencia Predeterminada en `/rift` (`CompetitiveHubTabs`)**:
   - En `src/app/rift/page.tsx`, leer el perfil del usuario autenticado (`social_links`, `steam_id`) y los query params (`?game=genshin&uid=...` o `?game=hsr&uid=...`) y pasarlos a `<CompetitiveHubTabs />`.
   - En las pestañas **Genshin Impact** y **Honkai: Star Rail** de `/rift`:
     - Pre-rellenar automáticamente la casilla de `UID (9 o 10 dígitos)` con el UID guardado en el perfil del jugador.
     - Mostrar debajo del buscador una fila de chips clicables (`Sugerencias:` / `Recientes:`) con el botón destacado **`⭐ Mi UID guardado: {uid}`** y las últimas búsquedas guardadas en `localStorage`, exactamente con la misma comodidad que tiene la pestaña de League of Legends.

---

## 2. Detalle de Implementación por Archivo

### 2.1. Validación de `genshin_uid` y `hsr_uid` (`src/domain/validation.ts` y `src/domain/profile-studio.ts`)

1. En `src/domain/validation.ts`:
   - Crear un validador `export function trackerUid(input: unknown, label: string): string | null`:
     - Si `input === null || input === undefined || String(input).trim() === ''`, devuelve `null`.
     - Si no coincide con `/^\d{9,10}$/`, lanza `new ValidationError(\`\${label}: debe tener 9 o 10 dígitos numéricos.\`)`.
     - Devuelve `String(input).trim()`.
   - En `socialLinks(input: unknown)`:
     - Permitir además de los enlaces HTTPS (`steam`, `discord`, `twitch`, `github`, `x`) las dos claves opcionales de UID: `genshin_uid` y `hsr_uid`.
     - Cuando `key === 'genshin_uid'` o `key === 'hsr_uid'`, si `raw === '' || raw === null || raw === undefined`, omitirla; de lo contrario, validarla con `trackerUid(raw, key === 'genshin_uid' ? 'Genshin UID' : 'Honkai: Star Rail UID')` y guardarla en `result[key]`.
     - Devolver en `socialLinks` únicamente redes sociales HTTPS cuando se use para enlaces externos, o proveer un helper `extractTrackerUids(socialLinksRecord)` que devuelva `{ genshinUid: string | null; hsrUid: string | null }` y filtre `genshin_uid` / `hsr_uid` del bucle de enlaces externos HTTPS en `/players/[username]/page.tsx`.

2. En `src/domain/profile-studio.ts`:
   - Incluir `genshin_uid` y `hsr_uid` dentro de `profileDraft(profile)` (dentro de `social_links` o como propiedades sincronizadas con `social_links.genshin_uid` y `social_links.hsr_uid`).

### 2.2. Campos en Editar Perfil y Vista Previa (`src/components/profile-studio.tsx` y `src/app/players/[username]/page.tsx`)

1. En `src/components/profile-studio.tsx`:
   - Justo debajo del `.form-row` de `PSN Online ID` y `Xbox Gamertag`, añadir un nuevo `.form-row`:
     - Campo **Genshin Impact UID (público)**:
       - `inputMode="numeric"`, `pattern="[0-9]{9,10}"`, `maxLength={10}`, `placeholder="Ej: 607358180"`
       - Actualiza `draft.social_links.genshin_uid`.
     - Campo **Honkai: Star Rail UID (público)**:
       - `inputMode="numeric"`, `pattern="[0-9]{9,10}"`, `maxLength={10}`, `placeholder="Ej: 600000124"`
       - Actualiza `draft.social_links.hsr_uid`.
   - En la vista previa de `ProfileIdentity` dentro de `ProfileStudio` y en `src/app/players/[username]/page.tsx`:
     - No renderizar `genshin_uid` ni `hsr_uid` como enlaces `<a href="...">` genéricos de redes sociales.
     - En su lugar, mostrarlos como insignias con el icono de cada juego:
       - Si existe `genshin_uid`: `<Link className="tag tracker-uid-tag" href={`/rift?game=genshin&uid=${genshinUid}`}><Image src="/icons/games/genshin.png" width={16} height={16} alt="" unoptimized /> Genshin UID: {genshinUid}</Link>`
       - Si existe `hsr_uid`: `<Link className="tag tracker-uid-tag" href={`/rift?game=hsr&uid=${hsrUid}`}><Image src="/icons/games/hsr.png" width={16} height={16} alt="" unoptimized /> HSR UID: {hsrUid}</Link>`

### 2.3. Sugerencias Predeterminadas y Auto-rellenado en `/rift` (`src/app/rift/page.tsx` y `src/components/competitive-hub-tabs.tsx`)

1. En `src/app/rift/page.tsx`:
   - Consultar el perfil del usuario autenticado (`const { data: viewerProfile } = await db.from('profiles').select('social_links,steam_id').eq('id', user.id).maybeSingle()`).
   - Extraer `savedGenshinUid` (`viewerProfile?.social_links?.genshin_uid || null`), `savedHsrUid` (`viewerProfile?.social_links?.hsr_uid || null`) y `savedSteamId` (`viewerProfile?.steam_id || null`).
   - Leer también los parámetros de URL opcionales `params.game` (`'genshin' | 'hsr' | 'valorant' | 'rust'`) y `params.uid`.
   - Pasar a `<CompetitiveHubTabs />`:
     - `savedGenshinUid={savedGenshinUid}`
     - `savedHsrUid={savedHsrUid}`
     - `savedSteamId={savedSteamId}`
     - `initialGame={...}`
     - `initialUid={...}`

2. En `src/components/competitive-hub-tabs.tsx`:
   - Al seleccionar la pestaña `'genshin'`:
     - Si la casilla `identity` está vacía y existe `savedGenshinUid`, pre-rellenar automáticamente `setIdentity(savedGenshinUid)`.
   - Al seleccionar la pestaña `'hsr'`:
     - Si la casilla `identity` está vacía y existe `savedHsrUid`, pre-rellenar automáticamente `setIdentity(savedHsrUid)`.
   - Al seleccionar la pestaña `'rust'`:
     - Si la casilla `identity` está vacía y existe `savedSteamId`, pre-rellenar automáticamente `setIdentity(savedSteamId)`.
   - Debajo del formulario de búsqueda de Genshin Impact, Honkai: Star Rail y Rust, mostrar una barra de sugerencias clicables (`Sugerencias:`):
     - Si `tab === 'genshin'` y `savedGenshinUid`: mostrar botón `<button type="button" className="tag" onClick={() => inspectUid('genshin', savedGenshinUid)}>⭐ Mi UID Genshin: {savedGenshinUid}</button>` (además de guardar y mostrar hasta 5 UIDs recientes en `localStorage` bajo `savestate_recent_genshin_uids`).
     - Si `tab === 'hsr'` y `savedHsrUid`: mostrar botón `<button type="button" className="tag" onClick={() => inspectUid('hsr', savedHsrUid)}>⭐ Mi UID Honkai: {savedHsrUid}</button>` (además de hasta 5 UIDs recientes en `localStorage` bajo `savestate_recent_hsr_uids`).
     - Si no tiene UID guardado en la pestaña actual (`genshin` o `hsr`), mostrar un enlace sutil `<Link href="/settings" className="text-link">Configura tu UID predeterminado en Editar perfil →</Link>`.
   - Si la página se abre con `?game=genshin&uid=607358180` o `?game=hsr&uid=...`, abrir directamente esa pestaña y disparar la consulta inicial automáticamente.
