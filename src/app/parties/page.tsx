import { permanentRedirect } from 'next/navigation';
export default function PartiesPage() {
  permanentRedirect('/forum?tab=arcade');
}
