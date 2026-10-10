# Savestate Comms

Chat de voz para usuarios autenticados en `/community/voice`. Los canales oficiales son `ch-lobby` (16 participantes), `ch-squad` (6) y `ch-chill` (10). No requiere migraciones SQL.

## Configuración

Configurar `LIVEKIT_URL` con la URL WebSocket del proyecto LiveKit, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` en el servidor. `NEXT_PUBLIC_LIVEKIT_URL` puede contener la misma URL pública; las credenciales nunca llevan el prefijo `NEXT_PUBLIC_`. En Vercel, las claves deben ser Secret de Production. Volver a desplegar después de cambios en variables.

`POST /api/voice/token` exige sesión Supabase, JSON limitado a 1 KB y origen de la aplicación. Solo admite los canales oficiales y configura la capacidad en LiveKit antes de emitir un JWT de 15 minutos. Usa el UUID autenticado como identidad estable y el username como nombre visible; ignora identidades suministradas por el cliente. Solo permite publicar el micrófono, recibir audio y publicar datos, sin permisos de administración, cámara ni pantalla.

## Uso y ciclo de vida

- Sintonizar inicia la escucha con el micrófono silenciado. Activarlo solicita permiso al navegador.
- El contexto del layout raíz conserva la sala y el audio al navegar dentro de la aplicación. Recargar o cerrar la pestaña finaliza la llamada.
- El dock ofrece micrófono, ensordecimiento y desconexión. Ensordecer también silencia la transmisión, conservando la preferencia previa de mute.
- Push-to-talk usa Espacio fuera de controles editables y modales, o el botón mantenido en la página para móvil. Soltar la tecla, perder foco o ocultar la pestaña silencia la transmisión.
- Desconectar, cancelar una conexión o cerrar sesión detiene los tracks y descarta respuestas de conexiones antiguas. No se graban llamadas.
- Si el navegador bloquea la reproducción automática, usar «Activar audio» en el dock.

La CSP permite el origen LiveKit configurado y los servidores regionales de LiveKit Cloud. `Permissions-Policy` permite micrófono solo al mismo origen en toda la aplicación, necesario para llamadas persistentes después de navegar, y sigue bloqueando cámara y geolocalización.

## Verificación

`npm run check` comprueba tipos, formato, lint y pruebas de canales, señalización, permisos del token, autenticación, capacidad y decisiones de mute/deafen/PTT. Para comprobar audio real, conectar dos cuentas en navegadores distintos, autorizar sus micrófonos y comprobar transmisión, ensordecimiento, navegación, push-to-talk y desconexión. Los tests automatizados no sustituyen esta prueba con dispositivos de audio reales.
