# SPEC-18: Salón de Trofeos y Logros de Steam con Rareza Global

## 1. Contexto y Objetivos

### 1.1 Contexto
SaveState busca consolidarse como la plataforma definitiva para entusiastas del gaming, complementando la ficha del juego con datos enriquecidos de alto valor. Tras la implementación de telemetría en vivo (SPEC-13), metadatos de duración, compatibilidad ProtonDB y récords de speedrun (SPEC-16), y consenso de crítica junto con especificaciones de hardware PC (SPEC-17), surge la necesidad de ofrecer a los jugadores una sección dedicada a los **Logros y Trofeos Oficiales**.

Los cazadores de trofeos y completistas necesitan conocer qué logros ofrece un videojuego, cuáles son secretos (spoilers de historia), y qué tan raros o difíciles son de conseguir a nivel mundial.

### 1.2 Objetivos
1. **Salón de Trofeos Oficial en Español:** Extraer la lista completa de logros oficiales desde Steam Community (`valve-ssr-data`), incluyendo nombre, descripción oficial en español, icono de arte en alta definición y estado de logro oculto/secreto.
2. **Rareza Global Dinámica (Tiers de Trofeos):** Calcular el nivel de rareza según el porcentaje mundial de desbloqueo:
   - 💎 **Platino (Ultra Raro):** Desbloqueado por `< 10%` de los jugadores (o logro maestro de completitud 100%).
   - 🥇 **Oro (Muy Raro):** Desbloqueado por `≥ 10%` y `< 25%`.
   - 🥈 **Plata (Raro):** Desbloqueado por `≥ 25%` y `< 50%`.
   - 🥉 **Bronce (Común):** Desbloqueado por `≥ 50%`.
3. **Resumen Estadístico del Desafío:** Mostrar panel con total de logros, desglose por nivel de rareza (cuántos platino, oro, plata y bronce), promedio de desbloqueo y trofeo más codiciado.
4. **Protección Anti-Spoilers para Logros Ocultos:** Los logros marcados como `hidden: true` muestran un indicador de secreto para prevenir revelar detalles argumentales no deseados, con opción de revelado.
5. **Experiencia UI Eficiente:** Renderizado con diseño táctico *glassmorphic*, filtrado y expansión progresiva (`<details>` / `<summary>`) para títulos con decenas de logros, sin saturar la altura inicial de la página ni generar sobrecoste en el bundle cliente.
6. **Costo Cero y Resiliencia de Red:** Consumo directo de la API pública de Steam Community con timeout estricto y fallback a `appdetails` de Steam Store y `unstable_cache` de 24 horas.

---

## 2. Archivos a Crear y Modificar

| Tipo | Ruta | Acción | Propósito |
| :--- | :--- | :---: | :--- |
| **Doc** | `docs/specs/SPEC-18-steam-achievements-trophy-hall.md` | Crear | Esta especificación técnica. |
| **Domain** | `src/domain/game-achievements.ts` | Crear | Tipos TypeScript, clasificación de rareza, cálculo de estadísticas y normalización de URLs seguras. |
| **Service** | `src/services/game-achievements-service.ts` | Crear | Fetcher de Steam Community SSR + Steam Store fallback con caché Next.js de 24 horas. |
| **Styles** | `src/styles/game-achievements.css` | Crear | Estilos glassmorphic, auras de rareza (Platino/Oro/Plata/Bronce), badges y tarjetas. |
| **Component** | `src/components/game-achievements.tsx` | Crear | Componentes Server Component (`GameAchievementsView` y `GameAchievementsHub`). |
| **Page** | `src/app/games/[slug]/page.tsx` | Modificar | Integrar `<GameAchievementsHub title={game.title} />` dentro de `<Suspense>`. |
| **Tests** | `tests/unit/game-achievements.test.ts` | Crear | Pruebas unitarias para parsers, tiers de rareza, normalizadores y renderizado de componentes. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

```typescript
export const ACHIEVEMENT_TIERS = ['platino', 'oro', 'plata', 'bronce'] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];

export interface GameAchievementItem {
  id: string; // internal_key o api_name
  apiName: string;
  name: string;
  description: string;
  hidden: boolean;
  iconUrl: string;
  iconLockedUrl?: string;
  unlockedPercentage: number;
  tier: AchievementTier;
}

export interface AchievementRaritySummary {
  total: number;
  platinoCount: number;
  oroCount: number;
  plataCount: number;
  bronceCount: number;
  hiddenCount: number;
  averageUnlockRate: number;
  rarestAchievement: GameAchievementItem | null;
}

export interface GameAchievementsReport {
  appId: number | null;
  communityUrl: string | null;
  hasAchievements: boolean;
  totalAchievements: number;
  summary: AchievementRaritySummary;
  achievements: GameAchievementItem[];
}
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1 Búsqueda y Resolución de Steam AppId
1. Si el juego tiene título, se busca en `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=US`.
2. Se normaliza el título usando `normalizedMetaTitle(title)` de `src/domain/game-meta.ts`.
3. Si no hay coincidencia exacta de AppId, se retorna reporte vacío `{ hasAchievements: false }`.

### 4.2 Extracción de Logros desde Steam Community SSR
1. Se realiza petición `GET` a `https://steamcommunity.com/stats/${appId}/achievements/?l=spanish` con cabeceras `Accept-Language: es-ES,es;q=0.9,en;q=0.8` y `User-Agent` descriptivo.
2. Se busca la etiqueta `<script type="application/json" id="valve-ssr-data"[^>]*>([\s\S]*?)<\/script>`.
3. Si se localiza:
   - Se parsea el JSON raíz y luego `raw.renderContext.queryData`.
   - Se busca la query con `queryKey` que coincida con `['achievements', appId, 'schema']`. En `state.data.groups`, se recolectan los logros.
   - Se busca la query con `queryKey` que contenga `'globalpercentages'`. En `state.data.percentages`, se extrae el mapa `{ [internal_key]: number }`.
   - Se mapea cada logro asociando su porcentaje. Si no está en el mapa, se usa `0`.
4. Si la petición o el bloque SSR falla:
   - Se consulta `https://store.steampowered.com/api/appdetails?appids=${appId}&l=spanish`.
   - Si `entry.data.achievements.highlighted` existe, se mapean los logros destacados con rareza estimada o calculada.
5. Se ordenan los logros: de menor porcentaje a mayor porcentaje (más raros primero), o conservando el logro platino al inicio.
6. Se calculan las estadísticas acumuladas (`platinoCount`, `oroCount`, `plataCount`, `bronceCount`, `hiddenCount`, `averageUnlockRate`, `rarestAchievement`).

### 4.3 Sanitización y Seguridad
- Todas las URLs de iconos deben provenir de dominios confiables de Valve (`*.steamstatic.com`, `*.akamai.steamstatic.com`, `*.fastly.steamstatic.com`).
- Nombres y descripciones son saneados contra inyección HTML usando texto plano seguro.

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Juego con Logros Completos (ej. Elden Ring, Hollow Knight, Portal 2):**
   - Retorna lista de logros con nombre en español, descripción, icono y porcentaje.
   - Resumen muestra conteo por categoría y trofeo más raro.
2. **Juego sin Logros en Steam o Exclusivo de Consola (ej. Zelda, Mario):**
   - Retorna `hasAchievements: false`.
   - La UI no se rompe ni muestra datos vacíos; se oculta limpiamente o muestra mensaje sutil de no disponible.
3. **Logros Ocultos / Secretos:**
   - La propiedad `hidden: true` se respeta y la UI incluye distintivo de secreto.
4. **Resiliencia de Red y Rate Limiting:**
   - Si Steam Community devuelve HTTP 429 o 5xx, el sistema atrapa el error y recurre al fallback o devuelve reporte vacío sin quebrar la página.
5. **Caché y Rendimiento:**
   - La llamada utiliza `unstable_cache` con revalidación de 24 horas y etiqueta `['game-achievements-v1']`.
6. **Cumplimiento de Calidad:**
   - 100% de tests unitarios pasando (`npm test`).
   - 0 errores de TypeScript (`npm run typecheck`).
   - 0 errores de ESLint (`npm run lint`).
   - Prettier formateado (`npm run format:check`).
   - Turbopack production build exitoso.
