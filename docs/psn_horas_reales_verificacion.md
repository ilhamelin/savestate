# Horas reales de PlayStation

Implementa `propuesta_playstation_horas_reales.md`, leída desde `research/antigravity`. No requiere migraciones ni dependencias adicionales.

`parseIsoDuration` convierte horas/minutos/segundos ISO de Sony a horas decimales con dos decimales. Devuelve cero para valores vacíos, tipos incorrectos, duraciones mal formadas o valores no finitos. Ejemplos: `PT72H23M32S` → 72,39 h; `PT2H25M` → 2,42 h; `PT45M` → 0,75 h; `PT10S` → 0 h por redondeo.

La integración consulta trofeos e historial de juegos en paralelo, con hasta dos páginas de 100 registros por servicio. El historial opcional tiene límite de espera de seis segundos; si falla o es privado, se conservan los trofeos y las horas ausentes quedan en cero. No se exponen mensajes upstream ni credenciales.

Las horas se unen por nombre normalizado (NFKC, minúsculas y espacios externos). Las aplicaciones `media_app` se omiten del mapa. Para nombres duplicados se conserva la mayor duración disponible, sin sumarlas. Los registros retro sin historial siguen disponibles con cero horas. Se respetan los límites de horas de la aplicación.

Los textos del importador distinguen las horas de PSN disponibles del Gamerscore de Xbox sin tiempo. Las horas nuevas llegan a la confirmación y se guardan mediante el flujo existente; no se sustituyen retrospectivamente las horas de partidas ya importadas.

Referencia del SDK: [getUserPlayedGames](https://github.com/achievements-app/psn-api/blob/main/src/user/getUserPlayedGames.ts).

## Verificación

- `npm run check`: 68 pruebas unitarias aprobadas, lint, TypeScript y formato correctos.
- `npm run build`: aprobado.
- Prueba integral local del transporte SDK con PSN/Xbox simulados y Supabase real: aprobada. Previsualización PSN de 72,39 h, historial privado con fallback 0 h y guardado real de 72,39 h en una partida nueva. Los registros Xbox existentes conservaron horas, notas, estado y puntuación. Cuenta temporal eliminada; servidor detenido.
