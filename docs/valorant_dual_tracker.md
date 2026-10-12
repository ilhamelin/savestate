# Perfil dual de Valorant

`HENRIK_API_KEY` es opcional y exclusiva del servidor. Se documenta en `.env.example`; no se agrega ninguna clave predeterminada. Configurar en `.env.local` y en Production de Vercel para habilitar cuenta, MMR e historial de HenrikDev.

- Se reutiliza `RIOT_API_KEY` para identidad, shard permitido, perfil cruzado LoL/TFT y clasificación regional. Los permisos de cada endpoint dependen de la clave; los fallos de enriquecimiento no invalidan una identidad encontrada.
- Los endpoints de Henrik se consultan en paralelo y admiten fallos parciales. La identidad se cruza por PUUID y Riot ID; las partidas nunca se emparejan únicamente por nombre sin comprobar el tag.
- El nivel de LoL y el rango de TFT se muestran en un bloque separado. Nunca se presentan como nivel o rango individual de Valorant.
- La clasificación regional recoge los primeros diez puestos y muestra cinco. Que el jugador no figure entre esos diez no permite afirmar que esté sin clasificar. Un rango o una posición solo se muestran si el proveedor los confirma.
- RR se conserva tal como lo devuelve el proveedor: en rangos altos puede superar 100. No se recorta una cifra real para simular una escala de 0 a 100.
- El banner del fallback es arte decorativo del catálogo de `valorant-api.com`, identificado así en la interfaz, y no se atribuye a la tarjeta equipada del jugador.
- Las imágenes se restringen a `media.valorant-api.com`, `cdn.henrikdev.xyz` y DataDragon. Los hosts regionales de Riot se construyen exclusivamente con valores permitidos, nunca a partir de un shard arbitrario recibido del proveedor.

Verificación: pruebas de mapeo y servicios en `tests/unit/valorant-*.test.ts`, incluyendo modo Henrik, modo Riot, fallos parciales, resultados desconocidos, aislamiento de credenciales y shards inválidos. La prueba real local de Riot devolvió 401; requiere revisar la clave local para completar la validación con datos reales. Henrik permanece pendiente de configuración.
