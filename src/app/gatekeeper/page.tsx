import { GatekeeperForm } from '@/components/guardian/gatekeeper-form';
export const metadata = { title: 'Checkpoint de acceso', robots: { index: false, follow: false } };
export default function GatekeeperPage() {
  return <GatekeeperForm />;
}
