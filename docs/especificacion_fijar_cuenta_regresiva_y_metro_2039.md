# Especificación Técnica: Fijar Cuenta Regresiva Favorita y Nuevo Contador "Metro 2039"

---

## 1. Resumen y Objetivos

Esta especificación detalla dos nuevas capacidades para el sistema de cuentas regresivas (*countdown slider*) de SaveState:

1. **Fijar Cuenta Regresiva Favorita (Persistencia Local)**:
   - Permite al usuario marcar con un botón `[ 📌 Fijar como principal ]` cualquier cuenta regresiva del carrusel (GTA VI, Zelda: OOT, The Game Awards, Avengers: Doomsday, Metro 2039).
   - La selección se almacena en el navegador mediante `localStorage` (`savestate_pinned_countdown`).
   - Al entrar nuevamente al sitio o recargar, el componente detecta automáticamente la preferencia y abre directamente en la cuenta regresiva fijada, sin necesidad de navegar manualmente.
   - Se incluye un indicador visual `📌` en la pestaña activa para reconocer rápidamente cuál está seleccionada como principal.

2. **Nuevo Contador de Lanzamiento: "Metro 2039"**:
   - **Fecha de lanzamiento**: **4 de febrero de 2027** (`2027-02-04T00:00:00.000Z`).
   - **Plataformas**: PC (Steam), PlayStation 5 y Xbox Series X|S.
   - **Recursos gráficos** (ubicados en `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture`):
     * **Hero**: `Hero for METRO 2039 by natsuko/imgi_5_1ecb86c96dd62c982d40d0699fc5a156.jpg` -> `public/metro/hero.jpg`.
     * **Icono**: `Icon for METRO 2039 by r_dsgnd/imgi_2_256x256.png` (M agrietada) -> `public/metro/icon.png`.
     * **Logo / Portada**: `Icon for METRO 2039 by r_dsgnd/imgi_2_512x512.png` (Artwork de Artyom y logo Metro 2039) -> `public/metro/logo.png`.
   - **Estética Temática**: Clase CSS `.countdown-theme-metro` con resplandor ámbar post-apocalíptico / radiactivo (`#ff8c00` / `#ffaa22`), tipografía digital industrial y partículas de ceniza.

---

## 2. Arquitectura de Datos y Dominio (`src/domain/gta6-countdown.ts`)

### A. Constantes de Metro 2039
```ts
export const METRO_2039_RELEASE_DATE = '2027-02-04T00:00:00.000Z';
export const METRO_2039_RELEASE_TEXT =
  'Metro 2039 saldrá oficialmente el 4 de febrero de 2027 para PC, PlayStation 5 y Xbox Series X|S';

export function getMetro2039Countdown(nowMs = Date.now()) {
  return getCountdownTo(METRO_2039_RELEASE_DATE, nowMs);
}

export function shouldAnnounceMetro2039Countdown(history: unknown[], nowMs = Date.now()) {
  return shouldAnnounceCountdown(
    history,
    getMetro2039Countdown(nowMs),
    'metro-2039',
    nowMs,
  );
}
```

### B. Ampliación del Tipo e Identificadores
```ts
export type ReleaseCountdownId =
  | 'gta6'
  | 'zelda-oot'
  | 'tga-2026'
  | 'avengers-doomsday'
  | 'metro-2039';
```

### C. Configuración en `RELEASE_COUNTDOWNS`
```ts
{
  id: 'metro-2039',
  tabNumber: 5,
  tabLabel: 'Metro 2039',
  title: 'Metro 2039',
  radarLabel: '4A GAMES // METRO MOSCOW RUINS',
  releaseDate: METRO_2039_RELEASE_DATE,
  releaseText: METRO_2039_RELEASE_TEXT,
  referenceNote: 'Cuenta regresiva al 04/02/2027 · 00:00 UTC.',
  timerAriaLabel: 'Tiempo restante hasta el 4 de febrero de 2027, 00:00 UTC',
  releasedText: '☢️ ¡El invierno nuclear ha comenzado! Metro 2039 ya está disponible.',
  heroImage: '/metro/hero.jpg',
  iconImage: '/metro/icon.png',
  logoImage: '/metro/logo.png',
  themeClass: 'countdown-theme-metro',
  platforms: [
    { label: 'PC · Steam', icon: '/platforms/steam.png' },
    { label: 'PlayStation 5', icon: '/platforms/playstation.png' },
    { label: 'Xbox Series X|S', icon: '/platforms/xbox.png' },
  ],
}
```

---

## 3. Experiencia UX/UI y Persistencia en el Componente (`src/components/gta6-countdown.tsx`)

### A. Flujo de Persistencia con `localStorage`
1. **Clave de almacenamiento**: `'savestate_pinned_countdown'`.
2. **Al montar el componente (`useEffect`)**:
   - Lee el valor almacenado.
   - Si coincide con algún `id` de `RELEASE_COUNTDOWNS`, actualiza `activeIndex` a dicho índice y marca `pinnedId`.
3. **Al pulsar el botón `[ 📌 Fijar como principal ]`**:
   - Si la cuenta actual ya está fijada, se desfija (remueve de `localStorage` y limpia `pinnedId`).
   - Si no está fijada, guarda el nuevo `id` en `localStorage` y actualiza `pinnedId`.
4. **Indicadores visuales**:
   - **En la barra de pestañas (Tabs)**: Si `item.id === pinnedId`, se renderiza una insignia o icono `📌` junto al nombre.
   - **En los controles del carrusel / banner**: Se agrega un botón interactivo:
     * Estado inactivo: `[ 📍 Fijar como principal ]`
     * Estado activo: `[ 📌 Fijado como favorito ]` con resplandor dorado y estilo `active`.

---

## 4. Estilos Visuales para Metro 2039 y Botón de Fijado (`src/app/globals.css`)

```css
/* Metro 2039 Theme */
.countdown-theme-metro {
  border-color: #ff8c0055;
  box-shadow: 0 16px 48px #000c, 0 0 32px #ff8c0022;
}
.countdown-theme-metro .gta6-radar {
  color: #ffaa22;
}
.countdown-theme-metro .gta6-clock strong {
  color: #ffaa22;
  text-shadow: 0 0 20px #ff8c0066;
}

/* Botón de fijar cuenta regresiva */
.countdown-pin-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #ffffff08;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.countdown-pin-btn:hover {
  border-color: #f5d061aa;
  color: #fff;
  background: #ffffff14;
}
.countdown-pin-btn.is-pinned {
  border-color: #f5d061;
  background: #f5d06122;
  color: #f5d061;
  font-weight: 600;
  box-shadow: 0 0 12px #f5d06133;
}
.countdown-tab-pin-badge {
  font-size: 0.7rem;
  margin-left: 4px;
}
```

---

## 5. Integración con Discord Bot Cards y Service

- Se exporta `discordMetro2039CountdownMessage(nowMs: number, baseAppUrl: string)` en `src/domain/discord-bot-cards.ts` con color `0xff8c00`, miniatura `/metro/icon.png` e imagen `/metro/hero.jpg`.
- Se implementa `announceMetro2039CountdownToDiscord()` en `src/services/discord.ts`.
- Pruebas unitarias actualizadas en `tests/unit/gta6-countdown.test.ts` y `tests/unit/release-countdown-service.test.ts`.
