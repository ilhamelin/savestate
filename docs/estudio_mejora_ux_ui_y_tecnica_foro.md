# Estudio y Especificación Técnica: Rediseño UX/UI y Evolución Técnica del Foro (`SaveState Boards`)

**Fecha:** 13 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Realizar un estudio integral (UX/UI + Arquitectura Técnica y Herramientas) de la sección **Foro (`/forum`, `/forum/[category]` y `/forum/[category]/[thread_id]`)** y definir el plan exacto de implementación para transformar el foro actual en una plataforma de discusión moderna, ágil y rica en herramientas para la comunidad gamer.

---

## 1. Diagnóstico Profundo del Estado Actual

Tras auditar todos los archivos del módulo de Foro (`src/app/forum/**`, `src/components/forum-*.tsx`, `src/domain/forum.ts`, `src/services/forum.ts`, `src/services/forum-markdown.ts`, `src/app/forum.css` y `src/app/globals.css`), se identificaron las siguientes limitaciones divididas en **UX/UI** y **Apartado Técnico / Herramientas**:

### 1.1. Problemas de UX/UI (Visual y Experiencia de Usuario)

1. **Portada del Foro (`/forum`) muestra solo 5 hilos y carece de filtro rápido por canal:**
   - En `src/services/forum.ts`, `cachedDirectory` ejecuta `.limit(search ? 20 : 5)`. Como resultado, la página principal del foro muestra **únicamente 5 hilos** sin paginación ni selector rápido de canal in-place.
2. **Filas de Hilos (`ForumThreadList`) planas, sin extracto, sin carátula del juego y sin indicadores visuales de actividad:**
   - Cada tarjeta en `forum-thread-row` muestra solo el título y metadatos básicos.
   - Si el hilo está vinculado a un juego (`game_id`), **no muestra la miniatura de la carátula (`cover_url`)**, desaprovechando el contexto visual.
   - **No muestra un extracto/resumen** de la primera línea del hilo, obligando al usuario a entrar a ciegas para saber de qué trata.
   - Carece de insignias visuales de lectura rápida como **`🔥 Candente`** (hilos con alta participación), **`👁️ Contiene Spoilers`** (si el texto incluye `||...||`) o el badge **`👑 OP`** cuando el propio autor respondió recientemente.
3. **Vista de Canal (`/forum/[category]`) pierde el buscador, los filtros de ordenamiento y la navegación entre canales:**
   - Al entrar a un canal (ej. `/forum/retro-corner`), **desaparecen** tanto la barra de búsqueda como los botones de orden (`🔥 Más activos`, `⏱️ Recientes`, `❓ Sin respuestas`), y no existe una tira horizontal de píldoras para cambiar de canal con un clic sin tener que volver atrás.
4. **Editor Markdown (`ForumEditor`) sin barra de herramientas (Formatting Toolbar):**
   - Actualmente es un `<textarea>` crudo que exige conocer sintaxis Markdown de memoria (`**negrita**`, `` `código` ``, `||spoilers||`).
   - No cuenta con una **Barra de Herramientas Interactiva** (Negrita, Cursiva, Subtítulo, Bloque de Código, Cita, Spoiler `||...||`, Lista, Enlace) ni con pestañas integradas `✍️ Escribir` / `👁️ Vista previa` al estilo GitHub/Discord.
5. **Vista de Conversación (`ForumConversation`) con fricción en lectura, citas y reacciones:**
   - **Fechas crudas en formato ISO (`2026-10-12 23:15 UTC`)** en lugar de tiempo relativo humano (`hace 12 min`) con fecha completa en el atributo `title`.
   - **Falta de identificación del Autor del Hilo (`👑 OP`)** en las respuestas subsecuentes y falta de numeración/ancla directa de cada mensaje (`#1`, `#2`, `#3` con botón `🔗 Copiar enlace`).
   - **Citas sin salto al mensaje original** y **reacciones lentas**: al reaccionar con `+1` o `GG`, la interfaz espera el roundtrip completo del servidor en lugar de aplicar **Optimistic UI** instantáneo.
   - **Imposibilidad de editar o borrar mensajes propios**: aunque la base de datos tiene `updated_at` y la UI contempla el texto `' · editado'`, el usuario no tiene botón para editar una respuesta propia si cometió un error tipográfico.

---

### 1.2. Limitaciones en el Apartado Técnico y Herramientas

1. **Búsqueda limitada solo al título (`threads.ilike('title', ...)`):**
   - Si un usuario busca el nombre de un jefe, arma o término que está en el cuerpo del post (`content`) pero no en el título, el buscador no lo encuentra.
2. **Consulta de juegos en `enrich()` (`src/services/forum.ts`) sin `cover_url`:**
   - Actualmente `db.from('games').select('id,title,slug')` omite `cover_url`, impidiendo renderizar la carátula del juego en la lista de hilos y en la cabecera del debate.
3. **Falta de generador seguro de extractos (`extractForumExcerpt`):**
   - Si se mostrara el inicio de `thread.content` en las tarjetas de hilos sin procesarlo, se verían símbolos Markdown crudos (`**`, `##`) o, peor aún, **se revelarían los spoilers `||secreto||`** en el listado general.
4. **Ausencia de acciones `edit_reply` y `delete_reply` en `forumMutation` (`src/services/forum.ts`):**
   - El endpoint `/api/forum` solo soporta `view`, `preview`, `create`, `reply` y `reaction`. Añadir `edit_reply` y `delete_reply` (restringidos estrictamente a `user_id = user.id`) completa el ciclo CRUD de participación sin requerir migraciones de base de datos.

---

## 2. Arquitectura de Mejoras Propuestas (UX/UI + Técnico)

### 2.1. Evolución del Dominio (`src/domain/forum.ts`)

1. **Extractor seguro de resúmenes con censura automática de Spoilers (`extractForumExcerpt`):**
   Añadir en `src/domain/forum.ts` una función pura y testeable:
   ```ts
   export function extractForumExcerpt(markdown: string, maxLength = 150): {
     excerpt: string;
     hasSpoilers: boolean;
     hasCode: boolean;
   } {
     const hasSpoilers = /\|\|[^\n]+?\|\|/.test(markdown);
     const hasCode = /```[\s\S]*?```/.test(markdown);
     const cleaned = markdown
       .replace(/```[\s\S]*?```/g, ' [Código] ')
       .replace(/\|\|[^\n]+?\|\|/g, ' [Spoiler] ')
       .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
       .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
       .replace(/[#>*_`~-]+/g, ' ')
       .replace(/\s+/g, ' ')
       .trim();
     const excerpt =
       cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trimEnd()}…` : cleaned;
     return { excerpt, hasSpoilers, hasCode };
   }
   ```
2. **Ampliar `ForumThreadSummary`:**
   Incluir `cover_url?: string | null` dentro de `game`:
   ```ts
   export type ForumThreadSummary = ForumThread & {
     author: ForumAuthor | null;
     game: { title: string; slug: string; cover_url?: string | null } | null;
     lastAuthor: ForumAuthor | null;
   };
   ```
3. **Validadores para edición y borrado de respuestas (`validateForumReplyEdit`):**
   ```ts
   export function validateForumReplyEdit(input: unknown) {
     const data = object(input);
     return {
       reply_id: uuid(data.reply_id),
       content: forumText(data.content, 'Respuesta', 8000),
     };
   }
   ```

---

### 2.2. Evolución del Servicio Backend (`src/services/forum.ts`)

1. **Enriquecer `game` con `cover_url` en `enrich()`:**
   Cambiar `db.from('games').select('id,title,slug').in('id', ids)` por:
   ```ts
   db.from('games').select('id,title,slug,cover_url').in('id', ids)
   ```
2. **Mejorar `cachedDirectory` y `forumDirectory`:**
   - Ampliar el límite por defecto de hilos en la portada de `5` a **`15`** (`limit(search ? 24 : 15)`).
   - Permitir filtro opcional por `category` en `forumDirectory(search = '', sort: ForumSort = 'recent', category = '')` para que el usuario pueda filtrar por canal directamente desde `/forum` sin recargar otra ruta si lo desea, o buscar tanto en `title` como en `content`.
3. **Mejorar `forumThreads(category, page, game, sort, search)` en `/forum/[category]`:**
   - Soportar los parámetros opcionales `sort: ForumSort = 'recent'` y `search = ''` dentro de `forumThreads`:
     - Si `search` está presente: `.ilike('title', forumSearchPattern(search))`
     - Si `sort === 'unanswered'`: `.eq('replies_count', 0)`
     - Si `sort === 'active'`: `.order('replies_count', { ascending: false })`
     - Manteniendo siempre `.order('is_pinned', { ascending: false }).order('last_reply_at', { ascending: false })`.
4. **Añadir `edit_reply` y `delete_reply` en `forumMutation` (`src/services/forum.ts`):**
   - `action === 'edit_reply'`:
     - Valida `{ reply_id, content }` con `validateForumReplyEdit(data)` y sanitiza con `cleanMarkdown`.
     - Ejecuta `await db.from('forum_replies').update({ content, updated_at: new Date().toISOString() }).eq('id', validated.reply_id).eq('user_id', user.id).select('id').single()`.
     - Revalida `/forum` y el tag `'forum-directory'`.
   - `action === 'delete_reply'`:
     - Valida `reply_id = uuid(data.reply_id)`.
     - Ejecuta `await db.from('forum_replies').delete().eq('id', reply_id).eq('user_id', user.id)`.
     - Revalida `/forum` y el tag `'forum-directory'`.

---

### 2.3. Barra de Herramientas Markdown y Pestañas en `src/components/forum-editor.tsx`

Transformar `ForumEditor` en un editor moderno de comunidad:
1. **Cabecera del Editor con Pestañas (`✍️ Escribir` | `👁️ Vista previa`) y Toolbar de Formato:**
   - Botones de inserción inteligente sobre la selección actual del `<textarea>` (usando `selectionStart` / `selectionEnd`):
     - **`B`** (`**texto**` — Negrita)
     - **`I`** (`*texto*` — Cursiva)
     - **`H2`** (`## Subtítulo`)
     - **`<>`** (`` `código` `` o bloque ```` ``` ````)
     - **`❝`** (`> Cita`)
     - **`👁️ Spoiler`** (`||spoiler||`)
     - **`🔗 Enlace`** (`[texto](https://)`)
     - **`• Lista`** (`- elemento`)
2. **Atajos de teclado en el `<textarea>`:**
   - `Ctrl+B` / `Cmd+B` para Negrita y `Ctrl+I` / `Cmd+I` para Cursiva.
3. **Contador visual de caracteres con indicador de progreso** (`{value.length} / {max}`).

---

### 2.4. Rediseño de Tarjetas de Hilos (`src/components/forum-thread-list.tsx`)

Enriquecer cada fila `.forum-thread-row`:
1. **Miniatura del Juego Asociado (si `thread.game?.cover_url` existe):**
   - Mostrar a la izquierda de la tarjeta una carátula vertical compacta (`48×64px` con bordes redondeados y borde neón sutil) que enlaza a `/games/${thread.game.slug}`.
2. **Badges Inteligentes de Estado:**
   - Chip de Canal coloreado según el tema (`taberna`, `debate`, `guias`, `indie`, `offtopic`).
   - `📌 Fijado` y `🔒 Cerrado`.
   - `🔥 Candente` cuando `thread.replies_count >= 10 || thread.views_count >= 100`.
   - `👁️ Spoilers` cuando `extractForumExcerpt(thread.content).hasSpoilers` sea `true`.
   - `💻 Código` cuando `extractForumExcerpt(thread.content).hasCode` sea `true`.
3. **Extracto del Hilo (`forum-thread-excerpt`):**
   - Mostrar debajo del título hasta 2 líneas con el extracto limpio devuelto por `extractForumExcerpt(thread.content, 160)` (donde los spoilers ya aparecen censurados como `[Spoiler]`).
4. **Pie de Metadatos y Columna Derecha de Actividad:**
   - Autor con avatar, `@username`, fecha relativa de creación y a la derecha el indicador del último en responder (`Última respuesta de @lastAuthor · hace Xm`) más las píldoras de respuestas y lecturas.

---

### 2.5. Mejora de las Vistas `/forum` y `/forum/[category]`

1. **En `/forum` (`src/app/forum/page.tsx`):**
   - Añadir un **Banner de Estadísticas Globales del Foro** en la cabecera (Total de Canales Activos, Total de Hilos sumando `data.stats`, Total de Mensajes de la comunidad).
   - Añadir píldoras de filtro rápido por canal junto a los botones de orden (`Todas las salas`, `La Taberna Retro`, `Actualidad y Debate`, `Guías`, `Rincón Indie`, `Off-Topic`).
2. **En `/forum/[category]` (`src/app/forum/[category]/page.tsx`):**
   - Añadir una **Tira Superior de Navegación Rápida de Canales (Channel Switcher)** para saltar entre los 5 canales con un clic, resaltando el canal activo con su `--channel-color`.
   - Incorporar la **Barra de Búsqueda en el Canal** y los **3 Filtros de Ordenamiento (`🔥 Más activos`, `⏱️ Recientes`, `❓ Sin respuestas`)** igual que en la portada, preservando los query params en la paginación.

---

### 2.6. Mejora de la Vista de Conversación (`src/components/forum-conversation.tsx`)

1. **Cabecera y Mensaje Inicial (OP) enriquecido:**
   - Distinguir visualmente el **Mensaje Inicial (OP)** con un borde lateral de acento y badge `👑 AUTOR DEL HILO (OP)`.
   - Añadir en el pie del OP y de cada respuesta un botón **`🔗 Copiar enlace`** (que copia la URL del hilo o `#reply-${reply.id}` al portapapeles con confirmación visual `"¡Copiado!"`).
2. **Numeración de Respuestas (`#1`, `#2`, `#3`...), Fechas Relativas y Badge `👑 OP`:**
   - Si `reply.user_id === thread.user_id`, mostrar el badge `👑 OP` junto al nombre del autor en la respuesta.
   - Mostrar tiempo relativo (`notificationAge(reply.created_at, now)`) con el timestamp completo en el `title` del `<time>`.
   - Si la respuesta tiene una cita (`reply.quote`), incluir un enlace ancla `↑ Ver mensaje citado (#)` que haga scroll suave hacia `#reply-${reply.reply_to_id}` si está en la misma página.
3. **Reacciones con Optimistic UI:**
   - Mantener un estado local optimista de las reacciones (`optimisticReplies`) para que al hacer clic en `+1`, `GG`, `🤯` o `Game Over` el contador y el estado activo cambien **instantáneamente**, sincronizando con el servidor en segundo plano.
4. **Edición y Eliminación de Respuestas Propias (`viewerId === reply.user_id`):**
   - Cuando el usuario autenticado es el autor de una respuesta (`viewerId === reply.user_id`) y el hilo no está cerrado:
     - Mostrar botones `✏️ Editar` y `🗑️ Eliminar` en la barra de acciones de esa respuesta.
     - Al pulsar `✏️ Editar`, abrir un `ForumEditor` inline con el contenido actual de la respuesta y botones `Guardar cambios` / `Cancelar` que llamen a `api('forum', { action: 'edit_reply', reply_id: reply.id, content })`.
     - Al pulsar `🗑️ Eliminar`, pedir confirmación rápida y llamar a `api('forum', { action: 'delete_reply', reply_id: reply.id })`.

---

## 3. Plan de Verificación

1. Ejecutar `npm test` y verificar que `tests/unit/forum.test.ts` pasa todos los tests existentes y las nuevas pruebas de `extractForumExcerpt` (censura de spoilers `||...||`, limpieza de Markdown) y `validateForumReplyEdit`.
2. Ejecutar `npm run build` para comprobar que las páginas `/forum`, `/forum/[category]` y `/forum/[category]/[thread_id]` compilan sin errores de tipos.
3. Verificar visualmente:
   - El nuevo toolbar de formato Markdown y las pestañas `Escribir / Vista previa` en `ForumEditor`.
   - Los extractos seguros, badges (`🔥 Candente`, `👁️ Spoilers`) y miniaturas de juegos en `ForumThreadList`.
   - El buscador, filtros de orden y selector de canales en `/forum/[category]`.
   - Las reacciones instantáneas, copiado de enlaces, badge `👑 OP` y edición/eliminación de respuestas propias en `ForumConversation`.
