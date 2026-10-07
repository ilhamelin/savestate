# Revisión Técnica y Auditoría de Implementación — SaveState
**Fecha de auditoría:** 7 de octubre de 2026  
**Rama de trabajo:** `research/antigravity`  
**Referencia documental:** Documentos de especificación `01` a `07` (`*_savestate.md`), `docs/decisiones_aprobadas.md`, `docs/estado_implementacion.md` y `docs/configuracion.md`.  
**Código auditado:** `src/`, `supabase/`, `tests/`.

---

## 1. Resumen Ejecutivo

SaveState cuenta con una base de código funcional, coherente y sólidamente alineada con las decisiones aprobadas y el stack tecnológico seleccionado (**Next.js 16 App Router**, **React 19**, **TypeScript 5**, **Tailwind CSS v4**, **Supabase / PostgreSQL 16**, **Node.js 24**).

El proyecto no requiere reinicio ni redefinición arquitectónica. Sin embargo, este análisis identifica:
1. **Un riesgo técnico de alta prioridad:** La implementación del proxy de seguridad y sesión reside en `src/proxy.ts`, mientras que el estándar de Next.js App Router para ejecución de Edge/Node Middleware requiere el archivo canónico `src/middleware.ts`.
2. **Diferencias funcionales de alcance:** Ciertas capacidades periféricas (gestión detallada de sesiones activas, alta administrativa directa de sugerencias de catálogo, y búsqueda global de títulos al armar listas temáticas) presentan simplificaciones respecto a la especificación original.
3. **Validaciones externas pendientes:** Las pruebas automatizadas actuales garantizan la lógica de dominio, restricciones SQL y comportamiento HTTP sin credenciales, pero las integraciones reales con Supabase Auth, Storage, Realtime y Twitch/IGDB permanecen condicionadas a la configuración de credenciales del usuario.
4. **Oportunidades de optimización sin agregar dependencias:** Mejoras puntuales en el debounce del feed Realtime, la interfaz de moderación y la paginación de colecciones grandes.

---

## 2. Matriz de Requisitos vs. Implementación Efectiva

Las decisiones aprobadas del 7 de octubre de 2026 prevalecen sobre la redacción fundacional. A continuación se detalla el grado de cobertura por módulo funcional y no funcional:

### Módulo 1: Autenticación y Gestión de Cuentas

| Código | Requisito | Estado en Implementación | Análisis de Diferencias y Decisiones |
|---|---|---|---|
| **RF-01** | Registro/Login: correo/contraseña y OAuth (Discord, Google, Steam) | **Parcialmente cubierto (Aprobado)** | Discord y Google están implementados en cliente y rutas de callback/confirm. Steam se postergó formalmente a Fase 2 según *decisiones_aprobadas.md*. |
| **RF-02** | Recuperación y restablecimiento de contraseña vía email | **Completamente cubierto** | Implementado con `resetPasswordForEmail`, flujo PKCE en `/auth/callback?next=/reset-password` y soporte para tokens directos en `/auth/confirm`. |
| **RF-03** | Cierre seguro y gestión de sesiones activas | **Parcialmente cubierto** | Se provee cierre de sesión local (`scope: 'local'`) y revocación global (`scope: 'global'`) en `src/components/settings.tsx`. **Diferencia:** No se implementó un listado visual de sesiones activas por dispositivo/IP, limitación esperada con el cliente estándar de Supabase sin tablas auxiliares de sesión. |
| **RF-04** | Configuración de privacidad (público vs. amigos) | **Completamente cubierto** | Switch `library_private` en `profiles`. Función PostgreSQL `can_view_library()` protege biblioteca, logs, reseñas y favoritos. Se respeta la decisión aprobada: seguir a un usuario no concede acceso privado; solo amistad aceptada. |

### Módulo 2: Catálogo y Búsqueda de Juegos

| Código | Requisito | Estado en Implementación | Análisis de Diferencias y Decisiones |
|---|---|---|---|
| **RF-05** | Integración con API externa IGDB, carátulas y sinopsis | **Completamente cubierto** | Proxy backend con client credentials, ingesta perezosa en `games`, upsert por `igdb_id` y normalización de URLs de carátulas (`t_cover_big`). |
| **RF-06** | Búsqueda en tiempo real por título, desarrollador, distribuidor o saga | **Completamente cubierto** | Implementado en `igdbQuery` con operadores de texto y en `localCatalogue` con `ilike` sobre los cuatro campos indexados. |
| **RF-07** | Filtros avanzados por consola, género, año y nota | **Completamente cubierto** | Formulario de filtros en `/explore` con validación estricta en `src/integrations/igdb/query.ts` y ejecución en PostgreSQL mediante operadores GIN sobre arrays de plataformas y géneros. |
| **RF-08** | Ficha de juego estilo terminal con metadatos y distribución de notas | **Completamente cubierto** | Ruta `/games/[slug]` con Server Components, estadísticas calculadas por `game_statistics()`, distribución comunitaria de notas y tiempo medio jugado. |
| **RF-09** | Sugerencia o registro manual de juegos retro o hacks no indexados | **Parcialmente cubierto** | Formulario `SuggestGame` en `/explore`, tabla `game_suggestions` y panel `/moderation`. **Diferencia:** El moderador puede revisar la sugerencia, pero no existe una acción en la UI para transformarla directamente en un juego catalogado; requiere inserción administrativa directa. |

### Módulo 3: Tracking de Biblioteca y Diario de Juego (*Logbook*)

| Código | Requisito | Estado en Implementación | Análisis de Diferencias y Decisiones |
|---|---|---|---|
| **RF-10** | Seis estados de biblioteca (`Playing`, `Backlog`, `Cleared`, `100% / Platinum`, `Dropped`, `Wishlist`) | **Completamente cubierto** | Restricción CHECK en base de datos (`status in ('playing','backlog','cleared','platinum','dropped','wishlist')`), tipos estrictos y feedback de confeti en modo Platinum si no hay movimiento reducido. |
| **RF-11** | Registro de partida (*Play Log*): plataforma, método (hardware/emulador), fechas y dificultad | **Completamente cubierto** | Tabla `play_logs` con soporte de múltiples partidas por juego, validación de fechas (`finish_date >= start_date`) y notas asociadas. |
| **RF-12** | Contador de horas jugadas estimadas o reales | **Completamente cubierto** | Campo `hours_played numeric(8,2)` con agregación en el perfil del jugador y en las estadísticas públicas del juego. |
| **RF-13** | Top 4 Juegos Favoritos fijados en la cabecera del perfil | **Completamente cubierto** | Adelantado al MVP por decisión aprobada. Función atómica `set_favorites(uuid[])` con validación de cardinalidad (máximo 4), unicidad y asignación de posición 1–4. |
| **RF-14** | Listas temáticas personalizadas (públicas o privadas) | **Parcialmente cubierto** | Tablas `user_lists` y `list_items` con ordenación por `position_index`. **Diferencia:** En la interfaz `/lists/[id]`, el formulario para agregar juegos solo permite seleccionar títulos presentes en la biblioteca del propio usuario; no dispone de un buscador directo sobre todo el catálogo. |

### Módulo 4: Reseñas y Puntuación

| Código | Requisito | Estado en Implementación | Análisis de Diferencias y Decisiones |
|---|---|---|---|
| **RF-15** | Puntuación cuantitativa (escala 1 a 10 con incrementos de 0.5) | **Completamente cubierto** | Fuente única en `user_games.rating` con constraint `mod(rating, 0.5) = 0`. Función `save_review` sincroniza atómicamente la calificación. Triggers bidireccionales impiden reseñas sin nota y notas nulas en juegos con reseña. |
| **RF-16** | Editor de reseñas con soporte para Markdown | **Completamente cubierto** | Soporte de formato mediante `marked` con sanitización estricta por `isomorphic-dompurify` antes de guardar y antes de renderizar. |
| **RF-17** | Advertencia obligatoria de spoilers con ocultación visual | **Completamente cubierto** | Campo `has_spoilers` booleano exigido en formulario. Componente `ReviewCard` muestra pantalla de advertencia y botón para revelar/ocultar el contenido. |
| **RF-18** | Reacciones temáticas (*Critical Hit*, *GG*, *Game Over*) | **Completamente cubierto** | Tabla `review_reactions` con restricción a las tres reacciones aprobadas y un solo voto por usuario y reseña. |
| **RF-19** | Comentarios en reseñas públicas | **Completamente cubierto** | Tabla `review_comments` con inserción protegida por la política `can_view_review()`. |

### Módulo 5: Perfil Gamer y Personalización

| Código | Requisito | Estado en Implementación | Análisis de Diferencias y Decisiones |
|---|---|---|---|
| **RF-20** | Avatar configurable (galería pixel art predefinida o subida) | **Completamente cubierto** | Galería de 4 avatares vectoriales retro (`/avatars/*.svg`) o subida de WebP limitada a 512 KB con políticas de aislamiento por UUID en el bucket `profiles`. |
| **RF-21** | Banner de cabecera personalizable | **Parcialmente cubierto** | Subida de imagen WebP de cabecera implementada. **Diferencia:** La idea original sugería banners animados o generador de insignias; por decisión técnica se limitó a imágenes estáticas WebP para prevenir saturación de almacenamiento (R-04). |
| **RF-22** | Personalización de tema de color (Cian, Verde, Magenta, Ámbar) | **Completamente cubierto** | Cuatro temas soportados en base de datos (`theme_color in ('cyan','green','pink','amber')`) y clases CSS reactivas `.theme-*`. |
| **RF-23** | Enlaces a redes externas (Steam, Discord, Twitch, GitHub, X) | **Completamente cubierto** | Validación estricta en servidor (`src/domain/validation.ts`) que rechaza esquemas no HTTPS, credenciales embebidas y dominios falsificados. |
| **RF-24** | Línea de estado terminal (`user@savestate:~$ ...`) | **Parcialmente cubierto** | Campo editable `terminal_status` de hasta 160 caracteres en el perfil. **Diferencia:** No se actualiza de forma automática con el título que el usuario marca en estado `Playing`; es un texto libre ingresado por el usuario. |
| **RF-25** | Dashboard de estadísticas del jugador | **Completamente cubierto** | Módulo `playerStatistics` calcula horas totales, ranking de géneros, plataformas y balance anual con rejugadas. |

### Módulo 6: Red Social y Actividad Comunitaria

| Código | Requisito | Estado en Implementación | Análisis de Diferencias y Decisiones |
|---|---|---|---|
| **RF-26** | Seguimiento mutuo o solicitudes de amistad | **Completamente cubierto** | Tablas `follows` (unilateral) y `friendships` (bidireccional: pendiente, aceptada, rechazada). Índices de par ordenado evitan solicitudes redundantes. |
| **RF-27** | Feed de actividad en tiempo real (*Transmisión*) | **Completamente cubierto** | Tabla `activity_logs`, publicación `supabase_realtime` y componente `RealtimeFeed` que conecta a WebSockets y refresca el feed. |
| **RF-28** | Buscador de usuarios por nombre o etiqueta | **Parcialmente cubierto** | Implementado en `/players` con búsqueda insensible a mayúsculas sobre `username`. **Diferencia:** No existe sistema de "etiquetas" (*tags*) de jugador en la entidad `profiles`. |
| **RF-29** | Notificaciones internas | **Completamente cubierto** | Tabla `notifications` poblada automáticamente por triggers ante seguidores, solicitudes, aceptaciones, comentarios y reacciones. |

### Requerimientos No Funcionales (RNF)

| Código | Requisito | Estado | Observaciones |
|---|---|---|---|
| **RNF-01** | UI Pixel Art + Cyberpunk (Silkscreen + JetBrains Mono) | **Aprobado** | Fuentes tipográficas cargadas con `next/font/google`, variables CSS neón, esquinas recortadas y paneles oscuros. |
| **RNF-02** | Rendimiento < 1.5 s mediante caché | **Condicionado** | `unstable_cache` 24h, presupuesto atómico compartido (`claim_igdb_request` < 4 req/s) y contingencia local. **Validación pendiente:** Certificar latencia de red real con Twitch/IGDB en caliente y en frío. |
| **RNF-03** | Seguridad estricta (prevención XSS, CSRF, RLS) | **Aprobado** | Doble sanitización HTML con `isomorphic-dompurify`, validación `sameOrigin()` en rutas POST, claves aisladas con `server-only` y RLS en 14 tablas. |
| **RNF-04** | Responsividad total | **Aprobado** | Rejilla CSS fluida, layouts adaptables en móvil y escritorio sin deformación visual de elementos pixel. |
| **RNF-05** | Accesibilidad (WCAG AA, reducción de movimiento, toggle CRT) | **Aprobado** | Conmutador CRT en `localStorage`, contraste adecuado de paletas, skip link (`#main`), atributos ARIA y desactivación de confeti si `prefers-reduced-motion` está activo. |

---

## 3. Hallazgos Críticos y Análisis de Arquitectura

### 1. Convención de Middleware en Next.js App Router (`src/proxy.ts` vs. `src/middleware.ts`)
* **Ubicación actual:** [src/proxy.ts](file:///c:/Users/benja/OneDrive/Documentos/ChatGPT/savestate-research/src/proxy.ts)
* **Situación técnica:** En Next.js (App Router), el archivo de middleware de red debe llamarse `middleware.ts` en la raíz del proyecto o en `src/middleware.ts`, exportando una función nombrada `middleware` (o `default`).
* **Impacto potencial:** Si el runtime de Next.js no reconoce `src/proxy.ts` como entrypoint de middleware:
  - Las cabeceras `Content-Security-Policy` dinámicas con `nonce` no se inyectan en las respuestas servidas.
  - La renovación automática de sesiones SSR mediante `db.auth.getClaims()` y refresco de cookies en cada petición no se ejecutaría en la capa de borde antes de los Server Components.
  - El encabezado `Cache-Control: private, no-store` para rutas privadas no se aplicaría a nivel de middleware.
* **Propuesta recomendada:** Crear un archivo de entrada `src/middleware.ts` que reexporte la función `proxy` como `middleware` y la configuración de matcher:
  ```typescript
  export { proxy as middleware, config } from './proxy';
  ```

### 2. Escalabilidad del Canal Realtime en el Feed Comunitario
* **Ubicación:** [src/components/realtime-feed.tsx](file:///c:/Users/benja/OneDrive/Documentos/ChatGPT/savestate-research/src/components/realtime-feed.tsx)
* **Situación técnica:** El cliente se suscribe a todos los eventos de inserción en `activity_logs` mediante:
  ```typescript
  db.channel('player-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, refresh)
  ```
  Aunque las políticas RLS en Supabase impiden que el visitante reciba filas de usuarios privados no autorizados, en una comunidad de cientos o miles de jugadores cada inserción pública desencadena un evento que dispara un `router.refresh()` en todos los clientes web conectados.
* **Impacto potencial:** Una sobrecarga considerable de peticiones SSR concurrentes dirigidas al servidor Next.js cuando la plataforma tiene concurrencia activa.
* **Propuesta recomendada:** Limitar el canal Realtime con filtros por actor/seguidos cuando la API de Supabase lo soporte, o reemplazar la recarga inmediata incondicional por un indicador visual HUD (*"Nuevos eventos en transmisión — Clic para sincronizar"*).

### 3. Presupuesto Atómico de IGDB y Degradación ante Catálogo Frío
* **Ubicación:** [src/integrations/igdb/server.ts](file:///c:/Users/benja/OneDrive/Documentos/ChatGPT/savestate-research/src/integrations/igdb/server.ts) y función PostgreSQL `claim_igdb_request()`.
* **Situación técnica:** Para cumplir la restricción de Twitch (< 4 peticiones/segundo entre todas las réplicas del servidor), la base de datos administra un cerrojo atómico con ventana de 270 ms. Si dos o más peticiones concurrentes intentan consultar IGDB sin caché caliente, solo una obtiene autorización; las demás capturan una excepción y caen al modo de contingencia (`localCatalogue`).
* **Impacto potencial:** Si un usuario busca un título que aún no ha sido indexado en la base de datos local y el presupuesto de IGDB rechaza la petición momentáneamente, la búsqueda devolverá 0 resultados en lugar de reintentar con un pequeño backoff.
* **Propuesta recomendada:** Incorporar un reintento breve en el servidor (ej. esperar 300 ms y reclamar nuevamente el presupuesto una segunda vez) antes de degradar inmediatamente a la copia local.

### 4. Dependencia de la Biblioteca de Imágenes en Listas Temáticas
* **Ubicación:** [src/app/lists/[id]/page.tsx](file:///c:/Users/benja/OneDrive/Documentos/ChatGPT/savestate-research/src/app/lists/%5Bid%5D/page.tsx#L56)
* **Situación técnica:** En el formulario `ListItemForm`, los juegos disponibles para añadir a una lista se alimentan exclusivamente de `library?.games`.
* **Impacto:** Si un jugador quiere armar una lista de "Juegos retro que quiero jugar en 2027" o recomendaciones para amigos, primero se ve forzado a registrar esos juegos en su biblioteca personal (`user_games`), lo que contamina sus estadísticas o su backlog real.
* **Propuesta recomendada:** Permitir agregar juegos a las listas mediante un buscador que consulte la tabla global `games` o ingeste desde IGDB.

---

## 4. Matriz de Riesgos y Validaciones Pendientes

| ID | Riesgo | Categoría | Probabilidad | Impacto | Estado de Mitigación / Validación Pendiente |
|---|---|---|---|---|---|
| **RSK-01** | Incompatibilidad del archivo de Middleware de Next.js | Arquitectura | Alta | Alto | Mitigable con un wrapper estándar `src/middleware.ts`. Requiere validación de cabeceras en entorno compilado. |
| **RSK-02** | Latencia externa de IGDB superior a 1.5 s en ingesta fría | Rendimiento | Alta | Medio | Mitigado con timeout de 2.5 s y contingencia local. **Validación pendiente:** Medición de latencia real con credenciales Twitch activas. |
| **RSK-03** | Frecuencia excesiva de refresh SSR por WebSockets en feed | Escalabilidad | Media | Medio | El debounce de 500 ms atenúa ráfagas inmediatas, pero requiere validación bajo múltiples usuarios activos emitiendo checkpoints. |
| **RSK-04** | Variabilidad de soporte de `canvas.toBlob('image/webp')` | Compatibilidad | Baja | Medio | La compresión WebP en cliente funciona en navegadores modernos (Chromium, Firefox, Safari >=14). Validar fallback si el navegador falla la conversión. |
| **RSK-05** | Límite rígido de 500 títulos en bibliotecas extensas | UX / Datos | Baja | Bajo | Documentado con aviso visual en la interfaz. Para jugadores con colecciones retro masivas, se requiere paginación por cursor en Fase posterior. |
| **RSK-06** | Autenticación real de proveedores OAuth (Discord/Google) | Integración | Media | Alto | La lógica de código está completa. **Validación pendiente:** Configurar Client IDs y URIs de redirección en las consolas de Discord y Google Cloud. |
| **RSK-07** | Aislamiento RLS en Supabase administrado real | Seguridad | Baja | Crítico | Las aserciones SQL pasaron en PostgreSQL aislado. **Validación pendiente:** Ejecutar sobre proyecto Supabase real con firmas JWT de producción. |

---

## 5. Propuestas de Mejora Justificadas (Para Revisión)

Todas las propuestas se mantienen estrictamente dentro del stack tecnológico aprobado y no incorporan dependencias externas ni redefiniciones arquitectónicas:

### Propuesta 1: Formalización de `src/middleware.ts`
* **Justificación:** Garantiza compatibilidad universal con el ciclo de vida de Next.js App Router para CSP, cabeceras de seguridad y renovación de sesiones SSR.
* **Implementación:** Crear `src/middleware.ts` delegando en `src/proxy.ts`:
  ```typescript
  import { proxy, config } from './proxy';
  export { proxy as middleware, config };
  ```

### Propuesta 2: Optimización del canal de feed en `RealtimeFeed`
* **Justificación:** Evitar recargas completas SSR del feed ante cada inserción comunitaria global.
* **Implementación:** Reemplazar el `router.refresh()` automático por un botón de estado flotante tipo terminal (*"◆ 1 nuevo checkpoint en transmisión · Presiona para actualizar"*) o incrementar el debounce a un intervalo controlado.

### Propuesta 3: Desacoplar creación de listas de la biblioteca personal
* **Justificación:** Mejora la usabilidad de RF-14 permitiendo crear listas temáticas con cualquier juego del catálogo sin exigir que el creador lo tenga marcado en su biblioteca.
* **Implementación:** Agregar un campo de búsqueda de títulos en `ListItemForm` que consulte `/api/catalogue` y enlace el `game_id` correspondiente.

### Propuesta 4: Acción administrativa para aprobación de sugerencias
* **Justificación:** Cerrar el ciclo de vida de RF-09 en `/moderation` sin obligar al moderador a ejecutar sentencias SQL manuales para incorporar juegos retro sugeridos por los usuarios.
* **Implementación:** En `src/app/moderation/page.tsx`, añadir un botón "Aceptar e indexar" que inserte el título en `games` con los metadatos suministrados.

### Propuesta 5: Reintento con backoff en el presupuesto de IGDB
* **Justificación:** Reducir caídas prematuras al catálogo local cuando dos usuarios buscan títulos no cacheados en el mismo segundo.
* **Implementación:** Si `claim_igdb_request` retorna `false`, esperar 300 ms y realizar un único segundo intento antes de arrojar el error de contingencia.

---

## 6. Conclusión

La implementación local de SaveState es sólida, robusta y altamente fiel a las especificaciones y decisiones aprobadas. Presenta una arquitectura limpia, políticas de seguridad PostgreSQL ejemplares y un diseño visual coherente con la identidad pixel art retro-futurista.

Los hallazgos documentados en este informe son recomendaciones técnicas y riesgos operacionales que deben abordarse en la fase de conexión con servicios externos, sin alterar la base arquitectónica ya construida.
