# SPEC-10: Fusión de Sala Arcade & LFG en el Foro Comunitario (SaveState Boards & Arcade Hub)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/fusion-arcade-foro`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Alta (Optimización de UX comunitaria, reducción de saturación en navbar y sinergia social)

---

## 1. Objetivo y Contexto

Actualmente SaveState cuenta con dos secciones sociales separadas:
1. **`/forum` (SaveState Boards):** Hilos de discusión, canales temáticos (`La Taberna Retro`, `Actualidad`, `Guías`, etc.), respuestas y estadísticas globales.
2. **`/arcade` (Sala Arcade & LFG):** Duelos comunitarios en tiempo real (`GameDuelWidget`) y tablero de convocatorias de escuadrón de 48 horas (`PartyBoard` + `PartyModal`).

Tener ambas secciones separadas sobrecarga las barras de navegación (13 enlaces en desktop y barra móvil apretada) y desarticula las interacciones de los usuarios.

La dirección de producto ha dispuesto **fusionar la Sala Arcade dentro de la vista del Foro (`/forum`)**, convirtiendo a `/forum` en el **Hub Comunitario Unificado de SaveState**:
- **Vista por Pestañas:** El Foro incorpora un conmutador de pestañas de alta visibilidad:
  - `💬 Debates Comunitarios` (por defecto en `/forum` o `/forum?tab=debates`).
  - `🕹️ Sala Arcade & LFG` (`/forum?tab=arcade`).
- **Sinergia Cruzada:** En la vista de debates se incluye una cápsula/banner que muestra el duelo comunitario en vivo e invita a votar o buscar escuadrón.
- **Redirección Limpia:** Las rutas previas `/arcade` y `/parties` redirigen de forma permanente (`permanentRedirect('/forum?tab=arcade')`) para preservar enlaces externos, marcadores e historial.
- **Descongestión del Navbar:** Se retira el enlace redundante `/arcade` de `HeaderNav`, reduciendo la saturación en desktop y dispositivos móviles.

---

## 2. Lista Exacta de Archivos a Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Modificar** | `src/app/forum/page.tsx` | Añadir soporte para el query param `tab` (`'debates' \| 'arcade'`), conmutador de pestañas `.forum-view-tabs`, precarga condicional de datos (duelo + LFG vs canales + hilos) y renderizado integrado. |
| **Modificar** | `src/app/arcade/page.tsx` | Reemplazar la página completa por una redirección permanente limpia a `/forum?tab=arcade`. |
| **Modificar** | `src/app/parties/page.tsx` | Actualizar la redirección permanente directa a `/forum?tab=arcade`. |
| **Modificar** | `src/components/header-nav.tsx` | Retirar `{ href: '/arcade', ... }` para descongestionar el menú principal y la barra móvil inferior. |
| **Modificar** | `src/components/command-menu.tsx` | Actualizar la opción de acceso rápido a `['Foro: Sala Arcade & LFG', '/forum?tab=arcade']`. |
| **Modificar** | `src/components/arcade/party-board.tsx` | Ajustar enlace de login a `/login?next=/forum?tab=arcade`. |
| **Modificar** | `src/app/forum.css` | Añadir reglas de estilo para `.forum-view-tabs`, botones de pestaña con estado activo y el banner del duelo en vivo. |
| **Modificar** | `tests/unit/arcade-parties-api.test.ts` | Actualizar aserciones de redirección permanente (`/arcade -> /forum?tab=arcade`, `/parties -> /forum?tab=arcade`) y navegación de `header-nav.tsx`. |

---

## 3. Contratos de Tipos y Parámetros

### `src/app/forum/page.tsx`
```typescript
export interface ForumPageProps {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
    channel?: string | string[];
    tab?: string | string[]; // 'debates' | 'arcade'
  }>;
}
```

El estado de la pestaña se resuelve de forma determinista:
```typescript
const search = await searchParams;
const activeTab = search.tab === 'arcade' ? 'arcade' : 'debates';
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Carga de Datos en `src/app/forum/page.tsx`
1. Extraer los parámetros de búsqueda:
   - `query = forumSearch(search.q)`
   - `sort = FORUM_SORTS.find((v) => v === search.sort) ?? 'recent'`
   - `channel = ...`
   - `activeTab = search.tab === 'arcade' ? 'arcade' : 'debates'`
2. Según `activeTab`, ejecutar la consulta de datos óptima en paralelo con `currentUser()`:
   - **Si `activeTab === 'arcade'`:**
     ```typescript
     const [duel, feed, user] = await Promise.all([
       configured ? duelSummary() : null,
       configured ? partyFeed({ page: 1 }) : { items: [], hasMore: false, generatedAt: 0 },
       currentUser(),
     ]);
     ```
   - **Si `activeTab === 'debates'`:**
     ```typescript
     const [data, user, duel] = await Promise.all([
       forumDirectory(query, sort, channel),
       currentUser(),
       configured ? duelSummary() : null, // Para el banner del duelo activo
     ]);
     ```
3. Renderizar cabecera adaptada:
   - En pestaña `arcade`:
     - Eyebrow: `SAVESTATE BOARDS // SALA ARCADE & LFG`
     - Título: `Sala Arcade & Convocatorias de Escuadrón`
     - Bajada: `Duelos comunitarios y lobbies de 48 horas para cooperar, competir o cazar logros.`
   - En pestaña `debates`:
     - Eyebrow: `SAVESTATE BOARDS`
     - Título: `Una comunidad. Mil conversaciones.`
     - Bajada: `De la taberna retro a tu próximo descubrimiento.`
4. Renderizar el conmutador de pestañas (`.forum-view-tabs`):
   ```tsx
   <nav className="forum-view-tabs" aria-label="Secciones del Foro">
     <Link
       href="/forum"
       className={`button small ${activeTab === 'debates' ? '' : 'outline'}`}
       aria-current={activeTab === 'debates' ? 'page' : undefined}
       scroll={false}
     >
       💬 Debates Comunitarios
     </Link>
     <Link
       href="/forum?tab=arcade"
       className={`button small ${activeTab === 'arcade' ? '' : 'outline'}`}
       aria-current={activeTab === 'arcade' ? 'page' : undefined}
       scroll={false}
     >
       🕹️ Sala Arcade & LFG
     </Link>
   </nav>
   ```
5. En la pestaña `debates`, si `duel` está activo, renderizar justo antes del directorio de canales el banner interactivo:
   ```tsx
   {duel ? (
     <div className="forum-arcade-banner">
       <div className="forum-arcade-banner-text">
         <span className="forum-arcade-pulse">⚡</span>
         <strong>Duelo Comunitario en Vivo:</strong> {duel.game_a.title} vs {duel.game_b.title}
       </div>
       <Link href="/forum?tab=arcade" className="button small outline">
         Votar en Arcade →
       </Link>
     </div>
   ) : null}
   ```
6. En la pestaña `arcade`, renderizar:
   - `<SetupNotice />`
   - `GameDuelWidget` (si existe duelo) o aviso de duelo pendiente.
   - `<PartyBoard initial={feed} viewerId={user?.id ?? null} configured={configured} />`

---

### 4.2. Redirecciones Permanentes (`permanentRedirect`)

En `src/app/arcade/page.tsx`:
```tsx
import { permanentRedirect } from 'next/navigation';

export default function ArcadePage() {
  permanentRedirect('/forum?tab=arcade');
}
```

En `src/app/parties/page.tsx`:
```tsx
import { permanentRedirect } from 'next/navigation';

export default function PartiesPage() {
  permanentRedirect('/forum?tab=arcade');
}
```

---

### 4.3. Navegación en `src/components/header-nav.tsx`
Eliminar la entrada `{ href: '/arcade', label: 'Arcade', icon: Gamepad2 }` del arreglo `links`.  
Esto reduce el número de botones a 12, dejando la barra de navegación superior y el menú inferior móvil con espacio respirable.  
El enlace `/forum` permanece con `label: 'Foro'`, activándose al visitar `/forum` o `/forum?tab=arcade`.

---

### 4.4. Acceso Rápido en `src/components/command-menu.tsx`
Actualizar la lista de accesos directos:
```typescript
['Foro: Sala Arcade & LFG', '/forum?tab=arcade'],
```

---

### 4.5. Estilos en `src/app/forum.css`
Añadir al final de `src/app/forum.css`:
```css
/* Fusión Arcade & Foro (SPEC-10) */
.forum-view-tabs {
  display: flex;
  gap: 8px;
  margin: 16px 0 24px;
  flex-wrap: wrap;
}

.forum-arcade-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  margin-bottom: 24px;
  background: var(--surface-2, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius, 8px);
}

.forum-arcade-banner-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.forum-arcade-pulse {
  display: inline-block;
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.1); }
}

@media (max-width: 640px) {
  .forum-arcade-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

---

### 4.6. Pruebas Unitarias en `tests/unit/arcade-parties-api.test.ts`
Actualizar el test de rutas y redirecciones para reflejar el nuevo destino:
```typescript
test('LFG y Arcade redirigen permanentemente al Foro y la barra de navegación conserva Foro', () => {
  assert.match(
    readFileSync('src/app/parties/page.tsx', 'utf8'),
    /permanentRedirect\('\/forum\?tab=arcade'\)/,
  );
  assert.match(
    readFileSync('src/app/arcade/page.tsx', 'utf8'),
    /permanentRedirect\('\/forum\?tab=arcade'\)/,
  );
  assert.match(
    readFileSync('src/components/header-nav.tsx', 'utf8'),
    /href: '\/forum'/,
  );
  assert.doesNotMatch(
    readFileSync('src/components/header-nav.tsx', 'utf8'),
    /href: '\/arcade'/,
  );
  const sql = readFileSync('supabase/migrations/202610070008_arcade_and_parties.sql', 'utf8');
  assert.match(sql, /expires_at > now\(\)/);
  assert.match(sql, /interval '48 hours'/);
});
```

---

## 5. Criterios de Aceptación Deterministas

1. **Navegación e Integración de Vistas:**
   - Navegar a `/forum` muestra los debates comunitarios por defecto y el selector con pestaña "🕹️ Sala Arcade & LFG".
   - Pulsar la pestaña "🕹️ Sala Arcade & LFG" carga `/forum?tab=arcade` con el `GameDuelWidget`, los filtros de plataforma/estilo y el listado de escuadrones LFG.
   - En la pestaña de debates, si hay un duelo activo, aparece el banner teaser invitando a votar.
2. **Redirecciones 308:**
   - La ruta `/arcade` redirige permanentemente a `/forum?tab=arcade`.
   - La ruta `/parties` redirige permanentemente a `/forum?tab=arcade`.
3. **Limpieza del Navbar:**
   - `HeaderNav` ya no contiene el botón independiente `/arcade`. La barra superior y el navegador móvil tienen 12 elementos en lugar de 13, mejorando el espacio y la legibilidad.
4. **Calidad y Verificación (0 regresiones):**
   - `npm run check` (ESLint, `next typegen && tsc --noEmit`, 394 tests unitarios pasando, Prettier) concluye con código de salida 0.
