import Link from 'next/link';
import { DependencyStatusDashboard } from '@/components/dependency-status-dashboard';
import { getSystemHealthReport } from '@/services/dependency-monitor-service';
export const metadata = { title: 'System Status & Dependencias' };
export const dynamic = 'force-dynamic';
export default async function StatusPage() {
  const health = await getSystemHealthReport(false);
  return (
    <div className="container dependency-status-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SAVESTATE // SYSTEM STATUS</p>
          <h1>Estado de SaveState y sus dependencias.</h1>
          <p>Consulta la última lectura de los servicios externos.</p>
        </div>
        <Link className="button outline small" href="/">
          ← Volver a SaveState
        </Link>
      </div>
      <DependencyStatusDashboard initial={health} />
    </div>
  );
}
