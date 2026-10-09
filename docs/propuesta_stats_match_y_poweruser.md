# Propuesta Técnica: Stats Center, Match Gamer, Vista Tabla y Paleta de Comandos (Ctrl+K)

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Estado:** Propuesta de arquitectura y especificación técnica para revisión y ejecución  

---

## 1. Visión y Alcance

Tras consolidar la persistencia de horas, la visualización de Gamerscore/Trofeos y la sincronización de logros de Steam (migración `019`), esta propuesta define los próximos cuatro pilares de evolución para **SaveState**:

1. **Usabilidad de Biblioteca (Filtros Avanzados y Vista Tabla vs Vitrina):** Permitir a los coleccionistas ordenar y auditar su biblioteca por horas, notas y porcentaje de completismo.
2. **Paleta de Comandos Global (`Ctrl + K`):** Navegación y búsqueda instantánea sin ratón estilo Spotlight/Raycast.
3. **Dashboard de Estadísticas del Perfil ("Stats Center"):** Métricas visuales agregadas (horas totales, desglose de estados, completismo de logros y plataformas favoritas).
4. **Comparador Social de Bibliotecas ("Match Gamer"):** Visualizar títulos en común, divergencia de notas y afinidad gamer al visitar el perfil de otro usuario.

---

## 2. Módulo 1: Vista Tabla y Filtros Avanzados en Biblioteca

### 2.1. Problema actual
Actualmente, `/library` muestra las fichas en cuadrícula visual de carátulas (vitrina). Cuando un usuario tiene decenas de juegos, es difícil ordenar rápidamente para responder preguntas como:
* *¿Cuáles son mis juegos con más de 50 horas?*
* *¿Qué juegos tengo con el 100% de logros platinados?*
* *¿Qué títulos tengo calificados con 9 o más?*

### 2.2. Especificación de diseño
* **Selector de modo:** Botones toggle en la barra de herramientas de `/library`:
  * `[ ⊞ Vitrina ]` (modo cuadrícula actual).
  * `[ ☰ Tabla ]` (modo lista/tabla compacta).
  * Persistencia en `localStorage` (`savestate_library_view_mode: 'grid' | 'table'`).
* **Columnas del Modo Tabla:**
  1. **Juego:** Carátula miniatura (32x44 px) + Título + Año.
  2. **Plataforma:** Badge de consola / PC.
  3. **Estado:** Badge temático (`Jugando` en cian, `Completado` en verde, `Backlog` en ámbar, `Abandonado` en gris).
  4. **Horas:** Valor numérico formateado (`124.5 h`) con icono de reloj.
  5. **Logros:** Mini-barra de progreso neón con porcentaje y conteo (`X / Y` o `Z%`).
  6. **Nota:** Badge con estrella y puntuación (`9.5 / 10`).
  7. **Acciones:** Menú rápido (editar notas/horas, abrir modal de ficha).
* **Opciones de ordenamiento dinámico:**
  * Por horas jugadas (descendente / ascendente).
  * Por porcentaje de logros (descendente / ascendente).
  * Por nota personal (descendente / ascendente).
  * Alfabético (A-Z / Z-A).
  * Más recientes primero.
* **Filtros rápidos (Pills):**
  * `[ 🏆 100% Platinados ]` (filtra `console_progress.percentage = 100`).
  * `[ ⭐ Obras maestras (>= 9.0) ]`.
  * Filtro por plataforma: `PC / Steam`, `Xbox`, `PlayStation`, `Nintendo`, `Retro/Emulador`.

---

## 3. Módulo 2: Paleta de Comandos Rápida (`Ctrl + K` / `Cmd + K`)

### 3.1. Objetivo
Brindar una experiencia "Power User" ultra veloz donde el usuario pueda acceder a cualquier parte del sistema o buscar juegos sin levantar las manos del teclado.

### 3.2. Especificación técnica
* **Activador:** Listener global de teclado para `(e.ctrlKey || e.metaKey) && e.key === 'k'`.
* **Componente:** `src/components/command-palette.tsx` montado en el layout principal.
* **Comportamiento y secciones del menú:**
  1. **Búsqueda en Biblioteca (Instantánea, local):**
     * Busca títulos que ya están en la biblioteca del usuario logueado en memoria (0 ms latencia).
  2. **Buscar en Catálogo Global (IGDB):**
     * Si no coincide con la biblioteca o se selecciona la opción *"Buscar en catálogo IGDB..."*, dispara consulta perezosa con debounce (300 ms).
  3. **Navegación Rápida:**
     * `Ir a Mi Biblioteca` (`/library`)
     * `Ir a Mi Perfil` (`/profile/[username]`)
     * `Ir a Amigos y Solicitudes` (`/friends`)
     * `Explorar Reseñas Comunitarias` (`/reviews`)
  4. **Acciones Rápidas:**
     * `Registrar nuevo juego manual`
     * `Cambiar vista de biblioteca (Vitrina / Tabla)`
* **Accesibilidad:** Soporte total de navegación con flechas arriba/abajo, Enter para seleccionar y Escape para cerrar.

---

## 4. Módulo 3: Dashboard de Estadísticas del Perfil ("Stats Center")

### 4.1. Objetivo
Convertir el perfil de usuario en un resumen gamer prestigioso y visualmente atractivo que resuma toda su trayectoria de juego.

### 4.2. Métricas y componentes visuales (`src/components/profile-stats.tsx`)
1. **Tarjeta de Horas Totales:**
   * Suma agregada de `hours` de todos los `play_logs`.
   * Equivalencia gamer simpática (ej: *"Equivalente a 14 días ininterrumpidos de juego"*).
2. **Tasa de Finalización de Biblioteca (Completion Rate):**
   * Porcentaje de juegos en estado `completed` respecto al total (`completed / total * 100`).
3. **Distribución de Estados (Gráfico de barra segmentada o dona SVG puro):**
   * Verde: Completados (%).
   * Cian: Jugando actualmente (%).
   * Ámbar: En Backlog (%).
   * Rojo/Gris: Abandonados (%).
4. **Salón de Platinos / 100%:**
   * Contador de títulos completados al 100% en logros o trofeos.
5. **Radar / Distribución de Plataformas:**
   * Horas acumuladas por plataforma (Steam vs Xbox vs PlayStation vs Emuladores).
6. **Nota Media Comunitaria vs Personal:**
   * Tu promedio de puntuación personal en la plataforma.

### 4.3. Rendimiento
* Todos los datos se calculan a partir de los registros que ya devuelve Supabase para el perfil público. No requiere tablas adicionales ni endpoints externos.

---

## 5. Módulo 4: Comparador de Bibliotecas ("Match Gamer")

### 5.1. Objetivo
Fomentar la interacción social y la curiosidad entre amigos al visitar perfiles ajenos.

### 5.2. Especificación de interacción
* Al entrar al perfil público de otro usuario (`/profile/[username]`):
  * Si el visitante tiene sesión activa y no es su propio perfil, se habilita una pestaña o botón: `[ 🎮 Match Gamer con @username ]`.
* **Cálculo de Afinidad (% Match):**
  * Basado en el coeficiente de solapamiento de bibliotecas:
    $$\text{Match} = \frac{\text{Juegos en común}}{\min(\text{Total juegos A}, \text{Total juegos B})} \times 100$$
* **Secciones del Comparador:**
  1. **Juegos que ambos jugaron:**
     * Comparativa de notas lado a lado:
       * *Ejemplo:* **Cyberpunk 2077** — Tú le diste **9.5** / Tu amigo le dio **7.0** (*"¡Discrepancia de 2.5 puntos!"*).
  2. **Juegos que tú completaste y tu amigo tiene en Backlog:**
     * Excelente disparador de conversación o recomendación.
  3. **Tus recomendaciones para él:**
     * Juegos que tú tienes en calificación >= 9.0 que él aún no tiene en su biblioteca.

---

## 6. Secuencia de Ejecución Recomendada para Codex

Para una implementación limpia y modular en `implementation/chatgpt`:

1. **Fase 1 (Inmediata / UI Biblioteca):**
   * Implementar selector Vitrina / Tabla en `src/components/library.tsx`.
   * Agregar ordenamiento por Horas, % Logros y Nota.
2. **Fase 2 (Power User):**
   * Crear el componente `src/components/command-palette.tsx` y enlazar `Ctrl+K`.
3. **Fase 3 (Perfil & Gamificación):**
   * Crear el componente `src/components/profile-stats.tsx` e integrarlo en la cabecera/pestañas de `/profile/[username]`.
4. **Fase 4 (Social):**
   * Implementar la vista/modal de `Match Gamer` en perfiles ajenos.
5. **Verificación:**
   * Validar con `npm run check` asegurando que todos los tests sigan pasando.
