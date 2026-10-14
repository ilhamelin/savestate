# Especificación Técnica: Tráilers en Español Latino, Integración de Telemetría con Chat Global y Arreglos Visuales en Screen (`/screen`)

## 1. Resumen y Objetivos

Esta especificación expande el módulo **Screen** (`/screen`) con dos funcionalidades solicitadas por el usuario:
1. **Priorización de Tráilers en Español Latino (`es-MX` / Latam)**:
   - Modificar la consulta a TMDB para solicitar videos en español latino (`include_video_language: 'es-MX,es,en'`).
   - Refinar la función `extractTmdbTrailerId(videosRaw)` para priorizar rigurosamente los tráilers doblados al español de Hispanoamérica/Latinoamérica sobre las versiones de España (`es-ES`) o inglés, usando etiquetas de país (`iso_3166_1: MX/AR/CL/CO/PE`), descriptores de idioma y keywords en el título del video.
2. **Botón "Compartir en Chat Global" en la Ficha de Telemetría ("TELEMETRÍA // TV" y "TELEMETRÍA // MOVIE")**:
   - Incorporar un botón interactivo dentro de `ScreenTelemetryDrawer` que compile la ficha de avance del usuario:
     - **Título** de la serie/película.
     - **Estado del checkpoint**: `Viendo`, `Por ver`, `Completada`, `Abandonada`.
     - **Tu calificación**: `X/10` o `— (Sin calificación)`.
     - **Temporada y episodios vistos**: Temporada activa, conteo de capítulos vistos sobre el total y porcentaje completado (`S01 · 8/10 episodios vistos (80%)`).
     - **Enlace rápido** a la ficha en la app (`/screen?select={tmdbId}&type={mediaType}`).
     - **Arte multimedia adjunto**: Imagen oficial de TMDB (backdrop o póster) habilitando `image.tmdb.org` en los orígenes permitidos de `safeChatMediaUrl` para que se previsualice en el feed de `/chat`.
   - Notificación visual inmediata en el drawer de que el checkpoint fue compartido en el chat global, con enlace directo para saltar a la conversación.

---

## 2. Análisis y Mecánica de Tráilers en TMDB

### 2.1. Comportamiento de TMDB respecto a Idiomas
- Por defecto, la API de TMDB filtra los resultados de videos según el parámetro `language` de la petición principal. Si se llama a `language=es-ES`, TMDB devuelve principalmente videos de España o con subtítulos de España.
- Si se utiliza el parámetro adicional `include_video_language=es-MX,es,en,null` (o `es-MX,es,en`), TMDB incluye en el objeto `videos.results` los videos dirigidos a Hispanoamérica (`iso_639_1: "es"`, `iso_3166_1: "MX"` o países LATAM como `AR`, `CL`, `CO`), los genéricos en español (`iso_639_1: "es"` sin país específico) y los originales en inglés (`en`).

### 2.2. Algoritmo de Priorización de Tráilers (`extractTmdbTrailerId`)
Para asegurar que se seleccione el tráiler latino oficial siempre que esté disponible:
1. **Filtro base**: Solo videos de `site === 'YouTube'`, de tipo `'Trailer'` (o `'Teaser'` como fallback) con claves de 11 caracteres válidas.
2. **Puntuación de Prioridad (menor valor = mayor preferencia)**:
   - **Prioridad 0 (Español Latino Explícito)**:
     - Idioma `iso_639_1 === 'es'` Y (`iso_3166_1 === 'MX'` o `iso_3166_1` en `['MX', 'AR', 'CL', 'CO', 'PE', 'LA']` o el nombre del video incluye palabras clave como `/latino|hispanoam[eé]rica|doblado/i`).
   - **Prioridad 1 (Español Neutro / Sin Región ES)**:
     - Idioma `iso_639_1 === 'es'` donde `iso_3166_1 !== 'ES'` y el nombre no mencione modismos españoles peninsulares.
   - **Prioridad 2 (Español de España / Peninsular)**:
     - Idioma `iso_639_1 === 'es'` con `iso_3166_1 === 'ES'` o nombre con menciones peninsulares.
   - **Prioridad 3 (Audio Original en Inglés)**:
     - Idioma `iso_639_1 === 'en'`.
   - **Prioridad 4 (Otros idiomas)**:
     - Cualquier otro idioma presente.
3. **Criterios secundarios de desempate**:
   - `type === 'Trailer'` antes de `type === 'Teaser'`.
   - `official === true` antes de trailers no oficiales.
   - Orden original de TMDB (`index`).

---

## 3. Integración con Chat Global (`/chat`)

### 3.1. Habilitación de Miniaturas TMDB en Chat
En `src/domain/global-chat.ts`, la función `safeChatMediaUrl(value, storageOrigin, ownerId)` valida los hostnames autorizados para adjuntar imágenes. Se agrega `'image.tmdb.org'` a la lista:
```ts
const hosts = [
  'i.imgur.com',
  'media.tenor.com',
  'c.tenor.com',
  'media.giphy.com',
  'i.giphy.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'klipy.com',
  'image.tmdb.org',
];
```
Esto permite adjuntar de forma segura `https://image.tmdb.org/t/p/w780/...` o similar en el campo `mediaUrl` del mensaje de chat.

### 3.2. Formato del Checkpoint Compartido
El payload publicado en `POST /api/chat/messages` genera un mensaje estructurado y visual:
```text
📺 CHECKPOINT // Screen
🍿 Arcane
🏷️ Estado: Viendo
⭐ Tu calificación: 10/10
📊 Avance: Temporada 2 · 6 / 9 episodios vistos (67%)
🔗 /screen?select=94605&type=tv
```
Para películas:
```text
🎬 CHECKPOINT // Screen
🍿 The Super Mario Bros. Movie
🏷️ Estado: Completada
⭐ Tu calificación: 8/10
📊 Avance: Película vista (100%)
🔗 /screen?select=502356&type=movie
```

### 3.3. Experiencia de Usuario en `ScreenTelemetryDrawer`
1. Botón visible **`💬 Compartir en Chat Global`** bajo la sección de calificación y progreso (disponible cuando el usuario está autenticado).
2. Estado de carga durante el POST (`Compartiendo…`).
3. Feedback inline:
   - Al completar con éxito: un pill o aviso de confirmación: `✓ ¡Compartido en el Chat Global! [Ir al chat →]` que enlaza a `/chat`.
   - En caso de error o rate limit: mensaje explicativo respetando el límite de 1.5s entre mensajes.

---

## 4. Archivos Involucrados

| Archivo | Responsabilidad |
|---|---|
| `src/domain/screen.ts` | Refinar `extractTmdbTrailerId` con jerarquía de prioridades `es-MX` / Latam / General / ES / EN. |
| `src/services/screen.ts` | Añadir `include_video_language: 'es-MX,es,en'` al consultar `append_to_response: 'credits,watch/providers,videos'` en TMDB. |
| `src/domain/global-chat.ts` | Permitir `image.tmdb.org` en `safeChatMediaUrl` para que las carátulas/backdrops se rendericen como media adjunto. |
| `src/components/screen/screen-telemetry-drawer.tsx` | Añadir el botón `💬 Compartir en Chat Global` con formateo del checkpoint, spinner de progreso y feedback de éxito con enlace a `/chat`. |
| `src/app/screen.css` | Estilos para el botón de compartir, mensaje de confirmación y badges de telemetría compartida. |
| `tests/unit/screen.test.ts` | Tests para verificar la selección del tráiler latino sobre el de España o inglés. |
| `tests/unit/global-chat.test.ts` | Test de validación que confirme que `image.tmdb.org` es un host permitido en `safeChatMediaUrl`. |
