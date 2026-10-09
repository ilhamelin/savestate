# Propuesta Técnica: Sistema de Niveles de Jugador (Player Level), XP y Recompensas Desbloqueables

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría, Diseño e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura técnica, modelo matemático de experiencia (XP), catálogo de recompensas cosméticas (títulos, marcos de avatar, paletas) e integración de interfaz para el nuevo sistema de progresión de niveles en Savestate.

---

## 1. Visión del Sistema

El **Sistema de Niveles de Savestate** convierte el uso diario de la plataforma en un juego de rol retro. Cada acción del jugador —registrar partidas, platinar juegos, escribir reseñas, participar en duelos o sincronizar sus consolas— otorga **Puntos de Experiencia (XP)**.

Al acumular XP, el jugador sube de nivel, desbloqueando:
1. **Insignia de Nivel visible en el perfil:** Un distintivo pixelado retro (`LVL 12`) sobre el avatar o junto al nombre.
2. **Barra de Progreso HUD:** Barra estilo videojuego clásico que muestra el progreso hacia el siguiente nivel (`XP actual / XP meta`).
3. **Títulos de Jugador desbloqueables:** Etiquetas nostálgicas que el usuario puede equipar bajo su nombre (ej: *[Cartridge Blower]*, *[Achievement Hunter]*, *[Final Boss]*).
4. **Marcos de Avatar exclusivos (Avatar Frames):** Bordes temáticos retro que envuelven el avatar (Bronce Arcade, Famicom 8-Bit, Neón Cyberpunk, CRT Glitch, Holográfico Dorado).
5. **Paletas y Temas de Habitación Gamer (`GamerRoom`):** Nuevas estéticas desbloqueables en niveles clave.

---

## 2. Fuentes de XP y Mecánicas de Obtención

Para garantizar que el sistema recompense el juego genuino y prevenga el spam o bots, la XP se otorga mediante eventos controlados:

### 2.1. Tabla de Acciones y Puntos

| Categoría | Acción | XP Otorgada | Límite / Regla Anti-Exploit |
|---|---|---|---|
| **Biblioteca** | Terminar un juego (`Cleared`) | **+150 XP** | 1 vez por juego en biblioteca. |
| | Platinar un juego (`Platinum` / 100%) | **+300 XP** | 1 vez por juego en biblioteca. |
| | Registrar una sesión de juego (`QuickSession`) | **+10 XP** | Cooldown de 30 min entre sesiones del mismo juego. |
| | Horas de juego acumuladas | **+15 XP** por hora | Máximo 24h registradas por día. |
| | Agregar un juego a la biblioteca | **+5 XP** | Máximo 10 juegos por día. |
| **Comunidad** | Escribir una reseña (mínimo 100 caracteres) | **+75 XP** | 1 vez por juego. |
| | Publicar un Momento / Highlight | **+40 XP** | Máximo 3 momentos con XP por día. |
| | Recibir reacciones (`GG`, `Critical Hit`) | **+5 XP** | Máximo 50 XP al día por reacciones recibidas. |
| **Social / Foros** | Publicar un hilo en la comunidad | **+25 XP** | Máximo 2 hilos al día. |
| | Responder en un hilo del foro | **+10 XP** | Máximo 5 respuestas al día. |
| **Sincronización** | Conectar y sincronizar Steam por 1ª vez | **+200 XP** | Única vez por cuenta. |
| | Conectar y sincronizar PSN por 1ª vez | **+200 XP** | Única vez por cuenta. |
| | Conectar y sincronizar Xbox por 1ª vez | **+200 XP** | Única vez por cuenta. |
| **Arcade** | Votar o participar en un Duelo | **+15 XP** | Máximo 5 participaciones por día. |
| | Ganar un duelo o desafío | **+50 XP** | Máximo 2 victorias por día. |
| **Medallas** | Desbloquear cualquier insignia (`Badge`) | **+100 XP** | Única vez por insignia desbloqueada. |

---

## 3. Curva Matemática de Nivel (Level Curve)

Para brindar gratificación inmediata a los nuevos usuarios y reservar los niveles altos para veteranos, la curva de nivel sigue una progresión exponencial suave:

$$\text{XP necesaria para Nivel } N = \lfloor 100 \times (N - 1)^{1.65} \rfloor$$

### Escala de Referencia:
- **Nivel 1:** 0 XP (Estado inicial: *Insert Coin*)
- **Nivel 2:** 100 XP (~1 juego completado)
- **Nivel 3:** 314 XP (~1 platino)
- **Nivel 5:** 985 XP
- **Nivel 10:** 4.460 XP
- **Nivel 20:** 15.200 XP
- **Nivel 35:** 41.500 XP
- **Nivel 50:** 78.900 XP (Rango Máximo: *Final Boss*)

---

## 4. Catálogo de Rangos y Recompensas Desbloqueables

El camino de recompensas se divide en 5 grandes Eras/Rangos Retro:

```
[Nivel 1 - 9]   Tier I: Arcade Rookie
[Nivel 10 - 19] Tier II: 8-Bit Grinder
[Nivel 20 - 29] Tier III: 16-Bit Master
[Nivel 30 - 49] Tier IV: Cartridge Legend
[Nivel 50+]     Tier V: Final Boss (Prestigio)
```

### 4.1. Desglose de Desbloqueos por Nivel

| Nivel | Recompensa Desbloqueada | Tipo | Descripción |
|---|---|---|---|
| **1** | Título: *Insert Coin* | Título | El comienzo del viaje. |
| **3** | Título: *Button Masher* | Título | Para los que no temen romper el mando. |
| **5** | Marco: **Bronce Arcade** | Marco de Avatar | Borde metálico con textura de máquina recreativa. |
| **7** | Título: *Backlog Explorer* | Título | Explorador de juegos pendientes. |
| **10** | Marco: **Famicom 8-Bit** | Marco de Avatar | Clásico borde pixelado rojo y dorado. |
| **10** | Título: *Cartridge Blower* | Título | Técnica milenaria de soplado de pines. |
| **15** | Marco: **Cyber Neon Cyan** | Marco de Avatar | Borde brillante con resplandor neón cian. |
| **15** | Paleta de Habitación: *Game Boy Monochrome* | Room Theme | Habitación con estética verde fósforo clásica. |
| **20** | Marco: **Dorado 16-Bit** | Marco de Avatar | Oro pulido con esquinas pixeladas. |
| **20** | Título: *Save Scummer* | Título | Guardar la partida antes de cada decisión. |
| **25** | Marco: **CRT Glitch Scanlines** | Marco de Avatar | Efecto de monitor CRT con líneas de barrido. |
| **25** | Título: *Speedrunner* | Título | Dominio de glitches y atajos. |
| **30** | Marco: **Platino Shimmer** | Marco de Avatar | Borde cromado brillante reservado a completistas. |
| **30** | Título: *Achievement Hunter* | Título | Cazador incansable de trofeos y logros. |
| **40** | Marco: **Vaporwave Sunset** | Marco de Avatar | Gradiente rosa y violeta estilo synthwave 80s. |
| **40** | Título: *Secret Boss* | Título | Enemigo oculto en la mazmorra final. |
| **50** | Marco: **Holográfico Final Boss** | Marco de Avatar | Borde dorado holográfico animado con partículas. |
| **50** | Título: *Final Boss* | Título | Título mítico de máxima jerarquía. |

---

## 5. Diseño de Base de Datos (Migración SQL)

### Migración: `202610090017_player_levels.sql`

```sql
begin;

-- 1. Nuevas columnas de nivel y personalización en profiles
alter table public.profiles
  add column if not exists xp integer not null default 0 check (xp >= 0),
  add column if not exists level integer not null default 1 check (level >= 1),
  add column if not exists equipped_title text not null default 'Insert Coin',
  add column if not exists equipped_frame text not null default 'default';

-- 2. Tabla de auditoría y eventos de experiencia (anti-duplicación)
create table if not exists public.user_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  action text not null,
  reference_id text, -- ID del juego, reseña, o post para evitar duplicados
  created_at timestamptz not null default now()
);

create unique index if not exists idx_xp_events_unique_action
  on public.user_xp_events (user_id, action, reference_id)
  where reference_id is not null;

create index if not exists idx_xp_events_user_date
  on public.user_xp_events (user_id, created_at);

-- 3. Función RPC segura para otorgar XP y calcular subidas de nivel
create or replace function public.award_xp(
  p_user_id uuid,
  p_amount integer,
  p_action text,
  p_reference_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_xp integer;
  v_new_xp integer;
  v_old_level integer;
  v_new_level integer;
  v_leveled_up boolean := false;
begin
  -- Si tiene reference_id, verificar si ya fue otorgado
  if p_reference_id is not null then
    if exists (
      select 1 from public.user_xp_events
      where user_id = p_user_id and action = p_action and reference_id = p_reference_id
    ) then
      return jsonb_build_object('success', false, 'reason', 'already_awarded');
    end if;
  end if;

  -- Registrar evento
  insert into public.user_xp_events (user_id, amount, action, reference_id)
  values (p_user_id, p_amount, p_action, p_reference_id);

  -- Leer estado actual
  select xp, level into v_old_xp, v_old_level from public.profiles where id = p_user_id;
  v_new_xp := v_old_xp + p_amount;

  -- Calcular nuevo nivel: Formula Level = floor((xp / 100) ^ (1 / 1.65)) + 1
  v_new_level := greatest(1, floor(power(v_new_xp::numeric / 100.0, 1.0 / 1.65))::integer + 1);

  if v_new_level > v_old_level then
    v_leveled_up := true;
  end if;

  -- Actualizar perfil
  update public.profiles
  set xp = v_new_xp, level = v_new_level
  where id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'awarded', p_amount,
    'total_xp', v_new_xp,
    'level', v_new_level,
    'leveled_up', v_leveled_up
  );
end;
$$;

-- 4. Permisos
grant select on public.user_xp_events to authenticated;
grant execute on function public.award_xp to service_role;
grant update (equipped_title, equipped_frame) on public.profiles to authenticated;

commit;
```

---

## 6. Arquitectura de Componentes de Frontend

### 6.1. Componente `LevelBadge` & `LevelProgress` (`src/components/level-progression.tsx`)
1. **Insignia `LevelBadge`:**
   - Renderiza un pill pixelado con brillo sutil: `[ ✦ LVL 14 ]`.
   - Se muestra junto al nombre de usuario en `ProfileIdentity` y en tarjetas de comentarios/foros.
2. **Barra HUD `LevelProgress`:**
   - Muestra:
     - Nivel actual y título equipado.
     - Barra de llenado animada con porcentaje (`540 / 985 XP · 54%`).
     - Próxima recompensa al siguiente nivel (ej: *Próximo nivel: Marco Bronce Arcade*).
3. **Modal "Camino de Recompensas" (Rewards Road):**
   - Se abre al hacer clic sobre la barra de XP.
   - Lista interactiva que recorre los niveles del 1 al 50:
     - Niveles desbloqueados marcados en verde con checkmark `[✓ Desbloqueado]`.
     - Nivel actual resaltado con cursor intermitente.
     - Próximos cosméticos con icono de candado.

### 6.2. Componente `AvatarFrame` (`src/components/avatar-frame.tsx`)
- Envuelve el avatar actual en `ProfileIdentity`:
  ```tsx
  <div className={`avatar-container frame-${profile.equipped_frame}`}>
    <Image src={profile.avatar_url} ... />
    <span className="frame-overlay" />
  </div>
  ```
- Clases CSS en `src/app/globals.css` que aplican los bordes con `box-shadow`, bordes retro o efectos animados (resplandor cian, scanlines CRT, borde dorado).

### 6.3. Selector de Cosméticos en Profile Studio (`/settings`)
- Pestaña o sección **"Nivel y Cosméticos"**:
  - Selector de **Título Equipado:** Menú desplegable que solo muestra los títulos alcanzados según el nivel actual del usuario.
  - Selector de **Marco de Avatar:** Malla de opciones con vista previa en directo del avatar envuelto en el marco seleccionado.

---

## 7. Plan de Implementación para Codex

1. **Migración SQL:** Crear y ejecutar `202610090017_player_levels.sql` en Supabase.
2. **Dominio (`src/domain/progression.ts`):**
   - Fórmulas de XP, cálculo de nivel, lista de recompensas por nivel, tipos `PlayerTitle` y `AvatarFrame`.
   - Función `unlockedRewards(level)` para determinar qué títulos y marcos puede equipar el usuario.
3. **Servicio (`src/services/progression.ts`):**
   - Función para invocar el RPC `award_xp` desde los servicios existentes (al registrar partida, platinar, publicar reseña, etc.).
4. **Componentes:**
   - `LevelBadge`, `LevelProgress` y `AvatarFrame`.
   - Integración en `ProfileIdentity`, `/players/[username]` y `/settings`.
5. **Estilos:**
   - Definición de los marcos de avatar y barras pixeladas en `src/app/globals.css`.
6. **Tests unitarios:**
   - `tests/unit/progression.test.ts` para validar la fórmula de XP, límites y desbloqueos.
