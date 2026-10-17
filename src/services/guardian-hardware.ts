import 'server-only';
import {
  hardwareCpuPercent,
  parseSupabaseHardware,
  type HardwareSample,
} from '@/domain/guardian-hardware';

interface DatabaseHardware {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  diskTotalBytes: number | null;
  diskUsedBytes: number | null;
  measuredAt: string | null;
}
const unavailable: DatabaseHardware = {
  cpuPercent: null,
  ramPercent: null,
  diskPercent: null,
  diskTotalBytes: null,
  diskUsedBytes: null,
  measuredAt: null,
};
let cached = unavailable;
let expires = 0;
let previous: HardwareSample | null = null;
let pending: Promise<DatabaseHardware> | null = null;

// Supabase refreshes these metrics once per minute. Cache failures too and share in-flight reads.
export async function fetchGuardianDatabaseHardware(): Promise<DatabaseHardware> {
  if (Date.now() < expires) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
      if (!key || url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co'))
        return unavailable;
      url.pathname = '/customer/v1/privileged/metrics';
      url.search = '';
      url.hash = '';
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`service_role:${key}`).toString('base64')}`,
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error('Metrics unavailable');
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('Metrics too large');
      const sample = parseSupabaseHardware(text);
      const cpuPercent = hardwareCpuPercent(previous, sample);
      previous = sample;
      return {
        cpuPercent,
        ramPercent: sample.ramPercent,
        diskPercent: sample.diskPercent,
        diskTotalBytes: sample.diskTotalBytes,
        diskUsedBytes: sample.diskUsedBytes,
        measuredAt: new Date().toISOString(),
      };
    } catch {
      previous = null;
      return unavailable;
    }
  })();
  try {
    cached = await pending;
    expires = Date.now() + 60000;
    return cached;
  } finally {
    pending = null;
  }
}
