# Player Level, XP y cosméticos

Referencia: `docs/propuesta_sistema_niveles_y_recompensas.md`. Migración: `supabase/migrations/202610090017_player_levels.sql`, cuya ejecución fue confirmada por el usuario.

## Alcance y decisiones

- Entrega de las fuentes de XP solicitadas: Cleared 150 y Platinum 300, cada una una vez por juego; sesiones con aumento de horas 10; reseñas de al menos 100 caracteres 75 una vez por juego; momentos 40 hasta tres premios diarios; primera conexión y sincronización exitosa Steam/PSN/Xbox 200 por proveedor.
- El cooldown de sesiones es de 30 minutos por juego y se aplica incluso entre distintas partidas. Cambiar solo la nota o registrar cero horas no da XP. Las horas históricas importadas no se tratan como sesiones manuales.
- Los cambios de cuenta y la desvinculación no reinician el premio de conexión. Guardar un ID sin comprobar el proveedor no otorga XP; Steam exige el ticket firmado y las consolas una consulta exitosa.
- Los premios empiezan con las acciones posteriores a la entrega; no se ejecuta un backfill de toda la actividad histórica. Cada premio Cleared/Platinum es independiente; obtener ambos otorga 450 XP en total.
- Se implementan títulos y marcos del catálogo hasta nivel 50. Los niveles pueden continuar después del 50. Esta entrega no incorpora las otras fuentes de XP ni los nuevos temas de habitación mencionados como ampliaciones en la propuesta general.
- Curva aprobada: `floor((xp / 100) ** (1 / 1.65)) + 1`; umbrales enteros con `ceil(100 * (level - 1) ** 1.65)`. Se usa la fórmula y no las estimaciones numéricas inconsistentes del documento. Nivel 3: 314 XP; nivel 50: 61.493 XP.

## Seguridad y persistencia

El RPC solo es ejecutable por `service_role`, con comprobación explícita del rol, cantidades fijas por acción y referencia obligatoria. El servicio privilegiado se limita a ese RPC y recibe la identidad desde los servicios autenticados; no existe un endpoint público para otorgarse XP.

La fila de perfil se bloquea antes de comprobar duplicados, cooldown y cuota diaria UTC. Evento, XP y nivel se confirman juntos. `user_xp_events` tiene RLS: solo su dueño puede leer su historial; clientes no pueden insertarlo ni modificarlo. Los grants no permiten actualizar XP/nivel.

Los servicios guardan primero la acción y después invocan el RPC idempotente. Son transacciones separadas: un fallo de red al otorgar XP no revierte automáticamente la acción guardada; los errores se informan y los premios repetidos se deduplican. No se simula atomicidad entre ambas operaciones.

Cosméticos: validación de catálogo y nivel real en el servicio, más trigger de base de datos para impedir equipar recompensas bloqueadas mediante acceso directo a Supabase. Los valores recibidos de XP/nivel en el formulario no se usan para autorizar cosméticos.

## Interfaz

Perfil y vista previa comparten `ProfileIdentity`: marco, nivel, título equipado y HUD con progreso dentro del nivel y próxima recompensa. Modal nativo accesible con 50 niveles, estados bloqueados y nivel actual. Profile Studio incluye selectores de títulos/marcos desbloqueados, vista previa inmediata y guardado/descartado mediante el dock existente. Los efectos respetan movimiento reducido.

## Verificación

- `npm run check`: salida 0, 58 pruebas, ESLint, TypeScript y Prettier.
- `npm run build`: salida 0. En la comprobación final se usó `CIRCLE_NODE_TOTAL=2` únicamente en el proceso local para compilar con un trabajador, después de que ejecutar check/build en paralelo agotara la memoria del equipo. No se modifica la configuración de producción.
- Prueba integral con Supabase y sesiones reales: permisos de XP, RLS del historial, ocho premios concurrentes con un único evento, estados sin duplicación, reseñas mínimas, límite diario concurrente de momentos, premios únicos por proveedor, cooldown y cosméticos válidos/bloqueados. Cuentas temporales eliminadas.
- Navegador: HUD, camino de 50 niveles, apertura/cierre del modal, opciones limitadas al nivel, previsualización, dock y guardado de título/marco. Perfil temporal de nivel 15 preparado por el administrador exclusivamente para QA; los usuarios no pueden modificar su nivel de esta manera.
- Evidencia: `docs/evidence/player-level-profile.png` y `docs/evidence/player-rewards-road.png`.
- La prueba integral final pasó en 15.99 segundos e incluyó `leveled_up`. Modal centrado y cierre con Escape verificados. Cuentas, scripts y servidor de QA eliminados.
