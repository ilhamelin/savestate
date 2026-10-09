# Widget de amigos y solicitudes

Implementado el 9 de octubre de 2026 en `implementation/chatgpt`, siguiendo
`research/antigravity:docs/propuesta_widget_amigos_y_solicitudes_steam.md`.

- Migración 020 versiona la lectura pública de amistades aceptadas y la RPC
  `get_player_friends`. Las solicitudes pendientes/rechazadas permanecen privadas.
- La RPC usa `security invoker`, en lugar del `security definer` propuesto, para
  respetar el RLS de las bibliotecas: un visitante sin acceso no recibe el título
  que juega un amigo con biblioteca privada. Sigue viendo su estado público de terminal.
- El repositorio pagina amigos y solicitudes, y obtiene perfiles de solicitudes
  en lotes; no consulta una vez por cada amigo. Las solicitudes se cargan únicamente
  para el perfil propio y usan la identidad autenticada, sin aceptar un propietario externo.
- El widget muestra avatar de 36 px, estado, nivel circular y enlaces al perfil.
  Usa la API social existente para aceptar/rechazar/cancelar y refresca los contadores.
- El estado «Jugando» representa el último juego marcado como `playing`, no presencia
  en línea ni una sesión de Steam en tiempo real.
- No se incorporaron dependencias. Si falta la RPC, se muestra un aviso sin bloquear
  el resto del perfil.

## Verificación

- `npm run check`: código 0; lint, TypeScript, 68 pruebas unitarias y formato.
- `npm run build`: código 0; Next.js 16.4.0, un worker.
- Prueba optativa `tests/integration/player-friends.test.ts`: pasó contra Supabase
  real tras la confirmación de la migración. Valida anonimato, bibliotecas privadas,
  acceso de amigos, rechazo de respuestas ajenas, aceptación, rechazo y cancelación.
  Las tres cuentas temporales se eliminan en `finally`.
- Navegador sobre build local: lista con juego activo, pestañas de solicitudes,
  aceptación y cancelación verificadas desde interfaz hasta API/Supabase y refresco.
  Sin errores de consola en el build de producción local.
- A 375 px, el widget mide 320 px y su `scrollWidth` coincide con `clientWidth` (318 px),
  sin desbordamiento interno. Se restauró el tamaño del navegador.
- Evidencia: `docs/evidence/player-friends-widget.png`, con cuentas de prueba.
  Las cuatro cuentas de la prueba visual fueron eliminadas y la sesión cerrada.
- El modo desarrollo produjo recargas continuas durante la comprobación; se detuvo
  y la verificación visual se completó con `next start` sobre el build local.

Para repetir la prueba de permisos desde PowerShell, con credenciales en `.env.local`:

```powershell
$env:TEST_PLAYER_FRIENDS_LIVE='1'
node --env-file=.env.local --experimental-strip-types --test tests/integration/player-friends.test.ts
```

No se desplegó esta entrega a producción.
