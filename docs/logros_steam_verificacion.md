# Logros de Steam bajo demanda

La biblioteca permite sincronizar y actualizar los logros de partidas `PC / Steam` con marcador inicial `[Steam lifetime:APPID]`. Cada clic consulta un solo juego; la sincronización rápida de horas y su cuota diaria no cambian.

La cuenta se obtiene del perfil autenticado. La acción comprueba la propiedad de la partida, valida Steam ID y AppID, y guarda únicamente `console_progress`. Conserva horas, nota, fechas y estado del juego. Si cambian plataforma o nota mientras responde Steam, rechaza el guardado. No concede XP ni crea partidas.

La barra compartida muestra `Logros · Steam`, `X / Y logros (Z%)` y `PC / Steam`. Los juegos sin estadísticas disponibles muestran un aviso y conservan cualquier progreso anterior; los errores de red o servidor permiten reintentar.

Referencia: [GetPlayerAchievements, documentación oficial de Valve](https://partner.steamgames.com/doc/webapi/isteamuserstats?l=english#GetPlayerAchievements). La clave queda exclusivamente en el servidor; peticiones sin caché y timeout de 6 segundos.

## Verificación

- `npm run check`: 63 pruebas unitarias, lint, TypeScript y formato aprobados.
- `npm run build`: aprobado.
- Prueba integral local con Supabase real y respuestas controladas de Steam: autenticación y propiedad verificadas; la persistencia quedó bloqueada por `play_logs_console_progress_check`, error 23514. El proyecto configurado aún rechaza `achievements`. Se solicitó aplicar el archivo versionado `supabase/migrations/202610090019_steam_achievements_progress.sql`.
- Cuentas temporales eliminadas; servidor detenido. No se realizó despliegue.

Para repetir la prueba, iniciar el build local con `TEST_STEAM_ACHIEVEMENTS_MOCK=1` y el preload `tests/integration/steam-achievements.mock.mjs`; ejecutar `tests/integration/steam-achievements.test.ts` con `TEST_STEAM_ACHIEVEMENTS_LIVE=1`, `TEST_STEAM_ACHIEVEMENTS_MOCK=1` y `TEST_APP_URL=http://localhost:3000`. La fixture nunca se importa desde el código de aplicación ni se activa en producción.
