import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HoyoHub } from '@/components/hoyo-hub';
import { fetchHoyoNews } from '@/services/hoyo-news';
import { appUrl } from '@/lib/env';
import '../hoyo.css';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: 'HoYo Hub · Directos, Códigos y Noticias de Genshin & Star Rail',
  description:
    'Programas especiales oficiales, códigos de canje y noticias en español de Genshin Impact y Honkai: Star Rail.',
  openGraph: {
    title: 'HoYo Hub // SaveState',
    description: 'Directos y comunicaciones de Teyvat y el Expreso Astral.',
    images: ['/wallpapers/rift_genshin.jpg'],
  },
};
export default async function HoyoPage() {
  const [genshin, hsr] = await Promise.all([fetchHoyoNews('genshin'), fetchHoyoNews('hsr')]);
  return (
    <Suspense
      fallback={
        <div className="panel skeleton" aria-busy="true">
          Sintonizando HoYo Hub…
        </div>
      }
    >
      <HoyoHub initialNews={{ genshin, hsr }} />
    </Suspense>
  );
}
