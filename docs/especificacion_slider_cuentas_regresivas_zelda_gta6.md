# Especificación Técnica: Slider Selector de 3 Cuentas Regresivas (GTA VI, The Legend of Zelda: Ocarina of Time y Gala The Game Awards 2026)

## 1. Objetivo
Ampliar el **Slider / Selector de Cuentas Regresivas** de la página de inicio (`src/app/page.tsx` y `src/components/gta6-countdown.tsx`) para incluir un **tercer contador** dedicado a un evento de gala:
1. **Pestaña 1 — Grand Theft Auto VI** (`19 de noviembre de 2026 · 00:00 UTC` — Lanzamiento de videojuego para PlayStation 5 y Xbox Series X|S).
2. **Pestaña 2 — The Legend of Zelda: Ocarina of Time** (`5 de noviembre de 2026 · 12:00 AM EST / 05:00 UTC` — Lanzamiento de videojuego para Nintendo Switch 2).
3. **Pestaña 3 — The Game Awards 2026** (`Jueves 10 de diciembre de 2026 · 00:00 UTC` — Gala anual de premiación y anuncios mundiales).

---

## 2. Assets Copiados al Proyecto (`public/tga/`)
Los archivos provenientes de `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture` (`Hero for The Game Awards` y `Logo for The Game Awards`) ya fueron copiados en `savestate 2` y `savestate-research` bajo `public/tga/`:

| Recurso | Origen en `Instagram_Picture` | Ruta en `public/` | Uso |
| :--- | :--- | :--- | :--- |
| **Fondo Hero The Game Awards** | `Hero for The Game Awards\imgi_8_wp13384530.jpg` | `/tga/hero.jpg` | Fondo del banner en el slide 3 y banner de imagen en el embed de Discord |
| **Logo Oficial The Game Awards** | `Logo for The Game Awards\imgi_2_logo.png` | `/tga/logo.png` | Logotipo principal centrado sobre el contador |
| **Icono Estatuilla TGA 128×128** | Recorte cuadrado de alta calidad de la estatuilla dorada | `/tga/icon-128.png` | Mini-icono en la pestaña `3. The Game Awards`, radar superior y badge de gala |
| **Icono Estatuilla TGA 512×512** | Recorte cuadrado 512×512 de la estatuilla dorada | `/tga/icon-512.png` | `thumbnail` del embed automático cada 5 días en Discord (`#anuncios-savestate`) |

---

## 3. Extensión del Dominio (`src/domain/gta6-countdown.ts`)

### 3.1. Constantes y Funciones para The Game Awards 2026
Añadir en `src/domain/gta6-countdown.ts`:
- `TGA_2026_EVENT_DATE = '2026-12-10T00:00:00.000Z'` (`Jueves 10 de diciembre de 2026 · 00:00 UTC`).
- `TGA_2026_EVENT_TEXT = 'La gala anual The Game Awards 2026 se celebrará oficialmente el jueves 10 de diciembre de 2026 en vivo desde el Peacock Theater'`.
- `getTga2026Countdown(nowMs = Date.now())`: delega en `getCountdownTo(TGA_2026_EVENT_DATE, nowMs)`.
- `shouldAnnounceTga2026Countdown(history: unknown[], nowMs = Date.now())`:
  - Invoca `shouldAnnounceCountdown(history, getTga2026Countdown(nowMs), 'tga-2026', nowMs)`.
  - Usa el marcador `savestate-tga-2026-countdown:${bucket}` y `nonce = 'tga-2026:' + bucket` para que el aviso automático cada 5 días en `#anuncios-savestate` sea totalmente independiente de los avisos de GTA VI y Zelda: Ocarina of Time.

### 3.2. Tercer Slide en `RELEASE_COUNTDOWNS`
Ampliar `ReleaseCountdownId = 'gta6' | 'zelda-oot' | 'tga-2026'` y agregar el tercer elemento a `RELEASE_COUNTDOWNS`:

```ts
  {
    id: 'tga-2026',
    tabNumber: 3,
    tabLabel: 'The Game Awards',
    title: 'The Game Awards 2026',
    radarLabel: 'PEACOCK THEATER // GALA ANUAL EN VIVO',
    releaseDate: TGA_2026_EVENT_DATE,
    releaseText: TGA_2026_EVENT_TEXT,
    referenceNote: 'Cuenta regresiva al jueves 10/12/2026 · 00:00 UTC.',
    timerAriaLabel: 'Tiempo restante hasta la gala The Game Awards del jueves 10 de diciembre de 2026, 00:00 UTC',
    releasedText: '🏆 ¡La gala de The Game Awards 2026 ha comenzado!',
    heroImage: '/tga/hero.jpg',
    iconImage: '/tga/icon-128.png',
    logoImage: '/tga/logo.png',
    themeClass: 'countdown-theme-tga',
    platforms: [
      { label: 'Gala en Vivo · Peacock Theater', icon: '/tga/icon-128.png' },
      { label: 'Steam Broadcast', icon: '/platforms/steam.png' },
    ],
  },
```

---

## 4. Estilos Visuales del Tema Gala (`src/app/globals.css`)
Añadir la variante `.gta6-countdown-banner.countdown-theme-tga`:
- Superposición cálida ámbar/dorado oscuro sobre `var(--countdown-hero)` (`/tga/hero.jpg`):
  ```css
  .gta6-countdown-banner.countdown-theme-tga {
    border-color: #f59e0b80;
    box-shadow:
      0 18px 50px #00000080,
      inset 0 0 32px #f59e0b24;
    background:
      linear-gradient(180deg, #140903bf, #1b0c05eb),
      var(--countdown-hero, url('/tga/hero.jpg')) center / cover no-repeat;
  }

  .gta6-countdown-banner.countdown-theme-tga .gta6-radar {
    color: #fbbf24;
  }

  .gta6-countdown-banner.countdown-theme-tga .gta6-clock > div {
    border-color: #f59e0b55;
  }

  .gta6-countdown-banner.countdown-theme-tga .gta6-clock strong {
    color: #fde68a;
    text-shadow: 0 0 18px #f59e0b66;
  }
  ```

---

## 5. Aviso Automático cada 5 Días en Discord (`src/domain/discord-bot-cards.ts` y `src/services/discord.ts`)

1. En `src/domain/discord-bot-cards.ts`:
   Crear y exportar `discordTga2026CountdownMessage(nowMs: number, baseAppUrl: string)`:
   ```ts
   export function discordTga2026CountdownMessage(nowMs: number, baseAppUrl: string) {
     const countdown = getTga2026Countdown(nowMs),
       { bucket } = shouldAnnounceTga2026Countdown([], nowMs),
       base = new URL(baseAppUrl).origin;
     return {
       allowed_mentions: { parse: [] },
       embeds: [
         {
           title: `🏆⏳ CUENTA REGRESIVA THE GAME AWARDS 2026 · Faltan ${countdown.days} días`,
           description: `${TGA_2026_EVENT_TEXT}.\n⏳ ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m · referencia jueves 10/12/2026 00:00 UTC`,
           color: 0xff9900,
           thumbnail: { url: `${base}/tga/icon-512.png` },
           image: { url: `${base}/tga/hero.jpg` },
           footer: { text: `savestate-tga-2026-countdown:${bucket} · Aviso automático cada 5 días` },
         },
       ],
       components: [
         {
           type: 1,
           components: [
             { type: 2, style: 5, label: '🌐 Ver cuenta regresiva en vivo en SaveState', url: base },
           ],
         },
       ],
     };
   }
   ```
2. En `src/services/discord.ts`:
   - Incluir el chequeo y envío de `shouldAnnounceTga2026Countdown(history, now)` junto a GTA VI y Zelda: Ocarina of Time sobre el mismo historial consultado del canal `#anuncios-savestate`.
   - Exportar `announceTga2026CountdownToDiscord()`.
