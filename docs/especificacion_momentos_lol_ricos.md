# Especificación Técnica: Momentos Enriquecidos de League of Legends en SaveState

## 1. Contexto y Diagnóstico
En la vista `/rift` (Rift Tracker), los usuarios pueden consultar sus partidas y presionar el botón `[ 🚀 Publicar en Momentos ]`.
Actualmente:
- El enlace generado apunta a `/highlights?draft=...&draftTitle=...`.
- El título y cuerpo son textos planos mínimos: `¡Partidaza con Vayne en CHERRY · Cola 1750! 15/18/16 (1.72 KDA) · Victoria.`.
- El modo de juego aparece con códigos internos o jerga técnica de Riot (por ejemplo `CHERRY · Cola 1750` en lugar de `Modo Arena`).
- No se menciona explícitamente el juego ("League of Legends") ni se estructuran los datos del combate (daño a campeones, oro, súbditos/CS, medallas de rendimiento como MVP o Pentakill).
- Al publicarse en `/highlights`, la tarjeta se renderiza con soporte Markdown completo (`PostCard` usa `renderMarkdown(post.content)`), pero al no haber formato en el borrador, se ve plana y sin impacto visual.

## 2. Objetivos de la Mejora
1. **Traducción amigable de modos y colas**:
   - Mapear las colas conocidas y nombres internos de Riot (`CHERRY`, queue `1700`, `1710`, `1750`) directamente a `"Modo Arena"`.
   - Limpiar cualquier modo para que nunca muestre `Cola XXXX` si es identificable.
2. **Generación de Momentos Ricos en Markdown**:
   - Crear un título llamativo: `🎮 League of Legends: ¡Partidaza con {Campeón} en {Modo}!`.
   - Crear un cuerpo estructurado con emojis y viñetas Markdown con:
     - Juego y Modo.
     - Campeón y nivel alcanzado.
     - Resultado de la partida (Victoria / Derrota con badge o emoji).
     - KDA y ratio.
     - Daño total a campeones y oro acumulado.
     - Súbditos (CS) y ritmo por minuto.
     - Participación en bajas (% P/K).
     - Medallas destacadas (MVP, Pentakill, Cuatricidio) si aplican.
     - Enlace interactivo al Rift Tracker (`[Ver en Rift Tracker](/rift)`).
3. **Compatibilidad total**:
   - Mantener el límite seguro de longitud en URL search params y textarea de momentos (máximo 5000 caracteres, el borrador ronda los ~450 caracteres).
   - Validar con `npm run check`.
   - Desplegar a producción en Vercel con `npx vercel --prod`.

## 3. Archivos Involucrados en `savestate 2`
1. `src/domain/lol-tracker.ts`:
   - En `lolQueueName`, añadir soporte para `1750` y mapear `mode === 'CHERRY'` a `'Arena'`.
2. `src/domain/lol-analytics.ts`:
   - Mejorar `lolMomentLink(match: LolMatchSummary)` para recibir o computar las medallas (`lolMatchMedals(match)`) y generar el Markdown formateado.
