# SPEC-02: Steam onboarding y rangos por medallas

Implementación de research/antigravity: docs/specs/SPEC-02-steam-onboarding-and-achievement-system.md.

- Una biblioteca propia vacía muestra el acceso al importador existente y al catálogo. Un visitante recibe el mensaje neutro. El importador mantiene revisión y confirmación.
- El rango de medallas usa los umbrales 0, 1, 3, 5 y 7. El siguiente umbral desde cero es **1**, conforme al criterio de aceptación (el ejemplo de código del SPEC indicaba 2).
- Los conteos no finitos/negativos se normalizan a cero, los fraccionarios se redondean hacia abajo y el porcentaje se limita a 100. La galería cuenta solo medallas únicas presentes en el catálogo.
- El nivel por medallas es independiente de profiles.level/profiles.xp; no cambia títulos equipados, recompensas de XP ni las funciones SQL.
- La campana reutiliza su única suscripción Realtime a notifications. Los INSERT de badge_unlocked se validan por destinatario y se resuelven contra el catálogo de Supabase en lotes. Los avisos se deduplican por ID y se muestran en cola. El polling existente recupera nuevos avisos posteriores a la primera consulta, sin reproducir el historial al entrar.
- El toast usa un portal al body, región de estado no modal, cierre accesible y temporizador de 6 segundos. No reproduce audio automáticamente y respeta prefers-reduced-motion.
- No requiere dependencias, nuevas credenciales ni migraciones. Reutiliza la notificación SQL de la migración 009.
- Pruebas: fronteras de los cinco niveles, valores inválidos, normalización de notificaciones, destinatario, estados de biblioteca, progreso sin duplicados y ciclo de vida del toast.

## Parche de seguridad de la plataforma

La auditoría detectó que el lockfile base usaba Next.js 16.4.0. Se actualiza la dependencia existente a **16.4.1** (sin cambio de versión mayor) y se regenera el lockfile para corregir los avisos oficiales [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) y [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).
