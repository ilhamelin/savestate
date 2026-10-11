# Telemetría, chat privado y hub de trackers

- Las fichas cargan Steam, CheapShark y Twitch mediante Suspense, con caché de cinco minutos y fallos independientes. Steam compara títulos normalizados sin puntuación, aceptando también nombres que se contienen entre sí. CheapShark admite búsquedas amplias si falta el App ID; Twitch usa búsqueda de categorías cuando no encuentra el nombre exacto. Los espectadores corresponden al Top 4, no al total global.
- `/rift` conserva League of Legends y sus enlaces directos. Valorant verifica la cuenta y el shard, sin inventar rangos; Genshin muestra el escaparate público de Enka. Un shard no disponible se muestra explícitamente. Datos cacheados un minuto.
- Ejecutar íntegramente `supabase/migrations/202610110026_friend_direct_messages.sql` en Supabase. 025 ya corresponde a la apariencia del perfil.
- El chat usa RLS para historial/envíos y un canal Broadcast **privado** autorizado para los dos amigos. Broadcast solo transmite un ID como aviso: el destinatario vuelve a consultar contenido e identidad desde la API protegida. También escucha inserciones y refresca cada 10 segundos si hay un fallo de conexión.
- Sin migración, GET devuelve un historial vacío con `persisted: false`; los envíos se bloquean con un aviso. No se implementa el fallback efímero público de la propuesta, pues carecería de las políticas necesarias para garantizar privacidad y entrega.
- Los últimos 50 mensajes se seleccionan en orden descendente y se invierten para presentación cronológica. Solo los amigos aceptados pueden abrir o enviar el chat. Los timestamps/UUIDs se generan en la base de datos.
- No se necesitan variables adicionales: se reutilizan Twitch y Riot. CheapShark, Steam players y Enka son consultas públicas de servidor.

## Builds de Enka y Radar accesible

- `/rift` incluye una cuarta pestaña con búsqueda por título y accesos rápidos. `POST /api/tracker/radar` requiere sesión y mismo origen; valida títulos de 2 a 100 caracteres y reutiliza la telemetría cacheada de las fichas.
- El diccionario oficial de personajes y las traducciones de Enka se descargan en paralelo, con caché diaria y fallback seguro. Solo se devuelven al cliente nombres e imágenes validados y los datos normalizados de la build.
- Se muestran seis métricas de cuenta, nombres en español con respaldo inglés, rareza, constelaciones, amistad, talentos, estadísticas, arma y hasta cinco artefactos. Los personajes con builds ocultas conservan su identidad y señalan que la build no está publicada.
- Los retratos y equipos solo admiten nombres de archivo `UI_*` bajo `https://enka.network/ui/`; la CSP permite ese origen de imágenes. Los personajes del Viajero se resuelven según su `skillDepotId`.
