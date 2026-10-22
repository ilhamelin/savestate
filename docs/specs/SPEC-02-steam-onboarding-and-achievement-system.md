# SPEC-02: Steam Fast Onboarding & Retro Gamification (Badges Expansion)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt`  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Alta (Adquisición de nuevos usuarios y Retención diaria)

---

## 1. Objetivo y Contexto

1. **Derribar la Barrera de Entrada (Steam Fast Onboarding):**
   Actualmente, el importador de Steam existe en `/library/import`, pero un nuevo usuario que llega a `/library` con 0 juegos ve una pantalla vacía sin un llamado a la acción (CTA) claro. Debemos guiarlo inmediatamente para que importe su colección en 1 clic.
2. **Fomentar el Retorno Diario (Gamificación con Badges & Feedback en Vivo):**
   El sistema de base de datos (`user_badges`) y la galería en el perfil ya existen, pero falta el bucle de recompensa visual inmediata: cuando el usuario desbloquea un logro (ej. al guardar su primer juego o completar un RPG), la app debe mostrar un **Toast retro animado de "¡Logro Desbloqueado!"** y reflejar un **Nivel de Jugador** en su perfil.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear / Modificar** | `src/components/library-empty-hero.tsx` | Tarjeta Hero llamativa en `/library` cuando el usuario tiene 0 juegos, invitando a importar de Steam / Consolas. |
| **Modificar** | `src/components/library.tsx` | Integrar `LibraryEmptyHero` cuando `entries.length === 0` y `editable === true`. |
| **Crear** | `src/components/badge-unlock-toast.tsx` | Notificación interactiva flotante estilo retro pixel-art con animación CSS y sonido opcional. |
| **Modificar** | `src/domain/badges.ts` | Definir contrato de tipos para niveles de jugador (`PlayerLevel`) y cálculo de XP según medallas. |
| **Modificar** | `src/components/badge-gallery.tsx` | Añadir barra de progreso general de medallas (`X de Y desbloqueadas — Z%`) y rango gamer. |
| **Crear** | `tests/unit/badges-level.test.ts` | Suite de pruebas unitarias para el cálculo de niveles gamer y visualización de medallas. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

En `src/domain/badges.ts`:

```typescript
export interface PlayerLevel {
  level: number;
  title: string;
  earnedCount: number;
  totalCount: number;
  progressPercentage: number;
  nextLevelThreshold: number | null;
}

export interface BadgeUnlockEvent {
  badgeId: string;
  badgeName: string;
  badgeDescription: string;
  iconPixel: string;
  unlockedAt: string;
}

export function calculatePlayerLevel(earnedCount: number, totalCount: number): PlayerLevel {
  const percentage = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;
  
  let level = 1;
  let title = 'Iniciado del Checkpoint';
  let nextThreshold: number | null = 2;

  if (earnedCount >= 7) {
    level = 5;
    title = 'Leyenda del Guardado';
    nextThreshold = null;
  } else if (earnedCount >= 5) {
    level = 4;
    title = 'Veterano de Bóveda';
    nextThreshold = 7;
  } else if (earnedCount >= 3) {
    level = 3;
    title = 'Explorador de Cartuchos';
    nextThreshold = 5;
  } else if (earnedCount >= 1) {
    level = 2;
    title = 'Coleccionista Novato';
    nextThreshold = 3;
  }

  return {
    level,
    title,
    earnedCount,
    totalCount,
    progressPercentage: percentage,
    nextLevelThreshold: nextThreshold,
  };
}
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### Flujo 1: Onboarding Rápido en Biblioteca Vacía
1. En `src/components/library.tsx`, evaluar:
   ```typescript
   if (entries.length === 0 && editable) {
     return <LibraryEmptyHero username={...} />;
   }
   ```
2. `LibraryEmptyHero` renderiza:
   - Título impactante con estética terminal: `[CHECKPOINT 0: INICIA TU COLECCIÓN]`.
   - Botón de acción principal (CTA): `⚡ Importar desde Steam en 1 Clic` (lleva a `/library/import`).
   - Botón secundario: `Explorar catálogo IGDB` (lleva a `/explore`).

### Flujo 2: Notificación Toast de Logro Desbloqueado
1. En el layout principal (`src/app/layout.tsx` o en un Client Provider de notificaciones):
   - Escuchar las notificaciones de tipo `badge_unlocked` recibidas por Supabase Realtime o emitidas al cambiar de estado un juego en cliente.
2. `BadgeUnlockToast` renderiza un modal/toast flotante en la esquina inferior derecha:
   - Marco de 8 bits con borde neón (`box-shadow: 0 0 15px var(--accent)`).
   - Icono SVG de la medalla correspondiente.
   - Texto: `¡LOGRO DESBLOQUEADO!` en mayúsculas pequeñas seguido del nombre de la medalla.
   - Desvanecimiento automático a los 6 segundos o con botón de cierre `✕`.

---

## 5. Criterios de Aceptación Deterministas

1. **`calculatePlayerLevel` Tests:**
   * Con 0 medallas -> Nivel 1 (`Iniciado del Checkpoint`), siguiente umbral 1.
   * Con 1 medalla -> Nivel 2 (`Coleccionista Novato`).
   * Con 7 medallas -> Nivel 5 (`Leyenda del Guardado`), `nextLevelThreshold: null`.
2. **Library Empty State:**
   * Si la biblioteca tiene juegos, `LibraryEmptyHero` no se muestra.
   * Si la biblioteca tiene 0 juegos y el visitante no es dueño (`editable = false`), muestra el mensaje neutro actual (`"Esta biblioteca aún no tiene juegos registrados"`).
   * Si la biblioteca tiene 0 juegos y es el dueño (`editable = true`), muestra el Hero con el botón hacia `/library/import`.
3. **Validación CI en la Nube:**
   * `npx tsc --noEmit` pasa con 0 errores de tipos.
   * `npm run lint` pasa sin advertencias.
   * `npm test` pasa la nueva suite `tests/unit/badges-level.test.ts` junto a los 327 tests existentes (total >= 332 tests).
