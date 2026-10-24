# SPEC-14: La Taberna — Fusión Comunitaria Tríptica (Debates, Momentos y Arcade/LFG)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `main`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/la-taberna-community-fusion`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Alta (Arquitectura comunitaria unificada, optimización de Navbar y experiencia social integrada)

---

## 1. Objetivo y Contexto

Actualmente, SaveState cuenta con tres subsistemas sociales dispersos:
1. **Foro (`/forum`):** Espacio de discusión estructurada que recientemente absorbió la **Sala Arcade & Convocatorias LFG** (`/forum?tab=arcade`).
2. **Momentos Gamer (`/highlights`):** Feed visual donde los jugadores comparten capturas, clips de YouTube y hazañas (`PostForm` y `PostCard`).
3. **Sala Arcade & LFG:** Duelos interactivos semanales entre juegos y convocatorias de escuadrón de 48 horas.

Tener **"Momentos"** y **"Foro"** como enlaces independientes en la barra de navegación satura la interfaz y fragmenta la comunidad. 

El objetivo de **SPEC-14** es fusionar estos tres componentes en un único ecosistema definitivo denominado **"La Taberna"** (ruta canónica `/tavern`):
* **Pilar 1: 💬 Debates Comunitarios (`/tavern` o `/tavern?tab=debates`):** Canales temáticos, hilos de discusión, ordenación y buscador.
* **Pilar 2: ✨ Momentos Épicos (`/tavern?tab=momentos`):** Feed de capturas, jugadas y clips con categorías (`boss-fight`, `speedrun`, etc.) y formulario para compartir hazañas.
* **Pilar 3: 🕹️ Sala Arcade & LFG (`/tavern?tab=arcade`):** Duelo semanal interactivo y tablero de convocatorias de escuadrón.

El Navbar se optimiza reemplazando los dos accesos previos por un único enlace temático: **`La Taberna`**.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/app/tavern/page.tsx` | Hub principal de La Taberna que aloja el encabezado común y conmuta de forma reactiva entre las 3 pestañas (`debates`, `momentos`, `arcade`). |
| **Modificar** | `next.config.ts` | Configurar redirecciones permanentes HTTP 308 para `/forum` -> `/tavern`, `/taberna` -> `/tavern`, `/highlights` -> `/tavern?tab=momentos`, y actualizar destinos de `/arcade` y `/parties` a `/tavern?tab=arcade`. |
| **Modificar** | `src/app/forum/page.tsx` | Reemplazar contenido con redirección permanente del lado del servidor hacia `/tavern` (preservando parámetros de consulta). |
| **Modificar** | `src/app/highlights/page.tsx` | Reemplazar contenido con redirección permanente del lado del servidor hacia `/tavern?tab=momentos` (preservando parámetros de consulta). |
| **Modificar** | `src/components/header-nav.tsx` | Reemplazar los enlaces `'Momentos'` y `'Foro'` por `'La Taberna'` con icono temático (`Beer` o `Flame` de `lucide-react`). |
| **Modificar** | `src/components/command-menu.tsx` | Actualizar los accesos directos de la paleta de comandos hacia `/tavern`, `/tavern?tab=momentos` y `/tavern?tab=arcade`. |
| **Modificar** | `src/app/players/[username]/page.tsx` | Actualizar el enlace de momentos del jugador para apuntar a `/tavern?tab=momentos&player=${profile.id}`. |
| **Modificar** | `src/components/wrapped-view.tsx` | Actualizar el enlace para apuntar a `/tavern?tab=momentos&player=${userId}`. |
| **Modificar** | `src/app/layout.tsx` | Actualizar el enlace del footer hacia `/tavern`. |
| **Crear** | `tests/unit/tavern-hub.test.ts` | Pruebas unitarias exhaustivas: navegación entre los 3 pilares, aislamiento de consultas por pestaña, compatibilidad de redirecciones 308 y preservación de filtros. |

---

## 3. Contratos de Tipos y Parámetros

### `src/app/tavern/page.tsx`

```typescript
export const TAVERN_TABS = ['debates', 'momentos', 'arcade'] as const;
export type TavernTab = (typeof TAVERN_TABS)[number];

export interface TavernPageProps {
  searchParams: Promise<{
    tab?: string | string[];
    // Parámetros de Debates
    q?: string | string[];
    sort?: string | string[];
    channel?: string | string[];
    // Parámetros de Momentos
    category?: string | string[];
    page?: string | string[];
    player?: string | string[];
    game?: string | string[];
    post?: string | string[];
    draft?: string | string[];
    draftTitle?: string | string[];
  }>;
}
```

---

## 4. Algoritmo y Flujo de Implementación

### 4.1. Encabezado Táctico de La Taberna (`TavernHeading`)

La cabecera renderiza títulos contextuales y la barra de navegación con las 3 pestañas:

```tsx
function TavernHeading({ activeTab }: { activeTab: TavernTab }) {
  const titles: Record<TavernTab, { eyebrow: string; title: string; subtitle: string }> = {
    debates: {
      eyebrow: 'SAVESTATE // LA TABERNA SOCIAL',
      title: 'Una comunidad. Mil conversaciones.',
      subtitle: 'De la taberna retro a tu próximo gran descubrimiento gamer.',
    },
    momentos: {
      eyebrow: 'SAVESTATE // REGISTRO DE HAZAÑAS',
      title: 'Momentos & Jugadas Épicas.',
      subtitle: 'Clips, capturas y anécdotas inolvidables compartidas por la comunidad.',
    },
    arcade: {
      eyebrow: 'SAVESTATE // ZONA COMPETITIVA & LFG',
      title: 'Sala Arcade & Convocatorias de Escuadrón',
      subtitle: 'Duelos comunitarios y lobbies de 48 horas para cooperar o cazar trofeos.',
    },
  };

  const meta = titles[activeTab];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
          <p className="muted">{meta.subtitle}</p>
        </div>
      </div>
      <nav className="forum-view-tabs tavern-view-tabs" aria-label="Secciones de La Taberna">
        <Link
          href="/tavern"
          className={`button small ${activeTab === 'debates' ? '' : 'outline'}`}
          aria-current={activeTab === 'debates' ? 'page' : undefined}
          scroll={false}
        >
          💬 Debates Comunitarios
        </Link>
        <Link
          href="/tavern?tab=momentos"
          className={`button small ${activeTab === 'momentos' ? '' : 'outline'}`}
          aria-current={activeTab === 'momentos' ? 'page' : undefined}
          scroll={false}
        >
          ✨ Momentos Épicos
        </Link>
        <Link
          href="/tavern?tab=arcade"
          className={`button small ${activeTab === 'arcade' ? '' : 'outline'}`}
          aria-current={activeTab === 'arcade' ? 'page' : undefined}
          scroll={false}
        >
          🕹️ Sala Arcade & LFG
        </Link>
      </nav>
    </>
  );
}
```

### 4.2. Carga Condicional y Concurrencia de Datos

Para mantener una velocidad de carga óptima y no ejecutar consultas innecesarias:
1. **Si `activeTab === 'momentos'`:**
   - Valida `category` con `POST_CATEGORIES` y `page` numérico.
   - Ejecuta concurrentemente:
     ```typescript
     const [feed, user] = await Promise.all([
       highlightFeed({ ...filters, category, page }),
       currentUser(),
     ]);
     ```
   - Renderiza `PostForm` (si el usuario está autenticado) y la lista de `PostCard`.
2. **Si `activeTab === 'arcade'`:**
   - Ejecuta concurrentemente:
     ```typescript
     const [duel, feed, user] = await Promise.all([
       configured ? duelSummary() : null,
       configured ? partyFeed({ page: 1 }) : { items: [], hasMore: false, generatedAt: 0 },
       currentUser(),
     ]);
     ```
   - Renderiza `GameDuelWidget` y `PartyBoard`.
3. **Si `activeTab === 'debates'` (Default):**
   - Ejecuta concurrentemente:
     ```typescript
     const [directory, user] = await Promise.all([
       configured ? forumDirectory(channel, q, sort) : null,
       currentUser(),
     ]);
     ```
   - Renderiza `ForumCreate`, buscador y `ForumThreadList`.

### 4.3. Redirecciones HTTP 308 en `next.config.ts`

```typescript
async redirects() {
  return [
    { source: '/forum', destination: '/tavern', permanent: true },
    { source: '/taberna', destination: '/tavern', permanent: true },
    { source: '/highlights', destination: '/tavern?tab=momentos', permanent: true },
    { source: '/arcade', destination: '/tavern?tab=arcade', permanent: true },
    { source: '/parties', destination: '/tavern?tab=arcade', permanent: true },
    { source: '/community/discord', destination: '/chat', permanent: true },
  ];
}
```

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Aislamiento de Carga de Datos:**
   - Cuando se visualiza `?tab=momentos`, **no se consultan** hilos de foros ni duelos de arcade.
   - Cuando se visualiza `?tab=debates`, **no se consulta** el feed de momentos ni las convocatorias LFG.
2. **Preservación de Estado y Filtros:**
   - Al navegar en la pestaña `momentos`, las categorías (`?tab=momentos&category=speedrun`) y la paginación (`&page=2`) deben preservarse en los enlaces de filtro.
   - Al publicar un momento o un hilo, la redirección posterior debe devolver al usuario a su respectiva pestaña activa.
3. **Redirecciones 308 Transparentes:**
   - Cualquier solicitud antigua a `/forum` llega a `/tavern` con código HTTP 308.
   - Cualquier solicitud a `/highlights` llega a `/tavern?tab=momentos` con código HTTP 308.
   - Los parámetros de consulta (`?player=...`, `?category=...`) se conservan intactos.
4. **Verificación de Calidad Obligatoria:**
   - `npm test` con 100% de éxito en la suite completa.
   - `npm run typecheck` con 0 errores TypeScript.
   - `npm run lint` con 0 advertencias/errores ESLint.
   - `npm run format:check` 100% conforme con Prettier.
