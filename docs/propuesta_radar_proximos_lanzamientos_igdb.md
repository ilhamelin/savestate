# Especificación Técnica: Radar de «Próximos Lanzamientos» con Cuenta Regresiva (IGDB)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Integrar el modo **«Próximos Lanzamientos» (`upcoming`)** en el catálogo (`/explore`), consultando en IGDB los juegos con fecha de estreno futura (`first_release_date > hoy`), ordenándolos del estreno más cercano al más lejano y mostrando un **contador regresivo en días** (`⏳ Faltan X días`) directamente sobre cada póster sin requerir migraciones en la base de datos.

---

## 1. Arquitectura de Datos (Sin Migración SQL)

La tabla `public.games` en Supabase almacena `release_year` (entero), mientras que IGDB entrega `first_release_date` (timestamp Unix exacto en segundos).
Para mostrar la cuenta regresiva exacta sin modificar el esquema SQL de `public.games`:
1. `mapIgdbGame` (o un helper en `query.ts`) conserva las columnas de base de datos intactas para el `upsert`, y expone un mapa auxiliar de `first_release_date` por `igdb_id`.
2. En `src/services/catalogue.ts`, tras combinar los datos con `localCatalogue`, se adjuntan al objeto devuelto al cliente dos propiedades calculadas:
   * `release_date: string | null` (fecha ISO del estreno).
   * `days_until_release: number | null` (días restantes respecto a hoy cuando la fecha es futura).

---

## 2. Modificaciones Requeridas

### 2.1. Actualizar `src/integrations/igdb/query.ts`
1. Ampliar `CatalogueFilters['sort']`:
   ```ts
   sort: 'relevance' | 'recent' | 'classics' | 'upcoming';
   ```
2. En `parseFilters(params)`:
   Permitir `'upcoming'` como valor válido de `sort`.
3. En `igdbQuery(filters)`:
   ```ts
   const todaySec = Math.floor(Date.now() / 86400000) * 86400;
   if (filters.sort === 'recent')
     where.push(`first_release_date <= ${todaySec}`);
   if (filters.sort === 'upcoming') {
     where.push(`first_release_date > ${todaySec}`);
     where.push('cover.image_id != null');
   }
   if (filters.sort === 'classics') where.push('first_release_date < 1262304000');
   ```
   Y ajustar el criterio de orden:
   ```ts
   const sort =
     filters.sort === 'upcoming'
       ? 'first_release_date asc'
       : filters.sort === 'recent'
         ? 'first_release_date desc'
         : 'total_rating_count desc';
   ```
4. Añadir cálculo de cuenta regresiva (`daysUntilRelease`):
   ```ts
   export function daysUntilRelease(unixSeconds?: number | null, nowMs = Date.now()): number | null {
     if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
     const diffMs = unixSeconds * 1000 - nowMs;
     if (diffMs <= 0) return null;
     return Math.ceil(diffMs / 86400000);
   }
   ```

### 2.2. Actualizar `src/services/catalogue.ts` y `src/repositories/catalogue.ts`
1. En `src/repositories/catalogue.ts`:
   * Si `filters.sort === 'upcoming'`, filtrar en fallback local con `query = query.gte('release_year', new Date().getUTCFullYear()).order('release_year', { ascending: true })`.
2. En `src/services/catalogue.ts`:
   * Separar el timestamp exacto antes del `upsert` en `public.games` (para no enviar columnas inexistentes a PostgREST) y enriquecer los juegos devueltos con `release_date` y `days_until_release`.

### 2.3. Actualizar `src/components/explore.tsx` y `src/components/game-card.tsx`
1. En `src/components/explore.tsx`:
   * Añadir pestañas de acceso rápido sobre el buscador:
     * `[ 🔥 Populares ]` (`relevance`)
     * `[ 🚀 Próximos Estrenos ]` (`upcoming`)
     * `[ ⚡ Recientes ]` (`recent`)
     * `[ 🕹️ Clásicos ]` (`classics`)
   * Añadir la opción `upcoming` en el `<select>` de ordenar.
2. En `src/components/game-card.tsx`:
   * Aceptar prop opcional `daysUntil?: number | null` y `releaseDate?: string | null`.
   * Cuando `daysUntil` esté presente, mostrar un badge destacado en la parte superior del póster:
     ```tsx
     <span className="game-poster-badge countdown">
       ⏳ {daysUntil === 1 ? 'Mañana' : `Faltan ${daysUntil}d`}
     </span>
     ```

### 2.4. Estilos en `src/app/globals.css`
```css
.game-poster-badge.countdown {
  color: #00ff66;
  border-color: rgba(0, 255, 102, 0.45);
  background: rgba(8, 20, 14, 0.85);
  box-shadow: 0 0 10px rgba(0, 255, 102, 0.2);
}

.explore-mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}
```

---

## 3. Plan de Verificación

1. En `/explore`, hacer clic en la pestaña `[ 🚀 Próximos Estrenos ]`.
2. Comprobar que se listan juegos con fecha futura ordenados por cercanía de lanzamiento y que cada póster muestra el badge verde neón `⏳ Faltan Xd`.
3. Verificar que el botón de añadir rápido (`QuickAdd`) permite agendar cualquiera de estos próximos estrenos en la `Wishlist`.
4. Ejecutar `npm run check` para validar que todos los tests y tipos pasen con 0 errores.
