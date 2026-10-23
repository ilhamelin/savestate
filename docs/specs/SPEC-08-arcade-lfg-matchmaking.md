# SPEC-08: Sala Arcade y Convocatorias LFG (Búsqueda de Compañeros de Partida en Tiempo Real)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear `feature/arcade-lfg-hub`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Alta (Engagement social, comunidad gamer activa, retención multiusuario)

---

## 1. Objetivo y Contexto

SaveState cuenta con modelos de dominio (`src/domain/arcade.ts`), servicios de persistencia (`src/services/arcade.ts`) y estilos visuales listos (`src/app/arcade.css`), así como la migración SQL `202610070008_arcade_and_parties.sql` ya ejecutada en Supabase. Sin embargo, la ruta `/parties` fue redirigida temporalmente a `/chat` y la ruta dedicada `/arcade` no cuenta con su página principal ni con su endpoint API de convocatorias.

El objetivo de esta especificación es **activar el Hub de Arcade y Convocatorias LFG (Looking For Group)** en `/arcade`, permitiendo a los jugadores:
1. **Publicar y Buscar Convocatorias LFG:** Tablero de partidas cooperativas, competitivas y cazas de logros con filtros por plataforma (`PC`, `PlayStation`, `Xbox`, `Nintendo Switch`, `Retro/Emulador`, `Multiplataforma`) y estilo de juego (`casual`, `competitive`, `coop_campaign`, `achievements`).
2. **Expiración Determinista de 48h:** Cada convocatoria vence a las 48 horas mediante triggers de base de datos; la UI muestra el tiempo restante y permite al autor retirarla en cualquier momento.
3. **Duelos Comunitarios Retro en Vivo:** Integración del widget de duelos arcade semanales con animación `VS` en pixel art, votación en tiempo real y resultados agregados.
4. **Navegación Unificada:** Acceso directo desde la barra de navegación principal (`src/components/header-nav.tsx`) y menú de comandos (`Ctrl + K`).

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/app/api/parties/route.ts` | Endpoint API Next.js con métodos `GET` (feed paginado y filtrado vía `partyFeed`) y `POST` (mutaciones de crear/eliminar vía `partyMutation`). |
| **Crear** | `src/app/arcade/page.tsx` | Página principal de la Sala Arcade con Server Component que precarga el duelo activo y el feed inicial de convocatorias. |
| **Crear** | `src/components/arcade/party-board.tsx` | Componente de cliente interactivo con barra de filtros (plataforma, estilo), cuadrícula de convocatorias, paginación y botón para abrir el modal. |
| **Crear** | `src/components/arcade/party-modal.tsx` | Diálogo nativo accesible (`<dialog>`) con foco atrapado, buscador de catálogo de juegos, selectores de plataforma/estilo y campos de horario/contacto. |
| **Modificar** | `src/app/parties/page.tsx` | Redirigir limpiamente a `/arcade` con `permanentRedirect('/arcade')`. |
| **Modificar** | `src/components/header-nav.tsx` | Añadir el enlace `{ href: '/arcade', label: 'Arcade', icon: Gamepad2 }` a la barra superior. |
| **Modificar** | `src/components/command-menu.tsx` | Registrar `['Sala Arcade & LFG', '/arcade']` en el menú `Ctrl + K`. |
| **Crear** | `tests/unit/arcade-parties-api.test.ts` | Pruebas unitarias de las rutas de API: validación de esquemas, paginación, autorización de sesión y borrado por autor. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

Los contratos base ya existen en `src/domain/arcade.ts`. El nuevo endpoint y componentes deben adherirse a ellos estrictamente:

```typescript
// En src/domain/arcade.ts (ya existente)
export type PartyPlatform = 'PC' | 'PlayStation' | 'Xbox' | 'Nintendo Switch' | 'Retro/Emulador' | 'Multiplataforma';
export type PartyStyle = 'casual' | 'competitive' | 'coop_campaign' | 'achievements';

export interface PartyCardData {
  id: string;
  user_id: string;
  game_id: string;
  platform: PartyPlatform;
  playstyle: PartyStyle;
  schedule: string;
  contact_note: string;
  created_at: string;
  expires_at: string;
  game: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
  };
  author: {
    id: string;
    username: string;
    avatar_url: string | null;
    level: number;
  };
}

export interface PartyFeedResponse {
  items: PartyCardData[];
  hasMore: boolean;
  generatedAt: number;
}
```

### Contrato de la API `POST /api/parties`
```typescript
export type CreatePartyInput = {
  action: 'create';
  game_id: string; // UUID válido
  platform: PartyPlatform;
  playstyle: PartyStyle;
  schedule: string; // Longitud: 3 a 100 caracteres
  contact_note: string; // Longitud: 3 a 500 caracteres
};

export type DeletePartyInput = {
  action: 'delete';
  id: string; // UUID de la convocatoria a retirar
};
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Endpoint `src/app/api/parties/route.ts`
1. **Método `GET`:**
   - Lee los searchParams de la URL: `platform`, `playstyle` y `page` (default 1).
   - Invoca `partyFeed({ platform, playstyle, page })` desde `src/services/arcade.ts`.
   - Responde con `Response.json({ data: feed }, { headers: { 'Cache-Control': 'private, no-store' } })`.
   - Captura errores con `errorResponse(error)`.
2. **Método `POST`:**
   - Delega en `mutation(request, partyMutation)` de `src/lib/http`.
   - Valida sesión obligatoria: 401 si no hay usuario autenticado.
   - `action === 'create'`: inserta fila en `party_requests` y devuelve `{ created: true }`.
   - `action === 'delete'`: borra la fila si `user_id === user.id`. Si no pertenece al usuario o no existe, retorna 404/403.

### 4.2. Interfaz en `/arcade` (`src/app/arcade/page.tsx`)
1. **Carga en Servidor:**
   - Consulta concurrentemente:
     - Duelo activo: `duelSummary()`
     - Feed inicial: `partyFeed({ page: 1 })`
     - Usuario actual: `currentUser()`
2. **Renderizado de la Sala:**
   - Encabezado temático retro: *"SALA ARCADE & LFG · ENCUENTRA TU ESCUADRÓN"*.
   - **Zona de Duelo (`GameDuelWidget`):** Muestra los dos juegos en contienda con sus barras y animación `VS`.
   - **Tablero LFG (`PartyBoard`):**
     - Selectores de filtro para `platform` y `playstyle` (utilizando `.party-filters`).
     - Botón `[+ Publicar Convocatoria]` (si el usuario no está autenticado, solicita inicio de sesión).
     - Cuadrícula de tarjetas `.party-grid` utilizando las clases ya preparadas en `src/app/arcade.css` (`.party-card`, `.party-cover`, `.party-author`, `.party-note`).
     - Cada tarjeta muestra el tiempo relativo hasta expirar (calculado contra `expires_at`).
     - Si el `author.id === currentUserId`, muestra el botón `[Retirar]` con confirmación previa.
3. **Modal de Creación (`PartyModal`):**
   - Usa la etiqueta semántica `<dialog>` con clase `.party-dialog`.
   - Permite buscar un juego del catálogo mediante `GET /api/games/search?q=...` o ingresar el UUID.
   - Campos de formulario con etiquetas accesibles (`htmlFor`, `id`, `aria-required`).

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Seguridad y RLS:**
   - Ningún usuario puede eliminar la convocatoria de otro jugador (el borrado valida `user_id = auth.uid()`).
   - Las convocatorias con `expires_at <= now()` jamás deben aparecer en el feed público.
2. **Validación de Entradas:**
   - Plataformas fuera de `PARTY_PLATFORMS` deben ser rechazadas con HTTP 400.
   - Horarios menores a 3 caracteres o mayores a 100 caracteres son rechazados con HTTP 400.
   - Notas de contacto menores a 3 o mayores a 500 caracteres son rechazadas con HTTP 400.
3. **Sanitización XSS:**
   - Las notas de contacto y horarios se renderizan como texto plano seguro (o con escape estricto); jamás se ejecuta HTML arbitrario.
4. **Accesibilidad y Movilidad:**
   - La cuadrícula `.party-grid` debe ser 100% responsiva (1 columna en móviles <640px, 2 columnas en desktop).
   - El diálogo modal debe cerrarse con la tecla `Escape` y contener el foco.
5. **Calidad de Código:**
   - `npm run check` pasando con 0 errores (ESLint, `next typegen && tsc --noEmit`, pruebas unitarias y Prettier).
