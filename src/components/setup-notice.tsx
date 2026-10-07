import { isConfigured } from '@/lib/env';
export function SetupNotice() {
  return isConfigured() ? null : (
    <aside className="notice" role="status">
      <strong>Conexión pendiente.</strong> Configura Supabase e IGDB para explorar el catálogo y
      guardar tu progreso. Las instrucciones están en <code>docs/configuracion.md</code>.
    </aside>
  );
}
