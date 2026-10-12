# Especificación Técnica: Slider Selector de 4 Cuentas Regresivas (GTA VI, Zelda: Ocarina of Time, Gala The Game Awards 2026 y Estreno Avengers: Doomsday)

## 1. Objetivo
Ampliar el **Slider / Selector de Cuentas Regresivas** de la página de inicio (`src/app/page.tsx` y `src/components/gta6-countdown.tsx`) para incluir el **cuarto contador** dedicado al estreno cinematográfico de **Avengers: Doomsday**:
1. **Pestaña 1 — Grand Theft Auto VI** (`19 de noviembre de 2026 · 00:00 UTC` — Videojuego para PlayStation 5 y Xbox Series X|S).
2. **Pestaña 2 — The Legend of Zelda: Ocarina of Time** (`5 de noviembre de 2026 · 12:00 AM EST / 05:00 UTC` — Videojuego para Nintendo Switch 2).
3. **Pestaña 3 — The Game Awards 2026** (`Jueves 10 de diciembre de 2026` — Gala anual de premiación en vivo).
4. **Pestaña 4 — Avengers: Doomsday** (`Jueves 17 de diciembre de 2026 · 00:00 UTC` — Gran estreno mundial en cines e IMAX).

---

## 2. Assets Copiados al Proyecto (`public/avengers/`)
Los archivos provenientes de `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture` (`Hero for Avengers Doomsday`, `Logo for Avengers Doomsday`, `Icon for Avengers Doomsday`) ya fueron copiados en `savestate 2` y `savestate-research` bajo `public/avengers/`:

| Recurso | Origen en `Instagram_Picture` | Ruta en `public/` | Uso |
| :--- | :--- | :--- | :--- |
| **Fondo Hero Avengers: Doomsday** | `Hero for Avengers Doomsday\imgi_1_doctor-doom-avengers-doomsday-movie-hd-wallpaper-uhdpaper.com-897@5@q.jpg` | `/avengers/hero.jpg` | Fondo del banner en el slide 4 y banner de imagen en el embed de Discord |
| **Logo Oficial Avengers: Doomsday** | `Logo for Avengers Doomsday\imgi_1_avengers_doomsday_logo_by_airielashf23_dlc8ekd-pre.png` | `/avengers/logo.png` | Logotipo principal centrado sobre el contador |
| **Icono Personalizado Avengers** | `Icon for Avengers Doomsday\imgi_1_03dcaa23397232e1430418366654e7.webp` | `/avengers/icon.webp` | Mini-icono en la pestaña `4. Avengers: Doomsday`, radar superior y badge de cine |
| **Icono PNG 512×512 (Discord)** | Derivado en PNG 512×512 para compatibilidad con Discord Embeds | `/avengers/icon-512.png` | `thumbnail` del embed automático cada 5 días en Discord (`#anuncios-savestate`) |

---

## 3. Extensión del Dominio (`src/domain/gta6-countdown.ts`)

### 3.1. Constantes y Funciones para Avengers: Doomsday
Añadir en `src/domain/gta6-countdown.ts`:
- `AVENGERS_DOOMSDAY_RELEASE_DATE = '2026-12-17T00:00:00.000Z'` (`17 de diciembre de 2026 · 00:00 UTC`).
- `AVENGERS_DOOMSDAY_RELEASE_TEXT = 'Avengers: Doomsday se estrenará oficialmente en cines el 17 de diciembre de 2026'`.
- `getAvengersDoomsdayCountdown(nowMs = Date.now())`: delega en `getCountdownTo(AVENGERS_DOOMSDAY_RELEASE_DATE, nowMs)`.
- `shouldAnnounceAvengersDoomsdayCountdown(history: unknown[], nowMs = Date.now())`:
  - Invoca `shouldAnnounceCountdown(history, getAvengersDoomsdayCountdown(nowMs), 'avengers-doomsday', nowMs)`.
  - Usa el marcador `savestate-avengers-doomsday-countdown:${bucket}` y `nonce = 'avengers-doomsday:' + bucket` para que el aviso automático cada 5 días en `#anuncios-savestate` sea independiente de GTA VI, Zelda y The Game Awards.

### 3.2. Cuarto Slide en `RELEASE_COUNTDOWNS`
Ampliar `ReleaseCountdownId = 'gta6' | 'zelda-oot' | 'tga-2026' | 'avengers-doomsday'` y agregar el cuarto elemento a `RELEASE_COUNTDOWNS`:
- `id: 'avengers-doomsday'`
- `tabNumber: 4`
- `tabLabel: 'Avengers: Doomsday'`
- `title: 'Avengers: Doomsday'`
- `radarLabel: 'MARVEL STUDIOS // ESTRENO MUNDIAL EN CINES'`
- `releaseDate: AVENGERS_DOOMSDAY_RELEASE_DATE`
- `releaseText: AVENGERS_DOOMSDAY_RELEASE_TEXT`
- `referenceNote: 'Cuenta regresiva al 17/12/2026 · 00:00 UTC.'`
- `timerAriaLabel: 'Tiempo restante hasta el estreno de Avengers: Doomsday el 17 de diciembre de 2026, 00:00 UTC'`
- `releasedText: '🦾 ¡Avengers: Doomsday ya está en cines!'`
- `heroImage: '/avengers/hero.jpg'`
- `iconImage: '/avengers/icon.webp'`
- `logoImage: '/avengers/logo.png'`
- `themeClass: 'countdown-theme-avengers'`
- `platforms: [{ label: 'Estreno en Cines · Marvel Studios', icon: '/avengers/icon.webp' }, { label: 'IMAX · Gran Pantalla', icon: '/avengers/icon-128.png' }]`

---

## 4. Estilos Visuales del Tema Doctor Doom (`src/app/globals.css`)
Añadir la variante `.gta6-countdown-banner.countdown-theme-avengers`:
- Fondo con `linear-gradient(180deg, #07140cbf, #0a180feb), var(--countdown-hero, url('/avengers/hero.jpg')) center / cover no-repeat`.
- Borde verde metálico Doctor Doom (`border-color: #22c55e80`) y sombra esmeralda/bronce (`box-shadow: 0 18px 50px #00000080, inset 0 0 32px #22c55e24`).
- `.gta6-countdown-banner.countdown-theme-avengers .gta6-radar` con color `#86efac`.
- `.gta6-countdown-banner.countdown-theme-avengers .gta6-clock > div` con `border-color: #22c55e55`.
- `.gta6-countdown-banner.countdown-theme-avengers .gta6-clock strong` con color `#bbf7d0` y `text-shadow: 0 0 18px #22c55e66`.

---

## 5. Aviso Automático cada 5 Días en Discord (`src/domain/discord-bot-cards.ts` y `src/services/discord.ts`)
1. En `src/domain/discord-bot-cards.ts`, crear y exportar `discordAvengersDoomsdayCountdownMessage(nowMs: number, baseAppUrl: string)`:
   - `title`: `🦾⏳ CUENTA REGRESIVA AVENGERS: DOOMSDAY · Faltan ${countdown.days} días`
   - `description`: `${AVENGERS_DOOMSDAY_RELEASE_TEXT}.\n⏳ ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m · referencia 17/12/2026 00:00 UTC`
   - `color`: `0x16a34a` (Doctor Doom Emerald Green)
   - `thumbnail`: `{ url: `${base}/avengers/icon-512.png` }`
   - `image`: `{ url: `${base}/avengers/hero.jpg` }`
   - `footer`: `{ text: `savestate-avengers-doomsday-countdown:${bucket} · Aviso automático cada 5 días` }`
2. En `src/services/discord.ts`:
   - Incluir `shouldAnnounceAvengersDoomsdayCountdown` y `discordAvengersDoomsdayCountdownMessage` en el ciclo de anuncios de cuenta regresiva en `#anuncios-savestate`, y exportar `announceAvengersDoomsdayCountdownToDiscord()`.
