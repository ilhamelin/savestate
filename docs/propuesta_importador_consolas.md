# Propuesta Técnica: Importador Multiplataforma (PlayStation Network y Xbox)
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura, almacenamiento relacional e interfaz para importar y sincronizar bibliotecas de juegos desde PlayStation Network (PSN) y Xbox hacia SaveState.

---

## 1. Visión y Alcance Funcional

SaveState ya cuenta con una sólida ingesta de Steam. Esta entrega amplía la compatibilidad a los dos mayores ecosistemas de consolas: **PlayStation** y **Xbox**.

### Canales de Importación Soportados:
1. **Identidad de Consola en Perfil:**
   - El jugador puede vincular y exhibir su **PSN Online ID** (PlayStation) y su **Xbox Gamertag** en su perfil y Profile Studio junto a su Steam ID.
2. **Importación por Exportación Universal (CSV / JSON / GOG Galaxy / Backloggd):**
   - El método más fiable y universal para consolas. El usuario sube un archivo `.csv` o `.json` exportado desde su consola, GOG Galaxy, Exophase o PSNProfiles.
   - El sistema analiza los títulos, detecta la plataforma (`PlayStation 5`, `PlayStation 4`, `Xbox Series`, etc.) y las horas estimadas.
3. **Ingesta Rápida por Lista de Títulos / Gamertag:**
   - El usuario puede pegar una lista de títulos jugados o introducir su Gamertag/PSN ID.
   - El servidor empareja los nombres contra el catálogo de IGDB/SaveState y genera la pantalla de casillas de verificación para seleccionar cuáles importar.
4. **Registro en Biblioteca y Hardware:**
   - Los títulos importados se guardan en `user_games` y añaden una entrada en `play_logs` con `platform_played = 'PlayStation'` o `'Xbox'` y `play_method = 'hardware'`.
   - Estas horas y plataformas nutren directamente el **Dossier de Métricas** y la **SaveState Memory Card**.

---

## 2. Nueva Migración SQL: `202610080016_console_imports.sql`

```sql
begin;

-- 1. Añadir identificadores de consolas en perfiles
alter table public.profiles
  add column if not exists psn_id text check (length(psn_id) between 3 and 30),
  add column if not exists xbox_gamertag text check (length(xbox_gamertag) between 3 and 30);

grant update (psn_id, xbox_gamertag) on public.profiles to authenticated;

-- 2. Función atómica para importar juego de consola con plataforma y horas
create or replace function public.import_console_game(
  p_game_id uuid,
  p_status text,
  p_platform text,
  p_hours numeric default 0,
  p_source text default 'PlayStation'
)
returns text
language plpgsql security invoker set search_path = '' as $$
declare
  library_id uuid;
  is_new boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_status not in ('backlog', 'playing', 'cleared', 'abandoned') or p_status is null
    or p_hours is null or p_hours < 0 or p_hours > 100000 then
    raise exception 'Invalid console import parameters';
  end if;

  -- Insertar o mantener el registro existente en user_games
  insert into public.user_games(user_id, game_id, status)
  values(auth.uid(), p_game_id, p_status)
  on conflict (user_id, game_id) do nothing
  returning id into library_id;

  is_new := (library_id is not null);
  if not is_new then
    select id into library_id from public.user_games
    where user_id = auth.uid() and game_id = p_game_id;
  end if;

  -- Si se indicaron horas o plataforma, registrar en play_logs
  if p_hours > 0 or p_platform is not null then
    insert into public.play_logs(
      user_game_id, platform_played, play_method, hours_played, note
    )
    values(
      library_id,
      coalesce(p_platform, p_source),
      'hardware',
      round(p_hours, 2),
      '[' || p_source || '] Partida importada a la biblioteca.'
    );
  end if;

  return case when is_new then 'imported' else 'existing' end;
end;
$$;

revoke all on function public.import_console_game(uuid, text, text, numeric, text) from public, anon;
grant execute on function public.import_console_game(uuid, text, text, numeric, text) to authenticated;

commit;
```

---

## 3. Especificación de Interfaz y Componentes

### 3.1. Hub de Importación Multiplataforma (`src/components/importer/` o `/library`)
* Reorganizar la sección de importación de la biblioteca en pestañas temáticas:
  - **`[ Steam ]`** (el importador de Valve ya existente).
  - **`[ PlayStation (PSN) ]`**:
    - Campo para guardar tu `PSN Online ID`.
    - Selector para subir archivo de exportación (`.csv`, `.json`) o pegar lista de juegos de PlayStation.
  - **`[ Xbox ]`**:
    - Campo para guardar tu `Xbox Gamertag`.
    - Selector para subir exportación o lista de títulos de Xbox.
* **Pantalla de Confirmación Previa con Casillas:**
  - Idéntica a la experiencia de Steam: el usuario ve las carátulas encontradas en IGDB, el estado sugerido (`cleared` o `backlog`) y la plataforma asignada (`PS5`, `PS4`, `Xbox Series`, `Xbox One`).
  - Puede desmarcar cualquier juego que no desee incorporar.
* **Progreso Atómico:** Barra de progreso que importa los juegos por lotes sin bloquear el navegador.

### 3.2. Exhibición en el Perfil Público (`/players/[username]`)
* Debajo del nombre de usuario o en la barra de redes sociales:
  - Píldoras con iconos oficiales o pixel art de:
    - `🎮 PSN: @Kratos_99`
    - `🟩 Xbox: @MasterChief`
    - `🚂 Steam: @GamerSteam`
* Los juegos importados muestran en su ficha de biblioteca la insignia de `PlayStation` o `Xbox` correspondiente.

---

## 4. Criterios de Aceptación y Calidad

1. El usuario puede subir un archivo CSV/JSON con títulos de PlayStation o Xbox y previsualizar los juegos correspondientes de IGDB antes de importarlos.
2. Cada juego importado queda asociado a su respectiva plataforma en `play_logs`, sumando horas al Dossier de Estadísticas y la Memory Card.
3. Los identificadores `psn_id` y `xbox_gamertag` persisten en `profiles` y se muestran en el perfil del jugador.
4. Cobertura completa con `npm run check` y `npm run build`.
