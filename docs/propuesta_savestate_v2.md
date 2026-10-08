# Propuesta de Arquitectura: SaveState v2.0 (Badges, Wrapped, PWA y Steam Sync)
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura de gamificación, utilidades de importación masiva y experiencia nativa móvil para la versión 2.0 de SaveState.

---

## 1. Visión General de la Versión 2.0

SaveState v2.0 expande la retención y la facilidad de uso mediante cuatro pilares tecnológicos:
1. **Insignias y Trofeos (Badges):** Sistema de logros que recompensa la actividad y completismo con medallas pixel-art en el perfil.
2. **SaveState Wrapped (Resumen Anual):** Generador de tarjetas visuales retro compartibles tipo Spotify Wrapped con estadísticas anuales.
3. **PWA (Progressive Web App):** Instalación en móviles como consola portátil nativa sin barra de navegación.
4. **Importador de Steam:** Sincronización automática de bibliotecas de Steam para poblar el backlog en un solo clic.

---

## 2. Pilar 1: Sistema de Insignias y Trofeos (Badges)

### 2.1. Modelo de Datos (`badges` y `user_badges`)
```sql
create table public.badges (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('milestone', 'genre', 'community', 'special')),
  icon_pixel text not null, -- Identificador de icono o SVG pixel art
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create policy badges_read on public.badges for select using (true);
create policy user_badges_read on public.user_badges for select using (true);
```

### 2.2. Catálogo Inicial de Logros
* `first_checkpoint`: "Primer Guardado" — Registra tu primer juego en la biblioteca.
* `broadcaster`: "Transmisor" — Comparte tu primer Momento Gamer con video o captura.
* `coop_comrade`: "Compañero de Armas" — Publica tu primera convocatoria en `/parties`.
* `arcade_veteran`: "Voz del Arcade" — Vota en 5 Duelos de Juegos.
* `retro_collector`: "Guardián de los 90s" — Registra 5 juegos con año de lanzamiento menor al 2000.
* `rpg_master`: "Maestro del Rol" — Completa 3 videojuegos del género RPG / JRPG.
* `completionist`: "100% Platino" — Marca 5 juegos con estado `completed`.

### 2.3. Lógica de Desbloqueo
Una función `check_user_badges(p_user_id uuid)` audita las tablas del usuario (`user_games`, `posts`, `party_requests`, `duel_votes`) e inserta en `user_badges` con `ON CONFLICT DO NOTHING`.  
Al desbloquear un nuevo logro, se dispara una notificación al usuario: `¡Has desbloqueado el logro 'Guardián de los 90s'!`.

---

## 3. Pilar 2: SaveState Wrapped (Resumen Anual)

### 3.1. Métricas Recopiladas
* **Total de Checkpoints:** Juegos jugados y completados en el año actual.
* **Juego del Año Personal (GOTY):** El título con calificación más alta o el más fijado en favoritos.
* **Género Dominante:** Gráfico porcentual de géneros (ej. 45% Acción, 30% RPG, 25% Plataformas).
* **Momento Más Épico:** La publicación con mayor cantidad de reacciones recibidas.
* **Ritmo de Juego:** Mes con mayor número de juegos completados.

### 3.2. Generación Visual Compartible
* Ruta: `/players/[username]/wrapped` o `/wrapped`.
* Renderizado con carrusel de diapositivas interactivas en pantalla completa con transiciones de 8 bits y música chiptune opcional.
* Botón **"Exportar Ficha de Guardado (PNG)"**: Genera una tarjeta de 1080x1920 (óptima para Instagram Stories / Twitter) mediante `@vercel/og` o renderizado Canvas en cliente.

---

## 4. Pilar 3: Progressive Web App (PWA)

### 4.1. Manifiesto Web (`src/app/manifest.ts`)
```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SaveState — Tu diario gamer',
    short_name: 'SaveState',
    description: 'Explora videojuegos, registra tus partidas y comparte tu odisea gamer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080c',
    theme_color: '#00f0ff',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
```

### 4.2. Experiencia Inmersiva
* En combinación con el tema de perfil **"Consola Portátil"** de la Fase 3, la aplicación instalada en Android/iOS oculta los controles del navegador y se siente como un emulador o sistema operativo portátil nativo.
* Soporte offline básico para consultar la biblioteca cacheadas mediante un Service Worker estándar.

---

## 5. Pilar 4: Importador de Bibliotecas de Steam

### 5.1. Flujo de Ingesta
1. El usuario introduce su **Steam ID 64** o URL personalizada de Steam en `/settings`.
2. Una API Route (`/api/steam/import`) consulta el endpoint oficial de Valve:  
   `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=STEAM_KEY&steamid=ID&include_appinfo=1`.
3. Para cada juego devuelto:
   - Se compara contra la tabla `games` de SaveState o se ingesta automáticamente a través de la integración existente con IGDB.
   - Si `playtime_forever > 0`, se sugiere marcar como `completed` o `playing`.
4. **Pantalla de Revisión Previa:** El usuario ve una cuadrícula con casillas de verificación para deseleccionar los juegos que no desee importar antes de agregarlos masivamente a su tabla `user_games`.

---

## 6. Recomendación de Secuencia de Entrega

Para mantener la cadencia de desarrollo impecable que hemos tenido hasta ahora, la versión 2.0 puede abordarse en dos entregas:

| Entrega | Contenido |
|---|---|
| **v2.1: Experiencia e Instalabilidad** | **PWA Nativa** + **Sistema de Logros e Insignias (Badges)** con medallas en el perfil y notificaciones de desbloqueo. |
| **v2.2: Datos y Celebración** | **Importador de Steam** + **SaveState Wrapped** con generación de tarjeta descargable. |
