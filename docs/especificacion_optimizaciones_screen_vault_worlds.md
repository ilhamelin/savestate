# Especificación Técnica: Suite de Optimizaciones (Bóveda WebP, Hub de Adaptaciones en Screen, Level Up Arcade y Canal de Worlds)

## 1. Visión General
Esta especificación define cuatro mejoras estratégicas para SaveState:
1. **Compresión WebP Automática en la Bóveda R2**: Reducción en el cliente del 80-90% del peso de capturas PNG/JPG antes de subir a R2, multiplicando por 10 la capacidad efectiva de los 100 MB de la Memory Card.
2. **Hub de Adaptaciones de Videojuegos en `/screen`**: Fila destacada con estética retro-cyberpunk conectando las películas y series directamente con los videojuegos del catálogo (`GAME_ADAPTATIONS_MATRIX`).
3. **Celebración "LEVEL UP!" Arcade**: Modal holográfico interactivo con confeti de píxeles y fanfarria de audio sintetizado 8-bit cuando un jugador sube de nivel.
4. **Actualización de Señal Oficial de Worlds en Vivo**: Cambio de la señal en español a la transmisión oficial de Twitch `lolesportsla`.

---

## 2. Compresión WebP en Cliente (`src/components/vault-room.tsx`)

### 2.1 Algoritmo de Compresión en Navegador
Al seleccionar un archivo mediante `upload(selected)`:
- Si es imagen estática (`image/png`, `image/jpeg`, `image/webp`):
  1. Se carga en un elemento `Image` en memoria.
  2. Si el ancho o alto supera 2560px (resolución 2K/4K), se escala proporcionalmente.
  3. Se dibuja en un `HTMLCanvasElement` y se exporta como `image/webp` con calidad `0.85`:
     ```typescript
     canvas.toBlob((blob) => { ... }, 'image/webp', 0.85);
     ```
  4. Si el tamaño comprimido es menor que el original, se renombra a `.webp` con MIME `image/webp`.
- Si es un `GIF` o video (`video/mp4`, `video/webm`): se preserva intacto sin pasar por el canvas.

### 2.2 Beneficio
Una captura de pantalla de 10 MB se reduce a aproximadamente 350-450 KB, permitiendo almacenar hasta 250 imágenes en los 100 MB de cuota asignada por usuario.

---

## 3. Rework de Screen: Hub de Adaptaciones Gamer (`src/components/screen/`)

### 3.1 Integración de `GAME_ADAPTATIONS_MATRIX`
En `src/components/screen/screen-hub.tsx`:
- Renderizar una sección destacada:
  - Título: `🎮 ADAPTACIONES DE VIDEOJUEGOS // DE LA CONSOLA AL STREAMING`
  - Subtítulo: `Películas y series oficiales basadas en tus videojuegos favoritos.`
- Lista horizontal de títulos destacados basados en `GAME_ADAPTATIONS_MATRIX`:
  - *Arcane* (League of Legends)
  - *The Last of Us* (The Last of Us Part I)
  - *Cyberpunk: Edgerunners* (Cyberpunk 2077)
  - *Fallout* (Fallout)
  - *Castlevania: Nocturne* (Castlevania)
  - *Super Mario Bros.* (Super Mario)
  - *Sonic 3* (Sonic Frontiers)
  - *Halo* (Halo Infinite)
- Cada tarjeta muestra la carátula, el badge del juego original vinculado y las plataformas de streaming (Netflix, Max, Prime Video).

---

## 4. Gamificación: Celebración "LEVEL UP!" Arcade (`src/components/level-up-modal.tsx`)

### 4.1 Detección del Nivel
- Se compara el nivel actual del usuario autenticado contra `localStorage.getItem('savestate_seen_level')`.
- Si `currentLevel > lastSeenLevel` (y `lastSeenLevel` no es nulo):
  1. Se despliega el modal flotante a pantalla completa:
     - Título en Silkscreen pixel: `🎉 ¡LEVEL UP! NIVEL ALCANZADO`.
     - Insignia con el nuevo nivel y título obtenido (`PLAYER_TITLES`).
     - Fanfarria de sonido 8-bit sintetizado con la Web Audio API nativa (`AudioContext`, onda cuadrada chiptune, 0 bytes de assets externos).
     - Confeti de píxeles neón animados.
  2. Al presionar `[ ¡A seguir jugando! 🚀 ]`, se guarda el nuevo nivel en `localStorage`.

---

## 5. Actualización de Señal de Worlds (`src/domain/worlds-features.ts`)

Sustituir la señal de YouTube de Latam por el canal oficial de Twitch:
```typescript
  {
    id: 'lolesportsla',
    label: '🇲🇽 Español Latam · Twitch',
    kind: 'twitch',
    channel: 'lolesportsla',
    href: 'https://www.twitch.tv/lolesportsla',
  },
```
Actualizar las pruebas en `tests/unit/worlds-features.test.ts` para verificar el nuevo identificador `lolesportsla`.
