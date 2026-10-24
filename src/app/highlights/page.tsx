import { permanentRedirect } from 'next/navigation';
import { legacyTavernHref, type TavernPageProps } from '@/domain/tavern';
export default async function LegacyPage({searchParams}:TavernPageProps) {
  permanentRedirect(legacyTavernHref(await searchParams, 'momentos'));
}
