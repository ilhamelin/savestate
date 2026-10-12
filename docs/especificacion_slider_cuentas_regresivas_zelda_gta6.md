# Especificación Técnica: Slider Selector de Cuentas Regresivas (GTA VI + The Legend of Zelda: Ocarina of Time) y Avisos en Discord

## 1. Objetivo
Evolucionar el módulo de cuenta regresiva de la página de inicio (`src/app/page.tsx` y `src/components/gta6-countdown.tsx`) en un **Slider / Selector de Cuentas Regresivas** que permita alternar en vivo entre:
1. **Grand Theft Auto VI** (`19 de noviembre de 2026 · 00:00 UTC` — PlayStation 5 y Xbox Series X|S).
2. **The Legend of Zelda: Ocarina of Time** (`5 de noviembre de 2026 · 12:00 AM EST / 05:00 UTC` — Nintendo Switch).

El cambio de pestaña o slide debe ser instantáneo, manteniendo un **único reloj central sincronizado (`nowMs`)** para no reiniciar ni desincronizar los contadores, y debe incluir avisos automáticos cada **5 días** en el canal `#anuncios-savestate` de Discord para ambos lanzamientos.

---

## 2. Assets Copiados al Proyecto (`public/zelda/` y `public/platforms/`)
Los archivos provenientes de `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture` ya fueron copiados en `savestate 2` y `savestate-research`:

| Recurso | Carpeta origen en `Instagram_Picture` | Ruta en `public/` | Uso |
| :--- | :--- | :--- | :--- |
| **Fondo Hero Zelda** | `Hero for The Legend of Zelda_ Ocarina of Time by natsuko\imgi_6_eb11b24c94896528ce273c400871db70.jpg` | `/zelda/hero.jpg` | Fondo del banner en el slide de Zelda y banner de imagen en el embed de Discord |
| **Icono Zelda 128×128** | `Icon for The Legend of Zelda_ Ocarina of Time by r_dsgnd\imgi_4_128x128.png` | `/zelda/icon-128.png` | Mini-icono en la pestaña del selector superior y en el encabezado del radar |
| **Icono Zelda 512×512** | `Icon for The Legend of Zelda_ Ocarina of Time by r_dsgnd\imgi_2_512x512.png` | `/zelda/icon-512.png` | `thumbnail` del embed automático en Discord (`#anuncios-savestate`) |
| **Logo Oficial Zelda** | `Logo for The Legend of Zelda_ Ocarina of Time by r_dsgnd\imgi_2_373ca39d0a5c1dc1141f9f279d92280f.png` | `/zelda/logo.png` | Logotipo principal centrado sobre el contador |
| **Icono Nintendo Switch** | `Icon for Nintendo\nintendo-switch.png` | `/platforms/nintendo.png` | Badge de plataforma en el contador de Zelda y en `resolvePlatformIcon` |

---

## 3. Diseño de Dominio (`src/domain/gta6-countdown.ts` y `src/domain/platform-icons.ts`)

### 3.1. Extensión de `src/domain/platform-icons.ts`
Añadir `nintendo: '/platforms/nintendo.png'` en `PLATFORM_ICON_PATHS` y actualizar `resolvePlatformIcon(input: string)` para que cualquier mención a `'nintendo'`, `'switch'`, `'snes'`, `'n64'`, `'game boy'` devuelva `'/platforms/nintendo.png'`.

### 3.2. Catálogo y Lógica de Cuentas Regresivas (`src/domain/gta6-countdown.ts`)
Mantener todas las exportaciones existentes (`GTA6_RELEASE_DATE`, `GTA6_RELEASE_TEXT`, `GTA6_ANNOUNCEMENT_INTERVAL`, `getGta6Countdown`, `shouldAnnounceGta6Countdown`) para no romper ninguna función ni test existente, y añadir:

1. **Constantes de Zelda: Ocarina of Time**:
   - `ZELDA_OOT_RELEASE_DATE = '2026-11-05T05:00:00.000Z'` (`Nov 5, 2026 12:00 AM EST`, equivalente a `05:00 UTC`).
   - `ZELDA_OOT_RELEASE_TEXT = 'The Legend of Zelda: Ocarina of Time saldrá oficialmente el 5 de noviembre de 2026 (12:00 AM EST) para Nintendo Switch'`.
2. **Funciones de cálculo y anuncio**:
   - `getCountdownTo(releaseIsoDate: string, nowMs = Date.now())`: calcula `{ released, totalMs, days, hours, minutes, seconds }`.
   - `getZeldaOotCountdown(nowMs = Date.now())`: delega en `getCountdownTo(ZELDA_OOT_RELEASE_DATE, nowMs)`.
   - `shouldAnnounceZeldaOotCountdown(history: unknown[], nowMs = Date.now())`:
     - Calcula `bucket = Math.floor(countdown.days / 5)` y `nonce = `zelda-oot:${bucket}``.
     - Inspecciona los últimos 100 mensajes de Discord buscando el marcador `^savestate-zelda-oot-countdown:(\d+)(?:\s|$)` en `embed.footer.text`.
     - Bloquea si el mismo `bucket` ya fue anunciado o si el último anuncio de `zelda-oot` ocurrió hace menos de `GTA6_ANNOUNCEMENT_INTERVAL` (5 días).
     - Así, los anuncios de **GTA VI** y **Zelda: Ocarina of Time** son **100% independientes** en `#anuncios-savestate` y no se bloquean mutuamente.
3. **Catálogo `RELEASE_COUNTDOWNS`**:
   ```ts
   export type ReleaseCountdownId = 'gta6' | 'zelda-oot';

   export interface ReleaseCountdownConfig {
     id: ReleaseCountdownId;
     tabNumber: number;
     tabLabel: string;
     radarLabel: string;
     title: string;
     releaseDate: string;
     releaseText: string;
     referenceNote: string;
     timerAriaLabel: string;
     releasedText: string;
     heroImage: string;
     iconImage: string;
     logoImage: string;
     themeClass: string;
     platforms: { label: string; icon: string }[];
   }
   ```
   - **Item 1 (`id: 'gta6'`)**:
     - `tabNumber: 1`, `tabLabel: 'Grand Theft Auto VI'`
     - `radarLabel: 'VICE CITY RADAR // LANZAMIENTO OFICIAL'`
     - `releaseDate: GTA6_RELEASE_DATE`, `releaseText: GTA6_RELEASE_TEXT`
     - `referenceNote: 'Cuenta regresiva al 19/11/2026 · 00:00 UTC.'`
     - `timerAriaLabel: 'Tiempo restante hasta el 19 de noviembre de 2026, 00:00 UTC'`
     - `releasedText: '🌴 La fecha de lanzamiento ha llegado.'`
     - `heroImage: '/gta6/hero.png'`, `iconImage: '/gta6/icon-128.png'`, `logoImage: '/gta6/logo.png'`
     - `themeClass: 'countdown-theme-gta6'`
     - `platforms: [{ label: 'PlayStation 5', icon: '/platforms/playstation.png' }, { label: 'Xbox Series X|S', icon: '/platforms/xbox.png' }]`
   - **Item 2 (`id: 'zelda-oot'`)**:
     - `tabNumber: 2`, `tabLabel: 'Zelda: Ocarina of Time'`
     - `radarLabel: 'HYRULE CHRONICLES // LANZAMIENTO OFICIAL'`
     - `releaseDate: ZELDA_OOT_RELEASE_DATE`, `releaseText: ZELDA_OOT_RELEASE_TEXT`
     - `referenceNote: 'Cuenta regresiva al 05/11/2026 · 12:00 AM EST (05:00 UTC).'`
     - `timerAriaLabel: 'Tiempo restante hasta el 5 de noviembre de 2026, 12:00 AM EST'`
     - `releasedText: '🗡️ La fecha de lanzamiento ha llegado.'`
     - `heroImage: '/zelda/hero.jpg'`, `iconImage: '/zelda/icon-128.png'`, `logoImage: '/zelda/logo.png'`
     - `themeClass: 'countdown-theme-zelda'`
     - `platforms: [{ label: 'Nintendo Switch', icon: '/platforms/nintendo.png' }]`

---

## 4. Diseño del Componente Slider + Selector Superior (`src/components/gta6-countdown.tsx`)

### 4.1. Sincronización del Reloj sin Interrupciones
- En lugar de montar/reiniciar un timer al cambiar de slide, el componente mantiene un único estado de tiempo `const [nowMs, setNowMs] = useState<number | null>(null)` alimentado por un solo `window.setInterval(() => setNowMs(Date.now()), 1000)`.
- El estado del slide activo es `const [activeIndex, setActiveIndex] = useState(0)`.
- `const active = RELEASE_COUNTDOWNS[activeIndex] ?? RELEASE_COUNTDOWNS[0]`.
- `const countdown = nowMs !== null ? getCountdownTo(active.releaseDate, nowMs) : null`.
- Al cambiar entre pestañas (`1. Grand Theft Auto VI` / `2. Zelda: Ocarina of Time`) o pulsar las flechas del slider (`←` / `→`), el cálculo usa inmediatamente el `nowMs` actual, evitando parpadeos (`—`) y sin rotación automática que distraiga al usuario.

### 4.2. Barra Selectora Superior (Ubicada arriba del contenedor del contador)
Justo encima de `<section className={`gta6-countdown-banner ${active.themeClass}`}>`, renderizar una barra `.countdown-selector-bar` con:
1. **Pestañas numeradas con mini-icono (`role="tablist"`, `aria-label="Cuentas regresivas destacadas"`)**:
   Cada opción de `RELEASE_COUNTDOWNS` renderiza un botón (`role="tab"`, `aria-selected={index === activeIndex}`):
   ```tsx
   <button
     key={item.id}
     type="button"
     role="tab"
     aria-selected={index === activeIndex}
     className={`countdown-tab ${index === activeIndex ? 'active' : ''}`}
     onClick={() => setActiveIndex(index)}
   >
     <Image src={item.iconImage} alt="" width={20} height={20} unoptimized />
     <span className="countdown-tab-index">{item.tabNumber}</span>
     <span>{item.tabLabel}</span>
   </button>
   ```
2. **Controles de Slider Manual (`←` / `1 / 2` / `→`)**:
   A la derecha de las pestañas (o integrados en la misma barra superior):
   - Botón `←` (`aria-label="Contador anterior"`): cicla a `(activeIndex - 1 + RELEASE_COUNTDOWNS.length) % RELEASE_COUNTDOWNS.length`.
   - Indicador `<span className="countdown-slider-status">{activeIndex + 1} / {RELEASE_COUNTDOWNS.length}</span>`.
   - Botón `→` (`aria-label="Siguiente contador"`): cicla a `(activeIndex + 1) % RELEASE_COUNTDOWNS.length`.

### 4.3. Tematización Visual en CSS (`src/app/globals.css`)
- `.countdown-showcase`: contenedor principal con margen vertical.
- `.countdown-selector-bar`: barra flexible (`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.65rem;`).
- `.countdown-tabs`: grupo de pestañas estilo cápsula/HUD con borde neón activo.
- `.gta6-countdown-banner.countdown-theme-zelda`:
  - Fondo con `linear-gradient(180deg, #061512cc, #0a1f19eb), url('/zelda/hero.jpg') center / cover no-repeat`.
  - Borde dorado Trifuerza (`border-color: #eab30875`) y resplandor esmeralda/dorado (`box-shadow: 0 18px 50px #00000080, inset 0 0 32px #eab30822`).
  - Números del reloj `.countdown-theme-zelda .gta6-clock strong` en tono dorado cálido (`#fef08a` con `text-shadow: 0 0 16px #eab30855`).

---

## 5. Notificación Cada 5 Días en Discord (`src/domain/discord-bot-cards.ts` y `src/services/discord.ts`)

1. En `src/domain/discord-bot-cards.ts`:
   Añadir `discordZeldaOotCountdownMessage(nowMs: number, baseAppUrl: string)`:
   ```ts
   export function discordZeldaOotCountdownMessage(nowMs: number, baseAppUrl: string) {
     const countdown = getZeldaOotCountdown(nowMs);
     const { bucket } = shouldAnnounceZeldaOotCountdown([], nowMs);
     const base = new URL(baseAppUrl).origin;
     return {
       allowed_mentions: { parse: [] },
       embeds: [
         {
           title: `🗡️⏳ CUENTA REGRESIVA ZELDA: OCARINA OF TIME · Faltan ${countdown.days} días`,
           description: `${ZELDA_OOT_RELEASE_TEXT}.\n⏳ ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m · referencia 05/11/2026 12:00 AM EST (05:00 UTC)`,
           color: 0xd4af37,
           thumbnail: { url: `${base}/zelda/icon-512.png` },
           image: { url: `${base}/zelda/hero.jpg` },
           footer: { text: `savestate-zelda-oot-countdown:${bucket} · Aviso automático cada 5 días` },
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
   - Dentro del flujo de anuncios de cuenta regresiva (`announceGta6Cached` / `announceGta6CountdownToDiscord`), tras obtener el `history` de los últimos 100 mensajes del canal `#anuncios-savestate`:
     - Evaluar tanto `shouldAnnounceGta6Countdown(history, now)` como `shouldAnnounceZeldaOotCountdown(history, now)`.
     - Si cualquiera de los dos corresponde anunciarse (`shouldAnnounce === true`), publicar su respectivo mensaje (`discordGta6CountdownMessage` y/o `discordZeldaOotCountdownMessage`) con su `nonce` único (`gta6:${bucket}` / `zelda-oot:${bucket}`).
     - Exportar también `announceZeldaOotCountdownToDiscord()` por si se invoca de forma individual.
