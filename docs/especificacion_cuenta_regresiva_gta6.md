# Especificación Técnica: Cuenta Regresiva Oficial en Vivo para Grand Theft Auto VI + Anuncios Automáticos en Discord cada 5 Días

**Fecha:** 12 de octubre de 2026  
**Origen:** Equipo de Arquitectura e Investigación (`research/antigravity`)  
**Propósito:** Diseñar la implementación de un panel especial de cuenta regresiva en tiempo real para **Grand Theft Auto VI** (lanzamiento oficial: **19 de noviembre de 2026** para **PlayStation 5** y **Xbox Series X|S**), ubicado en la página de inicio (`/`) justo encima de "Noticias Recientes", junto con un sistema interno automatizado que publica una notificación de cuenta regresiva cada **5 días** en el canal `#anuncios-savestate` de Discord.

---

## 1. Activos Visuales Preparados (`public/gta6/`)

Se han extraído y copiado las imágenes de las tres carpetas proporcionadas por el usuario hacia `public/gta6/` en ambos repositorios:
1. **`/gta6/hero.png`** *(de `Hero for Grand Theft Auto VI by Viator_`)*:
   - Horizonte tropical de Vice City / Leonida con palmeras y degradado synthwave atardecer (violeta, magenta, coral y dorado).
   - **Uso:** Fondo escénico principal (`background-image`) del banner de cuenta regresiva en la página de inicio y banner imagen grande (`image.url`) en el Embed de Discord.
2. **`/gta6/logo.png` y `/gta6/logo.svg`** *(de `Logo for Grand Theft Auto VI by apfelspeier`)*:
   - Logotipo oficial transparente de **Grand Theft Auto VI** con el número romano `VI` relleno de palmeras neon.
   - **Uso:** Pieza central / izquierda de identidad sobre el Hero del banner de cuenta regresiva.
3. **`/gta6/icon-512.png` y `/gta6/icon-128.png`** *(de `Icon for Grand Theft Auto VI by r_dsgnd`)*:
   - Icono cuadrado enmarcado con fondo nocturno de palmeras y el emblema `VI`.
   - **Uso:** Badge / insignia de encabezado en la barra de estado del widget, miniatura (`thumbnail.url`) en el Embed de `#anuncios-savestate` en Discord y avatar/icono en tarjetas compactas.

---

## 2. Diseño del Componente en la Página de Inicio (`src/components/gta6-countdown.tsx`)

### 2.1. Ubicación en `src/app/page.tsx`
- Se ubica **justo debajo de `<SetupNotice />` y arriba del bloque de `Noticias Recientes` (`<NewsStream />`)**.

### 2.2. Fecha Objetivo y Reloj en Tiempo Real (Tick cada 1 segundo)
- **Fecha objetivo (`GTA6_RELEASE_ISO`):** `'2026-11-19T00:00:00Z'` (19 de noviembre de 2026).
- **Cálculo puro y determinista (`src/domain/gta6-countdown.ts`):**
  - `getGta6Countdown(nowMs: number)` devuelve:
    - `released: boolean` (`nowMs >= targetMs`)
    - `totalMs: number`
    - `days: number`
    - `hours: number` (0–23)
    - `minutes: number` (0–59)
    - `seconds: number` (0–59)
    - `progressPercent: number` (barra de progreso hacia el lanzamiento)
- **Actualización en vivo en el cliente:**
  - `setInterval` cada `1000ms` que actualiza en vivo **DÍAS : HORAS : MINUTOS : SEGUNDOS** con dígitos `tabular-nums` de estilo Vice City / Retro Neon, evitando hydration mismatch (render inicial seguro + actualización inmediata en `useEffect`).

### 2.3. Composición Visual (Estética Vice City × SaveState)
- **Fondo:** `/gta6/hero.png` cubriendo el panel con un velo degradado oscuro/violeta (`linear-gradient(95deg, rgba(10, 8, 22, 0.88) 0%, rgba(28, 12, 42, 0.72) 55%, rgba(12, 9, 20, 0.86) 100%)`) para que las palmeras y el cielo atardecer se luzcan con contraste de lectura perfecto.
- **Columna de Identidad:**
  - Insignia superior con `/gta6/icon-128.png` + `VICE CITY RADAR // SPECIAL COUNTDOWN`.
  - Logotipo `/gta6/logo.png` en alta nitidez.
  - Subtítulo oficial: **"Grand Theft Auto VI saldrá oficialmente el 19 de noviembre de 2026 para PlayStation 5 y Xbox Series X|S"**.
  - Badges de plataformas: `🎮 PlayStation 5` y `🟩 Xbox Series X|S` + botón rápido `Explorar en catálogo →` (`/explore?q=Grand+Theft+Auto+VI`).
- **Columna del Reloj en Vivo:**
  - 4 bloques digitales luminosos con borde neon rosa/naranja (`#ff4fd8` / `#ff9e44`):
    - **`DÍAS`** | **`HORAS`** | **`MINUTOS`** | **`SEGUNDOS`** (con segundero latiendo en vivo).
  - Barra inferior de telemetría indicando la fecha objetivo (`19 NOV 2026`) y que el aviso automático a `#anuncios-savestate` está activo cada 5 días.

---

## 3. Función Interna de Notificación a Discord cada 5 Días (`#anuncios-savestate`)

### 3.1. Lógica de Intervalo de 5 Días y Deduplicación sin Base de Datos Adicional
Para que el bot envíe automáticamente cuánto falta para **GTA VI** cada **5 días** al canal `#anuncios-savestate` sin repetir mensajes el mismo día ni requerir migraciones SQL:
1. **Cálculo de cubo/ventana de 5 días (`gta6AnnouncementBucket`):**
   - Se calcula el número de días restantes hasta el `2026-11-19T00:00:00Z`:
     $$\text{daysRemaining} = \max\left(0, \left\lceil \frac{\text{targetMs} - \text{nowMs}}{86400000} \right\rceil\right)$$
   - O bien el índice de ventana de 5 días (`Math.floor(daysRemaining / 5)`), o se comprueba en el historial de los últimos 100 mensajes de `#anuncios-savestate` cuándo fue el último anuncio de GTA VI (`footer.text` con prefijo `savestate-gta6-countdown` o marcador en el embed):
     - Si en los últimos 100 mensajes del canal `#anuncios-savestate` **no existe** un anuncio de GTA VI publicado hace menos de **5 días** (`5 * 24 * 60 * 60 * 1000` ms = `432_000_000` ms) —y tampoco pertenece al mismo bucket de 5 días—, el bot publica el nuevo parte oficial de cuenta regresiva.
     - Además, utiliza un `nonce` determinista por ventana de 5 días (ej. `gta6-countdown:bucket-${bucket}`) con `enforce_nonce: true` para garantizar que ejecuciones simultáneas jamás dupliquen el anuncio.

### 3.2. Diseño del Embed en `#anuncios-savestate`
El mensaje enviado por el bot al canal `#anuncios-savestate` incluye:
- **Título:** `🌴⏳ CUENTA REGRESIVA GTA VI · Faltan ${days} días`
- **Descripción:**
  `Grand Theft Auto VI saldrá oficialmente el **19 de noviembre de 2026** para **PlayStation 5** y **Xbox Series X|S**.`
  - Bloque destacado con el tiempo restante exacto (`${days} días, ${hours} horas y ${minutes} minutos`).
- **Color:** `0xff4fd8` (Rosa Vice City Neon).
- **Thumbnail:** `${appUrl()}/gta6/icon-512.png`
- **Imagen Banner (`image.url`):** `${appUrl()}/gta6/hero.png`
- **Footer:** `savestate-gta6-countdown:${bucket} · Reporte automático cada 5 días en SaveState`
- **Botón interactivo:** `🌐 Ver cuenta regresiva en vivo en SaveState` apuntando a `https://savestate-eight.vercel.app`.

### 3.3. Disparadores Automáticos
1. **Integrado en el flujo de anuncios de Discord (`announceNewFreebiesToDiscord` / `announceGta6CountdownToDiscord` en `src/services/discord.ts`):**
   - Se ejecuta tanto en el Cron diario `/api/cron/discord-freebies` (`0 13 * * *`) como en `scheduleDiscordFreebies()` cuando se visita la comunidad/anuncios, y también en una ruta dedicada opcional `/api/cron/gta6-countdown` (o dentro del cron existente para respetar los límites de crons del plan Hobby de Vercel).
   - Al verificar el historial del canal `#anuncios-savestate`, solo publica cuando se cumple el ciclo de 5 días.
