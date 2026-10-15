# Especificación Técnica: Radar de Juegos Gratis con Filtros de Plataforma y Contadores de Tiempo

## 1. Visión General
Esta especificación define la arquitectura técnica y la implementación para enriquecer el **Radar de Juegos Gratis** (`FreebiesTracker`) en la portada de SaveState con dos funcionalidades clave:
1. **Filtros interactivos por plataforma** (`[Todos]`, `[🔵 Steam]`, `[🟣 Epic Games]`, `[🟠 GOG]`, `[🎮 Consolas]`, `[💻 PC / DRM]`), incluyendo conteo dinámico por categoría y ocultamiento inteligente de tiendas sin ofertas vigentes.
2. **Badges de expiración con cuenta regresiva en tiempo real** (`⏳ Quedan X días`, `🔥 Quedan X horas`), calculados a partir del campo oficial `end_date` provisto por GamerPower.
3. **Compatibilidad total y preservación del Bot de Discord**: El flujo de anuncios en el canal `#anuncios-savestate` y la tarea cron horaria (`/api/cron/discord-freebies`) se conservan sin modificaciones destructivas.

---

## 2. Arquitectura de Datos y Dominio (`src/domain/freebies.ts`)

### 2.1 Modelo de Categorías de Plataformas
```typescript
export type FreebiePlatformCategory = 'all' | 'steam' | 'epic' | 'gog' | 'consoles' | 'pc';
```

### 2.2 Función Pura de Coincidencia (`matchesPlatformFilter`)
Evalúa de manera insensible a mayúsculas y minúsculas la cadena `item.platforms`:
```typescript
export function matchesPlatformFilter(
  platforms: string,
  filter: FreebiePlatformCategory,
): boolean {
  if (filter === 'all') return true;
  const p = platforms.toLowerCase();
  switch (filter) {
    case 'steam':
      return p.includes('steam');
    case 'epic':
      return p.includes('epic');
    case 'gog':
      return p.includes('gog');
    case 'consoles':
      return (
        p.includes('playstation') ||
        p.includes('xbox') ||
        p.includes('switch')
      );
    case 'pc':
      return p.includes('pc') || p.includes('drm-free');
    default:
      return true;
  }
}
```

### 2.3 Formateador de Tiempo Restante (`formatFreebieTimeRemaining`)
Procesa la fecha `endDate` (`YYYY-MM-DD HH:mm:ss` UTC) y calcula la diferencia respecto a `nowMs`:
```typescript
export interface FreebieCountdown {
  label: string;
  isUrgent: boolean;
}

export function formatFreebieTimeRemaining(
  endDate: string | null,
  nowMs = Date.now(),
): FreebieCountdown | null {
  if (!endDate) return null;
  const target = Date.parse(endDate.replace(' ', 'T') + 'Z');
  if (Number.isNaN(target)) return null;
  const diffMs = target - nowMs;
  if (diffMs <= 0) return null;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return { label: `Últimos ${mins}m`, isUrgent: true };
  }
  if (hours < 24) {
    return { label: `Quedan ${hours}h`, isUrgent: true };
  }
  if (days === 1) {
    return { label: `Queda 1 día`, isUrgent: false };
  }
  return { label: `Quedan ${days} días`, isUrgent: false };
}
```

### 2.4 Ampliación de Límite sin Romper Tests Existentes
En `normalizeFreebies`:
```typescript
export function normalizeFreebies(input: unknown, limit = 8): FreebieItem[] {
  // ...
  // Reemplazar: if (items.length === 8) break;
  // Por:
  if (items.length === limit) break;
  // ...
}
```
> **Nota de Regresión:** Al mantener `limit = 8` como valor por defecto, las pruebas unitarias existentes en `tests/unit/freebies.test.ts` continúan evaluando `assert.equal(rows.length, 8)` sin fallar.

---

## 3. Capa de Servicio (`src/services/freebies.ts`)

En `getActiveFreebies`:
```typescript
export async function getActiveFreebies(limit = 24): Promise<FreebieItem[]> {
  // ...
  return normalizeFreebies(JSON.parse(output + decoder.decode()), limit);
  // ...
}
```
Obtener hasta 24 juegos permite que al filtrar por tiendas específicas (ej. Steam o Epic Games) haya contenido disponible de forma consistente.

---

## 4. Componente de UI (`src/components/freebies-tracker.tsx`)

### 4.1 Estado y Filtros Reactivos
```tsx
const [filter, setFilter] = useState<FreebiePlatformCategory>('all');
```

### 4.2 Botones de Filtro con Conteo y Visibilidad Condicional
```tsx
const counts = useMemo(() => {
  const result: Record<FreebiePlatformCategory, number> = {
    all: freebies.length,
    steam: 0,
    epic: 0,
    gog: 0,
    consoles: 0,
    pc: 0,
  };
  for (const item of freebies) {
    if (matchesPlatformFilter(item.platforms, 'steam')) result.steam++;
    if (matchesPlatformFilter(item.platforms, 'epic')) result.epic++;
    if (matchesPlatformFilter(item.platforms, 'gog')) result.gog++;
    if (matchesPlatformFilter(item.platforms, 'consoles')) result.consoles++;
    if (matchesPlatformFilter(item.platforms, 'pc')) result.pc++;
  }
  return result;
}, [freebies]);

const visibleItems = useMemo(
  () => freebies.filter((item) => matchesPlatformFilter(item.platforms, filter)),
  [freebies, filter],
);
```

Fila de botones:
```tsx
const CATEGORIES: { key: FreebiePlatformCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'Todos', icon: '🎮' },
  { key: 'steam', label: 'Steam', icon: '🔵' },
  { key: 'epic', label: 'Epic Games', icon: '🟣' },
  { key: 'gog', label: 'GOG', icon: '🟠' },
  { key: 'consoles', label: 'Consolas', icon: '🕹️' },
  { key: 'pc', label: 'PC / DRM', icon: '💻' },
];

<div className="freebies-filters" role="tablist" aria-label="Filtrar por plataforma">
  {CATEGORIES.map(({ key, label, icon }) => {
    const count = counts[key];
    if (key !== 'all' && count === 0) return null;
    const active = filter === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={active}
        className={`button small ${active ? '' : 'outline'}`}
        onClick={() => setFilter(key)}
      >
        <span>{icon} {label}</span>
        <span className="freebies-count-tag">{count}</span>
      </button>
    );
  })}
</div>
```

### 4.3 Badge de Cuenta Regresiva en Tarjeta
Dentro de `<div className="freebie-art">`:
```tsx
const countdown = formatFreebieTimeRemaining(item.endDate);

{countdown && (
  <span
    className={`freebie-countdown-badge ${countdown.isUrgent ? 'urgent' : ''}`}
    title={`Finaliza: ${item.endDate}`}
  >
    {countdown.isUrgent ? '🔥 ' : '⏳ '}
    {countdown.label}
  </span>
)}
```

---

## 5. Estilos Visuales (`src/app/globals.css` / `halloween.css`)

```css
.freebies-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.25rem 0 1.5rem 0;
}

.freebies-count-tag {
  font-size: 0.72rem;
  opacity: 0.85;
  margin-left: 0.35rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.freebie-countdown-badge {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  padding: 0.2rem 0.5rem;
  background: #08080ce6;
  border: 1px solid #ffd700aa;
  color: #ffd700;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 4px;
  backdrop-filter: blur(6px);
  z-index: 2;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
}

.freebie-countdown-badge.urgent {
  border-color: #ff3366;
  color: #ff3366;
  box-shadow: 0 0 12px rgba(255, 51, 102, 0.4);
  animation: freebie-pulse 2s ease-in-out infinite alternate;
}

@keyframes freebie-pulse {
  from { opacity: 0.85; }
  to { opacity: 1; text-shadow: 0 0 8px #ff3366; }
}

@media (prefers-reduced-motion: reduce) {
  .freebie-countdown-badge.urgent {
    animation: none;
  }
}
```

---

## 6. Aislamiento y No Regresión de Discord

| Componente | Comportamiento | Impacto |
|---|---|---|
| `announceNewFreebiesToDiscord()` | Consulta `getActiveFreebies()` y busca IDs no anunciados en los últimos 100 mensajes. | **Sin alteración**. Sigue enviando a `#anuncios-savestate`. |
| Cron `/api/cron/discord-freebies` | Ejecuta `announceNewFreebiesToDiscord` y `announceGta6CountdownToDiscord`. | **Sin alteración**. |
| Comando `/gratis` | Usa `freebiesCommandResponse(await getActiveFreebies())`. | **Mejorado** (recibe más opciones activas). |
| Tests Unitarios (`freebies.test.ts`, `freebies-service.test.ts`) | Evalúan parsing, errores y límite por defecto (8). | **100% compatibles**. |
