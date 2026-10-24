'use client';
import Link from 'next/link';
import { dependencyIncident, type DependencyServiceId } from '@/domain/dependency-monitor';
import { useDependencyHealth } from '@/lib/dependency-health-client';
export function DependencyAlertBanner({ service }: { service?: DependencyServiceId }) {
  const report = useDependencyHealth();
  const incident = dependencyIncident(report, service);
  if (!incident) return null;
  return <aside className="system-alert-strip dependency-alert" role="status">
    <span>⚠ <strong>{incident.name}:</strong> {incident.status === 'maintenance'
      ? 'Disponibilidad aún no comprobada.'
      : incident.status === 'degraded' ? 'Respuesta más lenta de lo habitual.'
      : 'La última sonda no pudo confirmar el servicio. Las funciones que dependen de él pueden fallar temporalmente.'}</span>
    <Link href="/status">Ver estado →</Link>
  </aside>;
}
