# Consulta Técnica: Análisis de Dependencias y Actualizaciones Disponibles

**Fecha:** 7 de octubre de 2026  
**Origen:** Investigación y Auditoría (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Referencia:** Herramienta visual de gestión de paquetes (NPM Visual Manager: 16 actualizaciones reportadas sobre `package.json`).

---

## 1. Contexto

La interfaz de inspección de dependencias reporta **16 paquetes con versiones más recientes disponibles** (distribuidas en 6 *MAJOR*, 7 *MINOR* y 1 *PATCH*).

El proyecto actualmente se encuentra en un estado funcional validado:
* `npm run check` aprueba sin errores (tipado estricto, 11 tests unitarios, lint y formato).
* `npm run build` compila limpiamente para producción.
* `npm audit` reporta **0 vulnerabilidades conocidas**.
* [docs/decisiones_aprobadas.md](file:///c:/Users/benja/OneDrive/Documentos/ChatGPT/savestate-research/docs/decisiones_aprobadas.md) (línea 27) define expresamente: *"Se utilizan versiones compatibles dentro de los majors documentados y un lockfile reproducible"*.

El propósito de este documento es evaluar técnicamente qué paquetes **NO deben tocarse**, cuáles **podrían actualizarse de forma segura**, y formular una consulta coordinada a Codex para consensuar la política de mantenimiento.

---

## 2. Clasificación de Riesgo por Paquete

### 🔴 Categoría A: No Actualizar (Riesgo Crítico de Ruptura / Breaking Changes)

Pulsar "Actualizar" en estos paquetes rompería la compilación o las reglas arquitectónicas del proyecto:

| Paquete | Versión actual | Versión sugerida | Tipo | Justificación de bloqueo |
|---|---|---|---|---|
| **`@types/node`** | `^24.0.0` | `26.6.4` | **MAJOR** | El proyecto está formalmente anclado a Node.js 24 (`package.json.engines: ">=24.0.0"`). Subir los tipos a Node 26 introduciría definiciones de APIs inexistentes en el runtime del servidor. |
| **`eslint`** y **`@eslint/js`** | `^9.0.0` / `^9.39.5` | `10.12.0` / `10.0.1` | **MAJOR** | ESLint 10 introduce cambios incompatibles con plugins del ecosistema actual (`eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `typescript-eslint`). Rompería `npm run lint`. |
| **`marked`** | `^17.0.0` | `18.1.0` | **MAJOR** | Núcleo crítico del renderizado de reseñas. Los saltos mayores en Marked alteran parsers, extensiones y tipados, poniendo en riesgo los tests en `tests/unit/markdown.test.ts`. |
| **`isomorphic-dompurify`** | `^3.0.0` | `4.5.0` | **MAJOR** | Componente crítico de seguridad (**RNF-03**, prevención XSS). Un major bump puede modificar firmas de sanitización o perfiles de hooks de DOMPurify. |
| **`lucide-react`** | `^0.468.0` | `1.52.0` | **MAJOR** | El paso de la serie `0.x` a `1.x` renombra y depreca múltiples iconos SVG, lo que provocaría errores de importación en componentes HUD (`src/components/`). |

---

### 🟡 Categoría B: Evaluar con Cautela (Minor Bumps dependientes del Framework)

| Paquete | Versión actual | Versión sugerida | Tipo | Consideraciones |
|---|---|---|---|---|
| **`react`** / **`react-dom`** / **`@types/react*`** | `^19.0.0` | `19.3.0` | **MINOR** | Next.js 16.4.0 gestiona un acoplamiento estrecho con la versión de React 19. No debe forzarse una versión de React que no esté explícitamente probada por la versión de Next.js instalada. |
| **`@supabase/supabase-js`** | `^2.0.0` | `2.117.3` | **MINOR** | Permanece dentro de la serie mayor `v2`. Dado que `package.json` ya usa `^2.0.0`, el rango semver ya la admite, pero debe validarse en sincronía con `@supabase/ssr` (`^0.12.7`). |
| **`@tailwindcss/postcss`** | `^4.0.0` | `4.3.3` | **MINOR** | Mejoras de rendimiento en Tailwind CSS v4. Generalmente compatible, pero debe comprobarse que `npm run build` no altere los estilos neón ni los tokens pixel art. |

---

### 🟢 Categoría C: Bajo Riesgo (Actualizaciones Seguras)

| Paquete | Versión actual | Versión sugerida | Tipo | Impacto |
|---|---|---|---|---|
| **`canvas-confetti`** | `^1.9.3` | `1.9.4` | **PATCH** | Corrección de errores menores, sin cambios en la API pública. |
| **`prettier`** | `^3.0.0` | `3.9.9` | **MINOR** | Formateador de código; bajo riesgo (validar únicamente que `npm run format:check` siga pasando). |

---

## 3. Advertencia Operativa: Peligro del Botón *"Actualizar Todo (16)"*

> [!CAUTION]
> El uso del botón global **"Actualizar Todo (16)"** en el gestor visual modificará los rangos de `package.json` a ciegas, forzando 6 saltos de versión mayor (Breaking Changes). Esto desestabilizará de inmediato la suite de pruebas unitarias, el linter y la compatibilidad de Next.js 16.

---

## 4. Preguntas para Codex (ChatGPT)

Para coordinar la postura técnica con el equipo de implementación, se plantean las siguientes consultas:

1. **Gobernanza de Majors:** ¿Coincides en mantener estrictamente congeladas las versiones mayores (`eslint` 9, `marked` 17, `isomorphic-dompurify` 3, `lucide-react` 0.x y `@types/node` 24) conforme a las directrices de estabilidad de `decisiones_aprobadas.md`?
2. **Cliente Supabase:** Dado que la validación externa con credenciales reales es el siguiente hito, ¿recomiendas mantener congelado el lockfile actual o refrescar `@supabase/supabase-js` al último minor de la rama v2?
3. **Flujo de actualización:** En caso de aplicar actualizaciones menores o de parche (Categoría C), ¿se acuerda hacerlo de manera incremental paquete por paquete, verificando `npm run check` tras cada cambio en lugar de una actualización masiva?
