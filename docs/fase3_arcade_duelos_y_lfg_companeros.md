# Propuesta Técnica: Fase 3 — Duelos de Juegos, Buscador de Compañeros (LFG) y Habitación Gamer
**Fecha:** 7 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar las nuevas mecánicas interactivas de comunidad: enfrentamientos de títulos 1v1, tablón de emparejamiento de jugadores y temas visuales de "Habitación Gamer".

---

## 1. Alcance Funcional

Esta fase introduce dinamismo lúdico y utilidad social directa para conectar a los jugadores:
1. **Duelo de Juegos (Versus 1v1):** Widget interactivo de enfrentamiento donde la comunidad vota entre dos títulos icónicos, revelando al instante los porcentajes arcade de preferencia global.
2. **“Busco Compañero de Partida” (LFG / Party Finder):** Tablón comunitario donde los jugadores convocan sesiones de juego indicando juego, plataforma, horario y modalidad (casual o competitiva), con expiración automática a 48 horas.
3. **Habitación Gamer (Skins de Perfil):** Posibilidad de vestir el perfil público con estéticas inmersivas: *Consola Portátil* (Game Boy / PSP), *Terminal CRT* (Hacker retro) o *Estantería Retro* (Cajas físicas de colección).

---

## 2. Nueva Migración SQL: `202610070008_arcade_and_parties.sql`

```sql
begin;

-- 1. Nueva columna de personalización en profiles para skins de habitación
alter table public.profiles
  add column if not exists room_theme text not null default 'crt_terminal'
  check (room_theme in ('crt_terminal', 'handheld_console', 'retro_shelf'));

-- 2. Sistema de Duelos de Juegos
create table public.game_duels (
  id uuid primary key default gen_random_uuid(),
  game_a_id uuid not null references public.games(id) on delete cascade,
  game_b_id uuid not null references public.games(id) on delete cascade,
  title text not null default 'Duelo Comunitario' check (length(title) <= 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (game_a_id <> game_b_id)
);

create table public.duel_votes (
  duel_id uuid not null references public.game_duels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chosen_game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);

-- RLS Duelos
alter table public.game_duels enable row level security;
alter table public.duel_votes enable row level security;

create policy duels_read on public.game_duels for select using (true);
create policy duel_votes_read on public.duel_votes for select using (true);
create policy duel_votes_cast on public.duel_votes for insert to authenticated
  with check (user_id = auth.uid());

grant select on public.game_duels, public.duel_votes to anon, authenticated;
grant insert on public.duel_votes to authenticated;

-- 3. Sistema de Compañero de Partida (LFG)
create table public.party_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  platform text not null check (platform in ('PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Retro/Emulador', 'Multiplataforma')),
  playstyle text not null check (playstyle in ('casual', 'competitive', 'coop_campaign', 'achievements')),
  schedule text not null check (length(schedule) between 3 and 100),
  contact_note text not null check (length(contact_note) between 3 and 500),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now()
);

create index party_requests_recent on public.party_requests(created_at desc)
  where expires_at > now();

-- RLS LFG
alter table public.party_requests enable row level security;

create policy party_requests_read on public.party_requests for select
  using (expires_at > now());
create policy party_requests_create on public.party_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy party_requests_delete on public.party_requests for delete to authenticated
  using (user_id = auth.uid());

grant select on public.party_requests to anon, authenticated;
grant insert, delete on public.party_requests to authenticated;

commit;
```

---

## 3. Especificación de Componentes e Interfaz

### 3.1. Widget "Duelo de Juegos" (`<GameDuelWidget />`)
* **Ubicación:** Visible en la página principal (`/`) o en la cabecera de `/explore`.
* **Mecánica:**
  - Dos carátulas enfrentadas con efecto de choque visual tipo Street Fighter (`VS`).
  - Botones de acción: `[ Votar por Game A ]` y `[ Votar por Game B ]`.
  - Al votar, se efectúa la mutación y se transforman las tarjetas mostrando el porcentaje exacto de votos de cada uno con barras de progreso de 8 bits y el total de votantes.
  - Si el usuario ya votó previamente, el componente carga directamente los porcentajes con su opción resaltada.

### 3.2. Módulo "Busco Compañero" (`/parties`)
* **Navegación:** Pestaña accesible desde `/feed` o en el menú de navegación.
* **Filtros Rápidos:**
  - Selector de plataforma (`PC`, `PS5`, `Switch`, etc.).
  - Selector de estilo de juego (`Casual`, `Competitivo`, `Campaña Cooperativa`).
* **Tarjeta de Convocatoria:**
  - Identidad del jugador creador con su avatar y enlace a perfil.
  - Carátula del juego solicitado.
  - Badges de plataforma y estilo.
  - Horario disponible (ej. *"Viernes y sábados desde las 21:00 hs GMT-3"*).
  - Nota de contacto (ej. *"Buscamos 2 personas para raid en Destiny 2. Discord: @player"*).
  - Contador de tiempo restante antes de expirar (ej. *"Expira en 14 horas"*).
* **Formulario de Convocatoria:** Modal sencillo con autocompletado del juego desde el catálogo o IGDB.

### 3.3. Habitación Gamer: Temas Visuales en el Perfil (`/players/[username]`)
* El perfil lee la columna `room_theme`:
  1. **`crt_terminal` (Por defecto):** Estética monocromática o fósforo ámbar con líneas de escaneo y tipografía monospace.
  2. **`handheld_console`:** El perfil se renderiza dentro de un chasis pixel-art que imita una consola portátil retro, con cruceta direccional y altavoz perforado en los bordes.
  3. **`retro_shelf`:** Los juegos de la biblioteca y el Top 4 se presentan organizados en una estantería física con lomos y carátulas 3D estilo estante de colección.

---

## 4. Criterios de Aceptación y Verificación

1. El widget de duelo registra votos únicos por usuario y muestra porcentajes consistentes a toda la comunidad.
2. Las convocatorias en el tablón de compañeros solo se muestran si `expires_at > now()`, evitando publicaciones antiguas o abandonadas.
3. El usuario puede cambiar su `room_theme` en el editor de perfil y sus visitantes visualizan el tema seleccionado con total fidelidad.
