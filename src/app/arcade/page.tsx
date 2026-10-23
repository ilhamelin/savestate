import { permanentRedirect } from 'next/navigation';
export default function ArcadePage() {
  permanentRedirect('/forum?tab=arcade');
}
