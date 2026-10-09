'use client';
import { useId, useState } from 'react';
import { SteamImporter } from '@/components/steam-importer';
import { ConsoleImporter } from '@/components/console-importer';
export function ImportHub({
  steamConfigured,
  psnId,
  xboxGamertag,
}: {
  steamConfigured: boolean;
  psnId: string | null;
  xboxGamertag: string | null;
}) {
  const [tab, setTab] = useState('Steam');
  const id = useId();
  const labels = { Steam: 'Steam', PlayStation: 'PlayStation (PSN)', Xbox: 'Xbox' };
  return (
    <>
      <div className="filter-buttons" aria-label="Plataforma de importación">
        {Object.entries(labels).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            aria-controls={`${id}-${value}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id={`${id}-Steam`} hidden={tab !== 'Steam'}>
        <SteamImporter configured={steamConfigured} />
      </div>
      <div id={`${id}-PlayStation`} hidden={tab !== 'PlayStation'}>
        <ConsoleImporter source="PlayStation" initialIdentity={psnId} />
      </div>
      <div id={`${id}-Xbox`} hidden={tab !== 'Xbox'}>
        <ConsoleImporter source="Xbox" initialIdentity={xboxGamertag} />
      </div>
    </>
  );
}
