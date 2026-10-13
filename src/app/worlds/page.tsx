import { WorldsHub } from '@/components/worlds-hub';
import { fetchWorldsSchedule } from '@/services/worlds-esports';
export const metadata = {
  title: 'Worlds 2026 · Calendario y directos',
  description:
    'Sigue el Mundial de League of Legends: calendario, directos oficiales y detalle de cada serie.',
};
export default async function WorldsPage() {
  return <WorldsHub initial={await fetchWorldsSchedule()} />;
}
