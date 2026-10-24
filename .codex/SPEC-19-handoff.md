# Handoff para OpenAI Codex / GPT-6.1 Astra: SPEC-19

Copia y pega este prompt directamente en Codex / GPT:

```markdown
Eres un Ingeniero de Software Staff experto en Next.js 16 (App Router), React 19 Server Components y desarrollo web resiliente.

### 🎯 Tarea
Implementar la especificación técnica completa descrita en `docs/specs/SPEC-19-game-detail-rsc-resilience-and-error-isolation.md` para solucionar de raíz el colapso de renderizado (Minified React error #441 / Digest [3411904829]) en fichas de juego como `/games/god-of-war--1`.

---

### 📂 Archivos a Crear y Modificar

1. **`src/app/games/[slug]/error.tsx` (Crear):**
   - Error Boundary de segmento `'use client'` para confinar cualquier excepción en `/games/[slug]` sin romper el layout ni activar el error boundary raíz de la app.
   - Debe renderizar un panel glassmorphic con estética SaveState, título `SEÑAL DEL JUEGO INTERRUMPIDA // RECONEXIÓN`, mensaje explicativo, código de error `{error.digest ? \`Código de error: [\${error.digest}]\` : ''}`, botón `Reintentar sincronización` (`onClick={() => reset()}`) y enlace `Regresar al catálogo` (`href="/explore"`).

2. **`src/components/resilient-widget-boundary.tsx` (Crear):**
   - Componente cliente `'use client'` que implementa una clase `React.Component` con `componentDidCatch` y `getDerivedStateFromError`.
   - Si un widget secundario arroja un error en tiempo de ejecución, lo confina silenciosamente y renderiza `fallback ?? null` sin desmoronar el resto de la página.

3. **`src/components/game-meta-hub.tsx` (Modificar):**
   - En `GameMetaView`, blindar el formateo de fecha de Speedrun:
     ```typescript
     function formatSpeedrunDate(isoString?: string | null): string | null {
       if (!isoString || typeof isoString !== 'string') return null;
       const ts = Date.parse(isoString);
       if (Number.isNaN(ts)) return null;
       return new Date(ts).toLocaleDateString('es-CL', { timeZone: 'UTC' });
     }
     ```
   - Prevenir excepciones si `speedrun.dateIso` es una cadena inválida o no parseable.

4. **`src/components/game-critic-and-specs.tsx` (Modificar):**
   - Sanitizar de forma ultra-defensiva el identificador de radio buttons:
     ```typescript
     const safeId = (title || 'game')
       .toLowerCase()
       .replace(/[^a-z0-9]+/g, '-')
       .replace(/^-|-$/g, '') || 'game';
     ```
   - Evitar duplicaciones de guiones o atributos no válidos en W3C ante slugs como `god-of-war--1`.

5. **`src/services/game-achievements-service.ts` y `src/components/game-achievements.tsx` (Modificar):**
   - En `fetchCommunityAchievements`, asegurar que la indexación de `percentagesMap` soporte claves como string y número:
     ```typescript
     const rawPct = percentagesMap[internalKey] ?? percentagesMap[String(internalKey)] ?? (typeof a.internal_key === 'number' ? percentagesMap[a.internal_key] : undefined);
     ```
   - Asegurar que `unlockedPercentage` nunca sea `NaN` o `undefined` para evitar anomalías en el renderizado de estilos CSS (`width: ...%`).

6. **`src/app/games/[slug]/page.tsx` (Modificar):**
   - Envolver los widgets de Server Component (`GameLiveRadar`, `GameMetaHub`, `GameCriticAndSpecsHub`, `GameAchievementsHub`, `GameForum`) en límites de resiliencia para que ningún fallo de red o API externa tumbe la ficha de juego.

7. **`tests/unit/game-detail-resilience.test.ts` (Crear):**
   - Pruebas unitarias completas que verifiquen:
     - Formateo seguro de fechas en speedrun (fechas válidas, inválidas, nulas y vacías).
     - Generación determinista de `safeId` sin dobles guiones ni caracteres especiales.
     - Manejo defensivo del mapa de logros con claves numéricas y alfanuméricas.
     - Funcionamiento del Error Boundary de segmento.

---

### 📋 Criterios de Aceptación y Comandos de Verificación
1. `cmd.exe /c "set NODE_OPTIONS=--max-old-space-size=1536 && npm run typecheck"`: 0 errores TypeScript.
2. `cmd.exe /c "set NODE_OPTIONS=--max-old-space-size=1536 && npm run lint"`: 0 errores y 0 advertencias ESLint.
3. `npm run format:check`: 100% de cumplimiento Prettier.
4. `npm test`: Todas las pruebas (484 actuales + nuevas de resiliencia) deben pasar con código de salida 0.
5. `npx next build --webpack`: Compilación de producción exitosa en las 63 rutas.
```
