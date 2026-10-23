# SPEC-09: Reversión y Desmantelamiento Limpio de la Sala Arcade y LFG

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear `revert/arcade-lfg-hub`)  
> **Rama de Producción:** `main`  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Alta (Alineación con la visión de producto del usuario)

---

## 1. Objetivo y Contexto

Tras la entrega e inspección de la funcionalidad **SPEC-08 (Sala Arcade y Convocatorias LFG)**, la dirección de producto ha determinado que la experiencia de la Sala Arcade no cumple con la visión estética ni funcional deseada para SaveState.

El objetivo de esta especificación es **eliminar y revertir completamente la Sala Arcade y el tablero LFG**, restaurando el estado previo del sistema de forma quirúrgica:
1. Eliminar la ruta `/arcade` y su endpoint asociado `/api/parties`.
2. Restaurar la redirección canónica previa de `/parties` hacia `/chat` (`permanentRedirect('/chat')`).
3. Retirar el icono y enlace de `Arcade` en la barra superior de navegación (`HeaderNav`) y en el menú de comandos rápidos (`Ctrl + K`).
4. Revertir los componentes, estilos y tipos introducidos por SPEC-08 sin dejar archivos huérfanos ni referencias muertas.
5. Garantizar que la suite completa de calidad (`npm run check`) vuelva a sus 394 pruebas aprobadas con 0 fallos.

---

## 2. Lista Exacta de Archivos a Eliminar / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Eliminar** | `src/app/arcade/page.tsx` | Retirar la página de la Sala Arcade. |
| **Eliminar** | `src/app/api/parties/route.ts` | Retirar el endpoint API de convocatorias. |
| **Eliminar** | `src/components/arcade/party-board.tsx` | Retirar el componente de tablero LFG. |
| **Eliminar** | `src/components/arcade/party-modal.tsx` | Retirar el modal de creación de convocatorias. |
| **Eliminar** | `tests/unit/arcade-parties-api.test.ts` | Retirar la suite de pruebas del endpoint eliminado. |
| **Eliminar** | `docs/arcade-lfg-spec08.md` | Retirar la documentación técnica interna de SPEC-08. |
| **Modificar** | `src/app/parties/page.tsx` | Restaurar la redirección canónica: `permanentRedirect('/chat')`. |
| **Modificar** | `src/components/header-nav.tsx` | Eliminar el icono `Gamepad2` y el enlace `{ href: '/arcade', label: 'Arcade', icon: Gamepad2 }`. |
| **Modificar** | `src/components/command-menu.tsx` | Eliminar la entrada `['Sala Arcade & LFG', '/arcade']`. |
| **Modificar** | `src/app/arcade.css` | Retirar el bloque CSS de 44 líneas añadido al final (`/* Arcade LFG hub */`). |
| **Modificar** | `src/components/party-board.tsx` | Restaurar el componente a su estado original previo al refactor de SPEC-08. |
| **Modificar** | `src/domain/arcade.ts` | Retirar los tipos y validador `PartyFeedResponse`, `PartyFeedFilters` y `partyFeedFilters()`. |
| **Modificar** | `src/services/arcade.ts` | Restaurar la firma original de `partyFeed()`. |

---

## 3. Contratos y Reglas de Integridad

1. **Cero Enlaces Rotos:**
   - La barra de navegación debe conservar exactamente sus 12 rutas previas (`/explore`, `/screen`, `/library`, `/feed`, `/highlights`, `/forum`, `/chat`, `/lists`, `/players`, `/rift`, `/worlds`, `/hoyo`).
   - El menú `Ctrl + K` no debe incluir ninguna referencia a `/arcade`.
2. **Redirección Canónica de `/parties`:**
   - `src/app/parties/page.tsx` debe contener estrictamente:
     ```typescript
     import { permanentRedirect } from 'next/navigation';
     export default function PartiesPage() {
       permanentRedirect('/chat');
     }
     ```
   - Debe validar la prueba unitaria preexistente en `tests/unit/chat-navigation.test.ts`:
     `Legacy community and parties routes redirect permanently to the unified chat`.
3. **Preservación de la Base de Datos:**
   - No se requiere alterar la base de datos de Supabase. Las tablas históricas se mantienen sin impacto.
4. **Calidad Determinista:**
   - `npm run check` debe finalizar con 0 errores (ESLint, `next typegen && tsc --noEmit`, 394 pruebas pasando, Prettier conforme).

---

## 4. Algoritmo de Ejecución Paso a Paso para Codex

Codex ejecutará la reversión siguiendo este procedimiento:

### Paso 1: Crear la rama de trabajo y revertir el commit
Desde `implementation/chatgpt`:
```bash
git checkout implementation/chatgpt
git pull origin implementation/chatgpt
git checkout -b revert/arcade-lfg-hub
git revert --no-edit c99c422ba049aec282c98603d16567b17726f82a
```
*(Nota: El commit `c99c422` corresponde a la fusión del PR #14 en `implementation/chatgpt`. La reversión es limpia y sin conflictos).*

### Paso 2: Verificación de Calidad
Ejecutar la suite completa para confirmar la ausencia de errores o referencias rotas:
```bash
npm run check
```
Asegurar:
- ESLint: 0 advertencias, 0 errores.
- Typecheck: `next typegen && tsc --noEmit` correcto.
- Tests: 394 pruebas unitarias aprobadas al 100%.
- Formato: Prettier al 100%.

### Paso 3: Push y Apertura del PR
Hacer push de la rama `revert/arcade-lfg-hub` y abrir Pull Request hacia `implementation/chatgpt` con título:
`revert: desmantelar Sala Arcade y convocatorias LFG (SPEC-09)`

### Paso 4: Fusión y Propagación a `main`
- Fusionar el PR hacia `implementation/chatgpt`.
- Llevar la reversión a la rama `main` para que el despliegue en producción de Vercel elimine la sección inmediatamente.

---

## 5. Criterios de Aceptación Deterministas

1. **Ruta `/arcade`:** Devuelve 404 Not Found al visitarla.
2. **Ruta `/parties`:** Redirige con HTTP 308 permanente hacia `/chat`.
3. **Navegación:** Ni `HeaderNav` ni `CommandMenu` contienen el botón o entrada de Arcade.
4. **Test Suite:** Las 394 pruebas originales pasan en verde (0 fallos).
5. **CI / Vercel:** Los checks de GitHub Actions y el despliegue en producción terminan con estado `success`.
