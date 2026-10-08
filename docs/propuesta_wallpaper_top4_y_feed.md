# Propuesta Técnica: Wallpapers de Perfil, Editor Rápido de Top 4 y Telemetría en Vivo de Transmisión
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la incorporación de fondos de pantalla (wallpapers) detrás de la tarjeta del perfil, un editor interactivo in situ para el Top 4 de favoritos con doble fuente (biblioteca local/Steam y catálogo global IGDB), e indicadores visuales de frecuencia y sincronización en tiempo real en la página de Transmisión (`/feed`).

---

## 1. Alcance Funcional

Este paquete resuelve tres peticiones clave de experiencia de usuario y personalización estética:

1. **Fondos de Pantalla (Wallpapers) en el Perfil:**
   - Permitir a los jugadores elegir un fondo ambiental detrás de su habitación gamer (la consola portátil, terminal CRT o estantería).
   - Opciones: Galería de presets retro (Cyberpunk City, Habitación 90s, Synthwave Grid, Estrellas 8-bits) o subida de imagen personalizada a Supabase Storage (`profiles`).
   - Aplicación con viñeta y contraste para preservar la legibilidad del texto y de la consola.
2. **Editor Rápido de Top 4 Directo en el Perfil:**
   - Si el usuario autenticado está viendo su propio perfil (`/players/[username]`), puede hacer clic en cualquier ranura del Top 4 (Slot 1 al 4) para cambiar o asignar el juego directamente sin tener que ir a otra página.
   - **Doble fuente inteligente:**
     - *Pestaña "Mis Juegos":* Selecciona en un clic entre los juegos ya registrados en su biblioteca (incluyendo los importados de Steam).
     - *Pestaña "Buscar en Catálogo":* Busca cualquier título de IGDB / base de datos global y, al elegirlo, lo vincula automáticamente a su biblioteca como favorito en esa posición.
3. **Telemetría y Estado de Sincronización en Transmisión (`/feed`):**
   - Indicador visual HUD en la cabecera del feed que muestra:
     - Estado de la conexión (`● EN VIVO vía WebSockets`).
     - Frecuencia de sincronización de respaldo (`Sincronización automática cada 30s`).
     - Marca de tiempo de la última señal recibida (`Última actualización: hace 8s`).
     - Botón manual de actualización rápida con animación de giro (`[ ↺ Sincronizar ahora ]`).

---

## 2. Nueva Migración SQL: `202610080013_profile_wallpapers.sql`

Solo se requiere incorporar la columna `wallpaper_url` a la tabla `public.profiles`:

```sql
begin;

-- 1. Añadir columna wallpaper_url
alter table public.profiles
  add column if not exists wallpaper_url text;

-- 2. Conceder actualización de columna a usuarios autenticados
grant update (wallpaper_url) on public.profiles to authenticated;

commit;
```

---

## 3. Especificación de Componentes e Interfaz

### 3.1. Selector de Wallpaper en Profile Studio (`/settings`)
* **Galería de Presets Integrados (sin peso extra, rutas SVG/CSS o imágenes estáticas):**
  - `neon_cyberpunk`: Horizonte de rascacielos pixel art con neón morado/cian.
  - `arcade_90s`: Habitación nostálgica con posters y luz tenue.
  - `synthwave_grid`: Grilla en perspectiva con sol ochentero degradado.
  - `deep_space`: Campo de estrellas 8-bits con nebulosa tenue.
  - `none`: Fondo oscuro minimalista predeterminado.
* **Subida Personalizada:** Botón para cargar una imagen propia, comprimida a WebP en cliente y almacenada en `profiles/<user_id>/wallpaper.webp`.
* **Renderizado en `/players/[username]`:**
  - El fondo de la página o del contenedor del perfil utiliza `background-image` con un degradado superpuesto (`linear-gradient(rgba(8, 9, 12, 0.75), rgba(8, 9, 12, 0.92))`) para garantizar que la Consola Portátil y la tipografía resalten con nitidez.

### 3.2. Selector Rápido de Top 4 (`<Top4SlotSelector />`)
* **En `/players/[username]/page.tsx`:**
  - Si el visitante es el dueño del perfil, cada una de las 4 tarjetas de favoritos muestra un botón de acción sobreimpreso `[✏️ Cambiar]` o `[+ Fijar Slot X]` si la ranura está vacía.
* **Modal de Asignación de Ranura:**
  - **Filtro 1: "Mi Biblioteca" (Juegos de Steam y manuales):** Despliega una cuadrícula rápida de los juegos que el usuario ya tiene marcados en `user_games`. Al pulsar uno, actualiza `favorite_position = slot_number` y desasigna el anterior de esa posición si existía.
  - **Filtro 2: "Buscar en Catálogo (IGDB)":** Campo de búsqueda reactivo con debounce a 300 ms. Si el jugador busca un juego que no tiene en su biblioteca (ej. *The Witcher 3*), al hacer clic el servidor ejecuta:
    1. Inserción en `user_games(user_id, game_id, status='completed', favorite_position=slot_number)`.
    2. Revalidación inmediata de la página del perfil (`revalidatePath`).
  - Botón opcional: `[Desfijar este favorito]` para dejar el slot vacío.

### 3.3. Barra de Telemetría en Transmisión (`<RealtimeFeed />`)
* Evolucionar `src/components/realtime-feed.tsx`:
  - Mantiene un contador de tiempo transcurrido en segundos (`lastSignalSecondsAgo`) que se reinicia a `0` cada vez que llega un evento WebSocket o se cumple el intervalo de 30 segundos.
  - Interfaz visual estilo terminal militar/arcade:
    ```
    ● TRANSMISIÓN EN VIVO // WebSocket activo · Última señal: hace 4s · Intervalo: 30s  [↺ Forzar señal]
    ```
  - Al pulsar `[↺ Forzar señal]`, ejecuta un `router.refresh()` inmediato con retroalimentación visual de escaneo.

---

## 4. Criterios de Aceptación y Calidad

1. El wallpaper seleccionado se previsualiza en tiempo real en el Profile Studio y se visualiza en el perfil público sin comprometer el contraste ni la accesibilidad.
2. Un usuario puede cambiar o asignar cualquiera de sus 4 favoritos desde la misma página de su perfil, pudiendo seleccionar tanto juegos ya importados de Steam como buscar nuevos títulos de IGDB en segundos.
3. El indicador de telemetría de `/feed` informa fielmente los segundos transcurridos desde la última actualización y permite forzar la sincronización sin recargar la ventana completa.
4. Cobertura estricta con `npm run check` y `npm run build`.
