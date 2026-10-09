# Especificación Técnica: Rediseño Visual de «Jugadores en la red» (Player Cards Grid)

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Transformar la vista `/players` ("Jugadores en la red") de una lista plana de texto en una **cuadrícula de tarjetas de jugador estilo arcade/cyberpunk**, mostrando avatares, marcos, insignias de nivel, títulos, plataformas conectadas y filtros rápidos de descubrimiento.

---

## 1. Diagnóstico del Estado Actual

En `src/app/players/page.tsx`:
* Actualmente se renderiza una lista vertical en un solo `.panel`, mostrando únicamente `<h3>@{profile.username}</h3>` y un párrafo simple con el estado terminal.
* Desaprovecha por completo los datos visuales que ya existen en `profiles` (`avatar_url`, `equipped_frame`, `level`, `equipped_title`, `steam_id`, `xbox_gamertag`, `psn_id`).

---

## 2. Especificación del Rediseño

### 2.1. Nuevo Componente: `src/components/player-card.tsx`
Renderiza cada ficha con formato de credencial gamer:
* **Cabecera:**
  * Avatar con `<AvatarFrame frame={profile.equipped_frame}>`.
  * Nombre `@username` con enlace a su perfil.
  * Insignia circular de Nivel a la derecha (`friend-level-circle` con borde según rango: oro, púrpura, rojo, bronce, gris).
  * Título equipado (`equipped_title`, ej: *Button Masher*, *Insert Coin*).
* **Chips de Plataformas Conectadas:**
  * Indicadores visuales si tiene cuentas vinculadas (`🖥️ Steam`, `🟩 Xbox`, `🎮 PSN`).
* **Línea de Comando / Estado Terminal:**
  * `{profile.username}@savestate:~$ {profile.terminal_status}` con tipografía mono neón verde.
* **Pie de Tarjeta:**
  * Botón directo: `[ Ver perfil ↗ ]`.

### 2.2. Barra de Filtros y Búsqueda en `src/app/players/page.tsx`
* Conserva el buscador por nombre de usuario.
* Incorpora pestañas/filtros rápidos en la URL (`?sort=...`):
  * `[ Todos ]` (orden alfabético por defecto).
  * `[ 🏆 Mayor Nivel / Top XP ]` (`order('level', { ascending: false })`).
  * `[ ⚡ Más Recientes ]` (`order('created_at', { ascending: false })`).

### 2.3. Estilos en `src/app/globals.css`
* Contenedor `.players-grid` con CSS Grid responsivo:
  ```css
  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
    margin-top: 1.5rem;
  }
  .player-card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.25rem;
    border-radius: 6px;
    background: #0d151c;
    border: 1px solid #1e293b;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .player-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  ```

---

## 3. Plan de Ejecución para Codex

1. Crear el componente `src/components/player-card.tsx`.
2. Actualizar `src/app/players/page.tsx` para admitir el parámetro `sort`, consultar `profiles` según el filtro elegido y renderizar la cuadrícula `.players-grid`.
3. Añadir los estilos correspondientes en `src/app/globals.css`.
4. Verificar con `npm run check`.
