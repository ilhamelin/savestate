# Biblioteca: Vitrina y Tabla

Implementación de la fase 1 de `propuesta_stats_match_y_poweruser.md`, consultada desde `research/antigravity`. No requiere migraciones, dependencias ni peticiones externas adicionales.

- Selector Vitrina / Tabla, persistido como `grid` / `table` en `savestate_library_view_mode`. Renderizado inicial compatible con SSR; si Storage está bloqueado, el selector sigue funcionando durante la sesión.
- Tabla semántica con miniatura, título/año, plataformas registradas (catálogo como alternativa sin partidas), estado, suma de horas, progreso por partida/plataforma, puntuación personal y acciones expandibles. Reutiliza los formularios existentes y respeta bibliotecas públicas de solo lectura.
- Orden por horas descendentes, puntuación descendente, título A–Z, última actualización y progreso descendente. Para varias partidas, el progreso de ordenamiento es el mayor porcentaje disponible; las barras permanecen separadas por plataforma, sin mezclar Gamerscore y trofeos.
- Filtro 100% Platinados basado en al menos una partida con `current / total >= 1`. No depende del estado manual Platinum ni del porcentaje redondeado: 999/1000 no pasa el filtro. Los registros sin progreso permanecen al final del orden y no pasan el filtro.
- Se conservan la paginación de cinco títulos, filtros de plataforma/género y reinicio de página al cambiar criterios. Nota personal significa puntuación de 1 a 10; las notas de partidas se pueden consultar y editar desde Acciones.

## Verificación

- `npm run check`: 64 pruebas aprobadas; lint, TypeScript y Prettier correctos.
- `npm run build`: aprobado.
- Navegador local: selector Tabla persistente tras recarga, orden alfabético, filtro 100% excluyendo estado Platinum sin datos de progreso y apertura/cierre de acciones. Sin errores de consola.
- Pantalla de 375 px: contenedor de tabla de 320 px, contenido desplazable de 850 px. El desplazamiento de columnas queda dentro del contenedor.
- Evidencia: `docs/evidence/library-table.png`. Comprobación con biblioteca pública existente, sin modificar datos de usuarios.
