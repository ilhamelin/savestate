# SaveState v2 — Entrega A: PWA y medallas

Implementada el 8 de octubre de 2026 sobre `implementation/chatgpt`, siguiendo `propuesta_savestate_v2.md` y las decisiones del usuario.

## Reglas de desbloqueo

| Medalla             | Condición                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| Primer Guardado     | Un juego en la biblioteca                                                    |
| Transmisor          | Un Momento Gamer, también privado o sin medios, conforme al pedido funcional |
| Compañero de Armas  | Una convocatoria publicada                                                   |
| Voz del Arcade      | Votos en cinco duelos distintos                                              |
| Guardián de los 90s | Cinco juegos con `release_year < 2000`                                       |
| Maestro del Rol     | Tres RPG/JRPG en `cleared` o `platinum`                                      |
| 100% Platino        | Cinco juegos en `platinum`, decisión explícita del usuario                   |

La migración `202610070009_badges.sql` evalúa actividad existente y añade triggers de biblioteca, publicaciones, convocatorias y votos. Cada medalla es permanente. La clave compuesta y `ON CONFLICT DO NOTHING` evitan duplicados; un bloqueo transaccional por jugador serializa evaluaciones simultáneas. El trigger de desbloqueo genera una sola notificación y conserva `badge_id` para mostrar su nombre y enlazar la vitrina.

`check_user_badges` permite evaluar únicamente al usuario autenticado. Las tablas de medallas permiten lectura pública y rechazan escrituras de clientes; las funciones privilegiadas usan `search_path` vacío y nombres de tablas cualificados. La vitrina es pública incluso con biblioteca privada, tal como exige el alcance: revela la medalla, sin exponer títulos ni publicaciones privadas. Las notificaciones siguen reservadas al destinatario.

La migración fue ejecutada exitosamente en Supabase según confirmación del usuario, y sus permisos, umbrales y notificaciones se probaron contra el proyecto real con datos temporales eliminados al terminar.

## Instalación y alcance de PWA

Next.js sirve `/manifest.webmanifest` con inicio y ámbito `/`, `display: standalone`, tema cyan `#00f0ff` y fondo `#08080c`. Iconos PNG originales de 192/512 px y Apple de 180 px se generan sin dependencias con `node scripts/generate-app-icons.mjs`. El layout incluye viewport con zona segura, metadatos Apple y permite zoom.

Tras publicar por HTTPS, la instalación se realiza desde el menú de instalación del navegador o la acción de añadir a la pantalla de inicio. La ventana independiente oculta los controles de navegación cuando el navegador/sistema admite ese modo; no cambia la navegación en una pestaña normal.

Esta entrega configura instalación y metadatos. El modo offline de biblioteca sugerido en la propuesta general queda fuera del pedido de Entrega A: no se añade Service Worker ni se cachean páginas personales, sesiones o HTML con nonce. Wrapped e importador Steam pertenecen a la siguiente entrega.

## Verificación

- `npm run check`: lint, tipos estrictos, 30 tests unitarios y formato.
- `npm run build`: compilación de producción, manifest estático y proxy nativo reconocidos.
- `TEST_BADGES_LIVE=1`: prueba optativa en `tests/integration/badges.test.ts`; verifica los siete umbrales, rechazo de autoasignación/identidades ajenas, lectura pública, notificaciones privadas, evaluación concurrente sin duplicados y permanencia.
- `TEST_APP_URL=http://localhost:3100`: `tests/integration/pwa.test.ts` comprueba manifest, dimensiones reales PNG, enlaces/metadatos Apple, viewport, zoom y CSP con nonce sobre la compilación de producción.
- Navegador: vitrina con dos medallas desbloqueadas y cinco bloqueadas; campanita con nombres y enlace al ancla de trofeos. Evidencia en `docs/evidence/v2-badges-desktop.png` y `v2-badge-notifications.png`.
- Pendiente: instalación física en Android/iPhone y validación en sus navegadores. El intento de viewport móvil del navegador de pruebas conservó 1280 px, por lo que no se usa como evidencia móvil.

Esta entrega no incluye un nuevo despliegue; las verificaciones HTTP se realizan localmente sobre el build de producción.
