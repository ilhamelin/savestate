# Propuesta Técnica: Dossier de Estadísticas Gamer, Hardware Propio y "Memory Card" Descargable
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la vitrina de consolas y plataformas del usuario, las analíticas avanzadas de juego (Clear Rate y Hardware vs Emulador) y la tarjeta gráfica "SaveState Memory Card" descargable.

---

## 1. Visión y Alcance Funcional

Esta funcionalidad transforma el perfil del usuario en una radiografía exhaustiva de su identidad y hábitos como jugador:

1. **Vitrina de Consolas y Hardware del Usuario ("Mis Plataformas"):**
   - El usuario declara en su Profile Studio (`/settings`) qué plataformas y consolas posee físicamente (ej. *PC, PS5, Switch, Game Boy Advance, PS2, Xbox Series X*).
   - Se muestra en el perfil público como una estantería de hardware con insignias retro.
2. **Ecosistema de Plataformas & Método de Juego:**
   - Desglose gráfico porcentual de las plataformas donde más juega.
   - Proporción entre partidas en **Hardware Original vs Emuladores** (aprovechando el campo nativo `play_method` de la tabla `play_logs`).
3. **Termómetro del Backlog & Tasa de Finalización (Clear Rate):**
   - Cálculo del porcentaje de efectividad: `Clear Rate = (Juegos Completados / Total Empezados) * 100`.
   - Distribución visual del estado de la biblioteca (Completados, Jugando, Backlog, Abandonados).
   - Horas totales acumuladas de juego y promedio de horas por título superado.
4. **La "SaveState Memory Card" Descargable:**
   - Tarjeta gráfica con estética de Memory Card de PS1 / GameCube generada en cliente en formato PNG (1080x1350 o 1200x630).
   - Contiene: Avatar, username, consolas que posee, Clear Rate, horas de juego y su Top 4 de juegos con enlace/QR a su perfil.

---

## 2. Nueva Migración SQL: `202610080012_owned_platforms.sql`

Solo se requiere añadir una columna a `profiles` para registrar las consolas del usuario y conceder el permiso de actualización de columna:

```sql
begin;

-- 1. Columna de plataformas en propiedad del usuario
alter table public.profiles
  add column if not exists owned_platforms text[] not null default '{}';

-- 2. Conceder actualización de columna a usuarios autenticados
grant update (owned_platforms) on public.profiles to authenticated;

commit;
```

---

## 3. Especificación de Componentes e Interfaz

### 3.1. Selector de Consolas en Profile Studio (`src/components/profile-studio/` o `/settings`)
* **Lista de Plataformas Populares con Toggle:**
  - `PC / Steam`, `PlayStation 5`, `PlayStation 4`, `PlayStation 2`, `PlayStation 1`, `Nintendo Switch`, `Nintendo 64`, `Super Nintendo (SNES)`, `Game Boy / GBA`, `Xbox Series`, `Xbox 360`, `Sega Genesis / Mega Drive`, `Steam Deck / Portátil PC`.
  - Opción de escribir una plataforma retro personalizada con tecla `Enter`.
* **Guardado reactivo:** Se integra en el dock flotante existente (`Guardar cambios / Descartar`).

### 3.2. Pestaña o Sección "Dossier de Estadísticas" (`/players/[username]` o `/players/[username]/stats`)
* **Bloque 1: Mis Consolas y Hardware:**
  - Badges con estilo de cartucho/consola destacando las plataformas activas del jugador.
* **Bloque 2: Termómetro del Backlog & Clear Rate:**
  - Barra de estado segmentada con colores temáticos:
    - 🟩 Completados (`cleared`): 62%
    - 🩵 En progreso (`playing`): 12%
    - 🟨 En Backlog (`backlog`): 22%
    - 🟥 Abandonados (`abandoned`): 4%
  - Métricas clave en display de 7 segmentos / monospace:
    - **Clear Rate:** `62%`
    - **Horas Totales:** `184.5 hrs`
    - **Promedio por juego:** `18.2 hrs`
* **Bloque 3: Ecosistema y Método:**
  - Comparativa: `75% Hardware Físico · 25% Emulación`.
  - Top 3 plataformas más jugadas con barras de progreso de 8 bits.

### 3.3. Componente "SaveState Memory Card" (`<MemoryCardExport />`)
* **Diseño Visual:**
  - Inspirado en la interfaz de gestión de bloques de memoria de los años 90 (Sony PlayStation / Nintendo GameCube).
  - Marco con bisel, cabecera `"SAVESTATE MEMORY CARD // 15 BLOCKS"`.
  - Avatar, nombre `@username`, estado de terminal, iconos de sus consolas, medalla de Clear Rate y miniaturas de sus 4 juegos favoritos.
* **Mecanismo de Exportación:**
  - Botón: `[ 💾 Descargar Memory Card (PNG) ]`.
  - Renderizado mediante `canvas.toBlob()` o biblioteca estándar de exportación de nodos DOM a imagen, optimizada para descargar en un clic sin marcas de agua.

---

## 4. Criterios de Aceptación y Calidad

1. La selección de consolas persiste correctamente en `profiles.owned_platforms` y se visualiza fielmente en el perfil público.
2. El Clear Rate se calcula con precisión matemática excluyendo juegos que solo están en lista de deseos o backlog no iniciado.
3. El desglose de Hardware vs Emulación respeta las entradas existentes en `play_logs.play_method`.
4. La generación de la imagen de la Memory Card es instantánea y se descarga con resolución nítida para compartir en Discord, Twitter o Instagram.
