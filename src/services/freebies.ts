import 'server-only';
import { normalizeFreebies, type FreebieItem } from '@/domain/freebies';
export type { FreebieItem } from '@/domain/freebies';

export async function getActiveFreebies(limit = 24): Promise<FreebieItem[]> {
  try {
    const response = await fetch('https://www.gamerpower.com/api/giveaways?type=game', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'SaveState-Journal/1.0' },
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok || response.status === 201) return [];
    const reader = response.body?.getReader();
    if (!reader) return [];
    const decoder = new TextDecoder();
    let bytes = 0,
      output = '';
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 1000000) {
          await reader.cancel();
          return [];
        }
        output += decoder.decode(part.value, { stream: true });
      }
      return normalizeFreebies(JSON.parse(output + decoder.decode()), limit);
    } finally {
      reader.releaseLock();
    }
  } catch {
    return [];
  }
}
