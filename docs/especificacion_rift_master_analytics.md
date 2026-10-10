# Especificación Técnica Maestra: Rift Tracker v3 (Vista Dedicada, Filtros con Arena y Analíticas Pro)

**Versión:** 3.0  
**Fecha:** 10 de octubre de 2026  
**Área:** Navegación, `/rift`, Filtros de Partida, Analíticas de Invocador y Gamificación  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  

---

## 1. Resumen de Requerimientos Consolidados

1. **Ubicación en el Navbar:** Acceso directo en el menú principal (`/rift`).
2. **Filtros de Tipo de Partida (con Arena):**
   - `Todas` (sin filtro).
   - `Solo/Dúo` (`queueId === 420`).
   - `Normales` (`queueId === 400 || queueId === 430`).
   - `ARAM` (`queueId === 450`).
   - `Arena` (`queueId === 1700 || queueId === 1710`).
   - `Otros / Caos` (`queueId === 440` [Flexible], `1900` [URF], modos temporales).
3. **Analíticas en Columna Lateral (Estilo OP.GG):**
   - **ROLES:** Posición jugada (*Top, Jungle, Mid, ADC, Support*), Winrate % (W // L), KDA ratio y promedio.
   - **TOP CHAMPIONS:** Campeones más jugados en las partidas consultadas con miniatura Data Dragon, Winrate % y KDA.
4. **Fijar Cuenta (⭐) y Búsquedas Recientes:**
   - Opción para anclar una cuenta principal (se carga automáticamente al entrar a `/rift`).
   - Botones rápidos de cuentas buscadas recientemente.
   - Soporte para URL directa: `/rift?riotId=Kiryu+Kasuma%231809&platform=la2`.
5. **Medallas Arcade en Partidas:**
   - ⚡ `PENTAKILL` / `QUADRAKILL` (según `largestMultiKill`).
   - 👑 `MVP` (mejor KDA / daño del equipo).
   - 🎯 `% Participación (KP)` (ej. `68% P/K`).
6. **Top 3 Maestría de Campeones (Champion Mastery):**
   - Consulta a `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count=3`.
   - Muestra los 3 campeones insignia de toda la historia del jugador con su nivel y puntos (`340k pts`).
7. **Compartir en Momentos:**
   - Botón `[ 🚀 Publicar en Momentos ]` para compartir la partida con la comunidad en un clic.

---

## 2. Ruteo y Navegación (`src/components/header.tsx` y `command-menu.tsx`)

* En `<Header />`:
  ```tsx
  <Link href="/rift">Rift</Link>
  ```
* En `CommandMenu`:
  ```tsx
  { label: 'Rift Tracker (League of Legends)', href: '/rift' }
  ```

---

## 3. Servicio de Integración de Riot (`src/integrations/riot/server.ts`)

Se agrega soporte para Champion Mastery:
* **Endpoint:** `GET https://{platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count=3`
* Retorna los 3 campeones con mayor puntuación acumulada.
* Se traduce el `championId` a nombre mediante el catálogo de Data Dragon.

---

## 4. Persistencia Local (`localStorage`)

* **Cuenta Fijada:** `savestate_pinned_lol_account` -> `{ riotId: string, platform: string }`.
* **Historial Reciente:** `savestate_recent_lol_searches` -> Array de hasta 5 búsquedas previas.

---

## 5. Diseño y Layout (`src/app/rift/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RIFT TRACKER // LEAGUE OF LEGENDS                     [⭐ Fijar esta cuenta]│
│  [ Input: Kiryu Kasuma#1809 ] [ Servidor: LAS v ]  [ Cargar Historial ]     │
│  Recientes: [ Kiryu Kasuma#1809 ] [ Faker#KR1 ]                            │
├────────────────────────────────────────┬────────────────────────────────────┤
│  COLUMNA PRINCIPAL (65%)               │  COLUMNA LATERAL (35%)             │
│                                        │                                    │
│  FICHA DE INVOCADOR                    │  MAESTRÍAS DESTACADAS (Top 3)      │
│  [Icono] Kiryu Kasuma#1809 (Nivel 651) │  [Rammus] 340k · [Jax] 185k        │
│  Solo/Dúo: Platino I (3 LP - 50.5% WR) │                                    │
│  Flexible: Platino IV (84 LP)          │  ROLES (Estadísticas por línea)    │
│                                        │  Top: 100% WR (2W/0L) - 3.4 KDA    │
│  FILTRO DE COLAS:                      │  Mid: 0% WR (0W/1L) - 1.5 KDA      │
│  [Todas] [Solo/Dúo] [Normales] [ARAM]  │                                    │
│  [Arena] [Otros / Caos]                │  TOP CHAMPIONS (Más jugados)       │
│                                        │  [Rammus] 100% WR - 13.5 KDA       │
│  HISTORIAL DE PARTIDAS:                │  [Jax]    100% WR - 5.3 KDA        │
│  ┌──────────────────────────────────┐  │                                    │
│  │ 🟢 VICTORIA Solo/Dúo [👑 MVP]    │  │                                    │
│  │ [Rammus] 5/2/22 (13.5 KDA)       │  │                                    │
│  │ [Objetos] [68% KP] [Ver 5v5]     │  │                                    │
│  │ [ 🚀 Publicar en Momentos ]      │  │                                    │
│  └──────────────────────────────────┘  │                                    │
└────────────────────────────────────────┴────────────────────────────────────┘
```
