# Telemetría, chat privado y hub de trackers

- Las fichas cargan Steam, CheapShark y Twitch mediante Suspense, con caché de cinco minutos y fallos independientes. Steam solo se vincula con una coincidencia exacta normalizada para evitar mostrar precios de otro juego. Los espectadores corresponden al Top 4, no al total global.
- `/rift` conserva League of Legends y sus enlaces directos. Valorant verifica la cuenta y el shard, sin inventar rangos; Genshin muestra el escaparate público de Enka. Un shard no disponible se muestra explícitamente. Datos cacheados un minuto.
- Ejecutar íntegramente `supabase/migrations/202610110026_friend_direct_messages.sql` en Supabase. 025 ya corresponde a la apariencia del perfil.
- El chat usa RLS para historial/envíos y un canal Broadcast **privado** autorizado para los dos amigos. Broadcast solo transmite un ID como aviso: el destinatario vuelve a consultar contenido e identidad desde la API protegida. También escucha inserciones y refresca cada 10 segundos si hay un fallo de conexión.
- Sin migración, GET devuelve un historial vacío con `persisted: false`; los envíos se bloquean con un aviso. No se implementa el fallback efímero público de la propuesta, pues carecería de las políticas necesarias para garantizar privacidad y entrega.
- Los últimos 50 mensajes se seleccionan en orden descendente y se invierten para presentación cronológica. Solo los amigos aceptados pueden abrir o enviar el chat. Los timestamps/UUIDs se generan en la base de datos.
- No se necesitan variables adicionales: se reutilizan Twitch y Riot. CheapShark, Steam players y Enka son consultas públicas de servidor.
