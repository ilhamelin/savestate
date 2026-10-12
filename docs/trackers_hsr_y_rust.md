# Trackers de Honkai: Star Rail y Rust

`/rift` ofrece cinco trackers: LoL, Valorant, Genshin, HSR y Rust. El radar de Steam, ofertas y Twitch permanece en `/games/[slug]`; ya no se muestra como pestaña del hub.

## Honkai: Star Rail

- Acepta UID de 9 o 10 dígitos y consulta el escaparate público en Enka.Network.
- Los diccionarios de personajes, conos y traducciones se descargan en paralelo y se cachean durante 24 horas. Cada descarga tiene un timeout de 6 segundos y fallback independiente.
- Nombres en español, con inglés como alternativa, retratos, Vía, Elemento, Eidolones, cono equipado y reliquias.
- PV/ATQ/DEF se calculan con la promoción y nivel del personaje, valores base del cono, multiplicadores y sumandos del equipo publicado. Si el cono no incluye `_flat.props`, se usa su promoción y nivel del diccionario.
- VEL y críticos se muestran en sus unidades correspondientes. Los cálculos no incluyen trazas, efectos de combate ni bonificaciones de conjuntos; la interfaz lo indica expresamente.
- Si falta el diccionario, el perfil sigue visible con nombres de fallback y estadísticas no disponibles, en lugar de inventar valores cero.

Fuente: [diccionarios oficiales de Enka](https://github.com/EnkaNetwork/API-docs/tree/master/store/hsr).

## Rust

- Acepta SteamID64, URL HTTPS de Steam Community o nombre personalizado.
- Reutiliza `STEAM_API_KEY` exclusivamente en servidor. Los destinos de la API son fijos; las URLs ingresadas nunca se consultan directamente.
- Resuelve primero el nombre personalizado y valida el ID devuelto antes de consultar el perfil.
- Perfil, horas, estadísticas y logros de AppID 252490 se consultan en paralelo con resultados independientes. El número de logros cuenta únicamente los desbloqueados.
- Las estadísticas privadas o ausentes no bloquean el perfil ni las horas disponibles. Los datos no disponibles se distinguen de cero.
- Combate, supervivencia y recursos son acumulados publicados por Steam, no métricas de un wipe o servidor concreto.
- Avatares y enlaces se validan contra orígenes oficiales; CSP permite los tres hosts de avatares admitidos.

Fuente: [Steamworks ISteamUserStats](https://partner.steamgames.com/doc/webapi/ISteamUserStats).

## Verificación

Los tests de dominio están en `src/domain/__tests__/hsr-rust.test.ts`, incluidos en `npm test` mediante `tests/unit/hsr-rust.test.ts`. Los tests de servicios verifican aislamiento de credenciales, resolución de vanity, errores parciales, metadatos ausentes y la clave Steam pendiente. No requieren cuentas de prueba ni cambios en Supabase.

No requiere migraciones SQL ni variables nuevas. El endpoint de inspección existente conserva la validación de sesión y origen, y cachea perfiles 60 segundos.
