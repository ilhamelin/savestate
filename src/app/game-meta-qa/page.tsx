import { Suspense } from 'react';
import { GameMetaView } from '@/components/game-meta-hub';
import type { GameMetaReport } from '@/domain/game-meta';
async function Panel({ kind }: { kind: string }) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const data: GameMetaReport = {
    duration: { mainStoryHours: 12, mainExtraHours: 20, completionistHours: 30 },
    proton: {
      tier: kind === 'silver' ? 'silver' : 'gold',
      score: 0.9,
      confidence: 'strong',
      totalReports: 123,
      steamDeckVerified: kind !== 'silver',
      protonUrl: 'https://www.protondb.com/app/620',
    },
    speedrun: {
      categoryName: 'Any%',
      timeFormatted: '1:24:12',
      runnerName: 'Community Runner',
      dateIso: '2026-10-20T00:00:00.000Z',
      videoUrl: kind === 'no-video' ? 'javascript:alert(1)' : 'https://youtu.be/HYsz1hP0BFo',
      speedrunUrl: 'https://www.speedrun.com/portal2',
    },
  };
  if (kind === 'empty') data.duration = data.proton = data.speedrun = null;
  if (kind === 'partial') {
    data.duration = null;
    data.speedrun = null;
  }
  return <GameMetaView title="Portal 2" data={data} />;
}
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const search = await searchParams;
  return (
    <>
      <h1>Game Meta QA</h1>
      <Suspense
        fallback={
          <section className="panel" role="status" aria-busy="true">
            Consultando metadatos…
          </section>
        }
      >
        <Panel kind={search.kind ?? 'full'} />
      </Suspense>
    </>
  );
}
