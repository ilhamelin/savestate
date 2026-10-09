# Logros de Steam bajo demanda

La biblioteca permite sincronizar y actualizar los logros de partidas `PC / Steam` con marcador inicial `[Steam lifetime:APPID]`. Cada clic consulta un solo juego; la sincronización rápida de horas y su cuota diaria no cambian.

La cuenta se obtiene del perfil autenticado. La acción comprueba la propiedad de la partida, valida Steam ID y AppID, y guarda únicamente `console_progress`. Conserva horas, nota, fechas y estado del juego. Si cambian plataforma o nota mientras responde Steam, rechaza el guardado. No concede XP ni crea partidas.

La barra compartida muestra `Logros · Steam`, `X / Y logros (Z%)` y `PC / Steam`. Los juegos sin estadísticas disponibles muestran un aviso y conservan cualquier progreso anterior; los errores de red o servidor permiten reintentar.

Referencia: [GetPlayerAchievements, documentación oficial de Valve](https://partner.steamgames.com/doc/webapi/isteamuserstats?l=english#GetPlayerAchievements). La clave queda exclusivamente en el servidor; peticiones sin caché y timeout de 6 segundos.

## Verificación

- `npm run check`: 63 pruebas unitarias, lint, TypeScript y formato aprobados.
- `npm run build`: aprobado.
- Prueba integral local repetida tras aplicar la migración 019: aprobada, código de salida 0 (11,5 segundos). Supabase real aceptó y persistió `{ kind: 'achievements', current: 2, total: 3 }`. Steam respondió mediante una fixture controlada; esta prueba verifica el guardado y no la disponibilidad de la API externa.
- Dos sincronizaciones conservaron una única partida, 42,25 horas, nota y fecha de inicio. Peticiones sin sesión y a partidas ajenas devolvieron 401 y 404. Estadísticas ausentes y errores de Steam conservaron el progreso previo; una plataforma incompatible devolvió 400.
- Cuentas temporales eliminadas; servidor detenido. No se realizó despliegue.

Para repetir la prueba, iniciar el build local con `TEST_STEAM_ACHIEVEMENTS_MOCK=1` y el preload `tests/integration/steam-achievements.mock.mjs`; ejecutar `tests/integration/steam-achievements.test.ts` con `TEST_STEAM_ACHIEVEMENTS_LIVE=1`, `TEST_STEAM_ACHIEVEMENTS_MOCK=1` y `TEST_APP_URL=http://localhost:3000`. La fixture nunca se importa desde el código de aplicación ni se activa en producción.
