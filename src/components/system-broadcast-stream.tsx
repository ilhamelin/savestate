import { SystemBroadcastBanner } from '@/components/system-broadcast-banner';
import { getActiveSystemBroadcast } from '@/services/system-state';

export async function SystemBroadcastStream({ initialDoubleXp = false }: { initialDoubleXp?: boolean }) {
  const broadcast = await getActiveSystemBroadcast().catch(() => null);
  return <SystemBroadcastBanner initial={broadcast} initialDoubleXp={initialDoubleXp} />;
}
