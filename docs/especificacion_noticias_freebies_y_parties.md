# Especificación Técnica: Cargar Más en Noticias, Radar de Juegos Gratis (Freebies) y Lobbies de Compañeros (/parties)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Implementar tres mejoras de alto valor para la comunidad gamer en SaveState:
1. **Botón interactivo «Cargar más...»** en el feed de Noticias Recientes de la portada.
2. **Radar de Juegos Gratis (Freebies Tracker)** consumiendo en tiempo real la API de GamerPower para avisar de juegos 100% gratis en Epic Games, Steam y GOG.
3. **Rediseño completo de Compañeros de Partida (`/parties`)** transformando las convocatorias en tarjetas de Lobbies multijugador estilo Discord/LFG.

---

## 1. Función 1: Botón «Cargar más...» en Noticias Recientes

### 1.1. Ampliar el buffer en `src/domain/gaming-news.ts`
* En `combineGamingNews`, ampliar el límite de 12 a **30 noticias** (`.slice(0, 30)`).
* En `parseGamingRss`, permitir procesar hasta 20 entradas por feed (Vandal e IGN).

### 1.2. Paginación progresiva en `src/components/recent-news-section.tsx`
* Estado local: `const [visibleCount, setVisibleCount] = useState(8);`.
* Al cambiar de pestaña de fuente (`all`, `vandal`, `ign`), reiniciar `setVisibleCount(8)`.
* Renderizar únicamente `visible.slice(0, visibleCount)`.
* Botón de acción:
  * Si `visibleCount < visible.length`:
    ```tsx
    <div className="news-load-more-wrap">
      <button
        type="button"
        className="button outline small news-load-more"
        onClick={() => setVisibleCount((prev) => prev + 6)}
      >
        ▾ Cargar más noticias ({Math.min(6, visible.length - visibleCount)} restantes)
      </button>
    </div>
    ```
  * Si ya se alcanzaron todas las noticias: texto atenuado `● Fin de la transmisión del día`.

---

## 2. Función 2: Radar de Juegos Gratis (Freebies Tracker)

### 2.1. Servicio `src/services/freebies.ts`
Consume la API abierta de GamerPower (`https://www.gamerpower.com/api/giveaways?type=game`) con caché `{ next: { revalidate: 3600 } }`:

```ts
export interface FreebieItem {
  id: number;
  title: string;
  worth: string;
  thumbnail: string;
  image: string;
  description: string;
  instructions: string;
  openGiveawayUrl: string;
  platforms: string;
  endDate: string | null;
}

export async function getActiveFreebies(): Promise<FreebieItem[]> {
  try {
    const res = await fetch('https://www.gamerpower.com/api/giveaways?type=game', {
      headers: { 'User-Agent': 'SaveState-Journal/1.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 8).map((g) => ({
      id: g.id,
      title: g.title,
      worth: g.worth || '$0.00',
      thumbnail: g.thumbnail,
      image: g.image,
      description: g.description || '',
      instructions: g.instructions || '',
      openGiveawayUrl: g.open_giveaway_url,
      platforms: g.platforms || 'PC',
      endDate: g.end_date ?? null,
    }));
  } catch (err) {
    console.error('Error cargando freebies:', err);
    return [];
  }
}
```

### 2.2. Componente `src/components/freebies-tracker.tsx`
* Módulo con cabecera:
  * Eyebrow: `LOOT ALERTA // JUEGOS GRATIS ACTIVOS`.
  * Título: `Radar de Juegos Gratis`.
  * Subtítulo: `Títulos para reclamar y quedarte para siempre en Steam, Epic Games y GOG.`
* Carrusel / Cuadrícula de tarjetas `.freebies-grid`:
  * Carátula con badge de plataforma (`[Steam]`, `[Epic Games Store]`).
  * Badge de ahorro: `[ 100% OFF · Valor {item.worth} ]`.
  * Título del juego.
  * Botón directo: `[ 🎁 Reclamar gratis ↗ ]` (`target="_blank" rel="noopener noreferrer"`).

### 2.3. Integración en `src/app/page.tsx`
* Añadir `const freebies = await getActiveFreebies();`.
* Renderizar `<FreebiesTracker freebies={freebies} />` justo antes del footer o como módulo complementario a Noticias Recientes.

---

## 3. Función 3: Rediseño de «Compañeros de Partida» (/parties) estilo Lobby de Discord

### 3.1. Reestructuración de `PartyBoard` en `src/components/party-board.tsx`
Cada convocatoria se transforma en un **Lobby Multijugador**:
1. **Barra Superior del Lobby:**
   * Pulso de estado verde: `● RECLUTANDO`.
   * Cronómetro de expiración relativo (`Expira en Xh`).
   * Badges de plataforma y estilo (`[PC]`, `[Competitivo]`).
2. **Cuerpo del Lobby:**
   * Carátula vertical del juego (80x110px con esquinas redondeadas).
   * Título del juego con enlace a su ficha.
   * Horario de disponibilidad (`Disponible: Noches GMT-3`).
   * Nota de contacto y voz (`Discord: @usuario`, `Voz requerida`).
3. **Barra de Anfitrión y Acción Rápida:**
   * Mini-avatar del host con nivel de jugador (`Nivel 14`).
   * Botón interactivo: `[ 📋 Copiar contacto ]` con feedback inmediato de portapapeles (*«¡Contacto copiado!»*).
   * Si el usuario es el creador: botón `[ ✕ Retirar ]`.

### 3.2. Estilos en `src/app/globals.css`
Añadir clases para `.freebies-grid`, `.freebie-card`, `.party-lobby-card`, `.party-lobby-header`, etc.

---

## 4. Plan de Verificación

1. En la Home (`/`):
   * Comprobar que en Noticias Recientes solo aparecen 8 filas inicialmente y un botón `[ ▾ Cargar más noticias (+6) ]` que revela los siguientes ítems de inmediato.
   * Comprobar que el Radar de Juegos Gratis muestra las ofertas activas reales con enlaces directos.
2. En `/parties`:
   * Verificar que las tarjetas tienen diseño de lobby con badges, pulso verde y botón para copiar contacto.
3. Ejecutar `npm run check` para asegurar 0 errores de compilación y tests pasando.
