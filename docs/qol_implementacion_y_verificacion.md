# QoL y sinergia comunitaria: implementación

Referencia conservada: `docs/propuesta_mejoras_qol_y_sinergia.md`, tomada de `research/antigravity`. No requiere migraciones ni dependencias nuevas.

- La ficha del juego consulta en paralelo los cinco hilos recientes y hasta seis momentos con capturas o video. Reutiliza RLS y URLs firmadas de Storage de cinco minutos, incluyendo renovación si expiran. Los momentos sin medios no ocupan esta cuadrícula.
- El enlace de debate abre el editor en Actualidad y Debate con el juego seleccionado. La vuelta desde el login conserva el juego. La selección se valida mediante UUID y consulta del catálogo.
- El Header conserva CRT ON/OFF y ofrece un selector de cuatro paletas. Aplica `data-crt-theme` al elemento raíz, con acento y resplandor globales. La selección persiste en `savestate.crt.palette.v1`, se sincroniza entre pestañas y usa Cyan ante valores inválidos. Si Storage falla, sigue funcionando en memoria. Los colores personalizados del perfil conservan su ámbito local.
- La ruleta amplía el selector existente y conserva sus filtros de plataforma/género. Baraja durante 1,5 segundos, anuncia únicamente el estado y resultado, cancela temporizadores al desmontar y termina inmediatamente con movimiento reducido (también si cambia durante el giro). No modifica datos. Trabaja sobre los juegos cargados; continúa vigente el aviso de 500 juegos visibles.
- La tarjeta de ruleta desactiva prefetch para evitar peticiones de fichas durante el barajado.
- El total de horas consulta todos los `play_logs` del usuario mediante join con `user_games`, RLS y páginas de 1000 registros. Incluye horas históricas de Steam, usa centésimas para sumar y presenta un decimal. No depende del límite visual de 500 juegos ni del límite de 1000 filas de una respuesta de Supabase.

## Verificación

- `npm run check`: lint, tipos, 37 pruebas unitarias y formato.
- `npm run build`: compilación de producción con Next.js 16.4.0 y proxy nativo.
- Prueba real optativa: `TEST_QOL_LIVE=1`, `TEST_APP_URL=http://localhost:3000`, ejecutar `tests/integration/qol.test.ts` con `.env.local` y un servidor local de producción. Crea un usuario temporal y 1001 partidas que suman 100,1 horas; comprueba que no se trunquen, el aislamiento de momentos privados/de otros juegos, video seguro, editor preseleccionado y retorno desde login. Elimina sus datos al terminar.
- Navegador: paletas verde, ámbar y DMG; persistencia tras recarga; ruleta con dos juegos; total de 12,5 horas; selector móvil a 375 px sin desbordamiento horizontal; consola sin errores. Usuario temporal de interfaz eliminado.
- Evidencias: `docs/evidence/qol-backlog.png` y `docs/evidence/qol-crt-mobile.png`.

No se publica este paquete hasta solicitar el despliegue de producción.
