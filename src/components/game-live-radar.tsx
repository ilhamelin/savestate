import { fetchGameLiveTelemetry } from '@/services/game-live-telemetry';
import { GameLiveTelemetryView } from '@/components/game-live-telemetry-view';

export async function GameLiveRadar({ title }: { title: string }) {
  let data;
  try {
    data = await fetchGameLiveTelemetry(title);
  } catch {
    return null;
  }

  if (
    !data ||
    (data.steamCurrentPlayers === null && !data.deals?.length && !data.twitchStreams?.length)
  ) {
    return null;
  }

  return <GameLiveTelemetryView title={title} data={data} />;
}
