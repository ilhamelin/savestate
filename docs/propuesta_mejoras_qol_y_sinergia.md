# Propuesta Técnica: Mejoras de Calidad de Vida (QoL) y Sinergia Comunitaria
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar un paquete de mejoras de experiencia de usuario, unificación entre el catálogo de juegos y la comunidad (Foros y Momentos), temas globales de fósforo CRT y la Ruleta del Backlog.

---

## 1. Alcance Funcional del Paquete QoL

Este paquete conecta las piezas que ya construimos para que la web se sienta orgánica y cohesiva:

1. **Sinergia Total en la Ficha del Juego (`/games/[slug]`):**
   - **Hilos del Foro:** Mostrar los debates de `forum_threads` asociados a ese juego (`game_id = game.id`), con botón directo: *"Iniciar conversación sobre este juego en el foro"*.
   - **Momentos Comunitarios:** Carrusel o cuadrícula de publicaciones de `posts` con videos y capturas asociadas a ese título.
2. **Paletas Globales de Monitor CRT (Temas de Fósforo):**
   - Evolucionar el botón `CRT` para permitir alternar entre 4 estéticas retro auténticas que transforman los colores de acento de toda la web:
     - `Cyber Cyan` *(Predeterminado: azul/cian neón).*
     - `Matrix Green` *(Fósforo verde de terminal de los 80s).*
     - `Amber CRT` *(Fósforo ámbar cálido clásico de fósforo P3).*
     - `Game Boy DMG` *(Paleta verde oliva monocromática de la consola de 1989).*
   - Persistente en `localStorage`.
3. **La Ruleta del Backlog en `/library`:**
   - Botón interactivo arcade: *"🎰 Girar Ruleta del Backlog"*.
   - Selecciona aleatoriamente uno de los títulos marcados como `backlog` con una animación retro de rodillo, destacando la próxima partida recomendada.
4. **Contador de Tiempo Invertido:**
   - En la cabecera de la biblioteca, mostrar el contador acumulado de horas jugadas (`play_logs.hours_played`), dando valor inmediato a las horas importadas de Steam y registradas manualmente.

---

## 2. Especificación Técnica de Componentes

### 2.1. Ficha del Juego (`src/app/games/[slug]/page.tsx`)
* **Consultas agregadas:**
  ```ts
  const [threadsResult, momentsResult] = await Promise.all([
    db.from('forum_threads')
      .select('id, category_id, title, replies_count, last_reply_at, user_id')
      .eq('game_id', game.id)
      .order('last_reply_at', { ascending: false })
      .limit(5),
    db.from('posts')
      .select('id, title, media_type, youtube_video_id, image_urls, user_id')
      .eq('game_id', game.id)
      .limit(6),
  ]);
  ```
* **Sección "Conversaciones en el Foro":**
  - Lista de hilos con título, autor, número de respuestas y última actividad.
  - Botón: `[+ Iniciar debate en el Foro]` que enlaza a `/forum/general-gaming?game=${game.id}` con el juego pre-seleccionado.
* **Sección "Momentos de este Juego":**
  - Mini-tarjetas con reproductor o imágenes de momentos épicos de la comunidad.

### 2.2. Paletas de Fósforo CRT (`src/components/ui/crt-toggle.tsx`)
* Al hacer clic en el botón CRT, o mediante un desplegable compacto, el usuario puede ciclar o elegir el color del fósforo:
  ```css
  /* Variables CSS dinámicas según el tema CRT seleccionado */
  [data-crt-theme="green"] {
    --accent: #33ff66;
    --accent-glow: rgba(51, 255, 102, 0.25);
  }
  [data-crt-theme="amber"] {
    --accent: #ffb000;
    --accent-glow: rgba(255, 176, 0, 0.25);
  }
  [data-crt-theme="dmg"] {
    --accent: #8bac0f;
    --accent-glow: rgba(139, 172, 15, 0.25);
  }
  ```
* Se inyecta en el elemento raíz `<html>` o en el overlay CRT.

### 2.3. Ruleta del Backlog (`src/components/library/backlog-roulette.tsx`)
* Un botón estilo arcade en `/library`: `[ 🎰 Elegir mi próxima aventura ]`.
* Al pulsar:
  - Filtra los juegos de la biblioteca con `status === 'backlog'`.
  - Si hay juegos en el backlog, reproduce una animación de barajado rápido de carátulas durante 1.5 segundos.
  - Se detiene en el juego seleccionado y despliega un diálogo o tarjeta destacada: *"La consola ha hablado: tu próxima partida es [Título]"* con enlace directo a su ficha.

---

## 3. Criterios de Calidad y Verificación

1. **Sin nuevas migraciones SQL:** Toda la información ya existe en las tablas `games`, `posts`, `forum_threads`, `user_games` y `play_logs`.
2. Las consultas adicionales en `/games/[slug]` se ejecutan en paralelo mediante `Promise.all` para no añadir latencia perceptible.
3. La Ruleta del Backlog funciona enteramente en cliente sobre los datos ya cargados en la biblioteca, con soporte accesible y sin bloqueos de interfaz.
4. Verificación completa con `npm run check` y `npm run build`.
