# Especificación Técnica: Deduplicación y Agrupación Limpia de Repeticiones (VODs) de Worlds

## 1. Diagnóstico del Problema

En las capturas proporcionadas por el usuario (`media_1792117185207_ff8ab9f3.png` y `media_1792117190741_012cd56d.png`), la barra de señales bajo el reproductor muestra una avalancha masiva e inmanejable de botones de repetición:
- **Para MVK vs FURIA (3 mapas):** 39 botones (13 idiomas × 3 mapas).
- **Para KC vs C9 (5 mapas):** ¡**70 botones**! (14 idiomas × 5 mapas: `de-DE`, `en-US`, `es-ES`, `es-MX`, `ja-JP`, `ko-KR`, `pl-PL`, `pt-BR`, `sr-SR`, `th-TH`, `tr-TR`, `vi-VN`, `zh-TW`).

### Causa en el código:
En `src/components/worlds-hub.tsx`:
```tsx
const vods = selectedDetail?.games.flatMap((game) =>
  game.vods.map((vod) => ({ ...vod, number: game.number })),
) ?? [];

...
{vods.map((vod) => (
  <button key={`${vod.number}-${vod.parameter}-${vod.locale}`}>
    🎬 Juego {vod.number} {vod.locale ? ` · ${vod.locale}` : ''}
  </button>
))}
```
Se hace un `.flatMap()` ciego de **todos los idiomas de cada mapa** y se renderiza un botón independiente para cada idioma (alemán, polaco, tailandés, serbio, vietnamita, etc.), inundando la interfaz con hasta 10 filas de botones repetidos.

---

## 2. Solución UX/UI: 1 Botón por Juego + Selector Inteligente de Idioma

### A. Vista Antes vs Después

**Antes (70 botones desbordados):**
```
[🎬 Juego 1 · de-DE] [🎬 Juego 1 · en-US] [🎬 Juego 1 · es-ES] [🎬 Juego 1 · es-MX] [🎬 Juego 1 · ja-JP] [🎬 Juego 1 · ko-KR]...
[🎬 Juego 2 · de-DE] [🎬 Juego 2 · en-US] [🎬 Juego 2 · es-ES] [🎬 Juego 2 · es-MX] [🎬 Juego 2 · ja-JP] [🎬 Juego 2 · ko-KR]...
[🎬 Juego 3 · de-DE] [🎬 Juego 3 · en-US] [🎬 Juego 3 · es-ES] [🎬 Juego 3 · es-MX] [🎬 Juego 3 · ja-JP] [🎬 Juego 3 · ko-KR]...
[🎬 Juego 4 · de-DE] ...
[🎬 Juego 5 · de-DE] ...
```

**Después (Limpio, ergonómico y profesional):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📺 SEÑALES EN VIVO:                                                         │
│ [ Cine ] [ Teatro ] [ 🇪🇸 Español LVP ] [ 🇲🇽 Español Latam ] [ 🇺🇸 English ]  │
│                                                                             │
│ 🎬 REPETICIONES OFICIALES:                                                  │
│ [ 🎬 Juego 1 ]  [ 🎬 Juego 2 ]  [ 🎬 Juego 3 ]  [ 🎬 Juego 4 ]  [ 🎬 Juego 5 ]│
│                                                                             │
│ (Si hay una repetición activa)                                              │
│ Audio: [ 🇲🇽 Español Latam (es-MX) ▾ ] (o cambiar a España / Inglés)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Lógica de Deduplicación y Prioridad de Idioma

1. **Agrupación en `src/domain/worlds-features.ts`:**
   Implementar la función pura `deduplicateWorldsVods(games, preferredLocale)`:
   - Agrupa los VODs por número de juego (`game.number`).
   - Para cada juego, selecciona **un único VOD principal** según la jerarquía de idiomas de SaveState:
     1. `es-MX` (Español Latino)
     2. `es-ES` (Español España)
     3. `en-US` (Inglés oficial)
     4. Si no hay ninguno de esos tres, el primer VOD disponible.
   - Retorna exactamente 1 entrada por mapa jugado. De 70 botones pasa a **3 o 5 botones**.

2. **Selector de Idioma Opcional:**
   - Si el usuario está viendo la repetición del Juego 2 y quiere cambiar el audio a inglés o español de España:
     Se muestra un pequeño selector o desplegable compacto junto al reproductor con los idiomas disponibles para ese mapa específico (`es-MX`, `es-ES`, `en-US`, etc.).
   - No ensucia la barra principal.
