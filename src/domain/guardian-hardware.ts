export function formatVercelRegion(code?: string): { flag: string; label: string } {
  const regions: Record<string, [string, string]> = {
    iad1: ['🇺🇸', 'East US (iad1 - Virginia)'],
    sfo1: ['🇺🇸', 'West US (sfo1 - California)'],
    gru1: ['🇧🇷', 'South America (gru1 - São Paulo)'],
    scl1: ['🇨🇱', 'South America (scl1 - Santiago)'],
    cdg1: ['🇫🇷', 'Europe (cdg1 - Paris)'],
    lhr1: ['🇬🇧', 'Europe (lhr1 - London)'],
    hnd1: ['🇯🇵', 'Asia (hnd1 - Tokyo)'],
  };
  const region = regions[code?.toLowerCase() ?? ''];
  return region
    ? { flag: region[0], label: region[1] }
    : { flag: '🌐', label: code ? `Edge (${code})` : 'Local Dev Node' };
}

export function hardwareNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function hardwarePercent(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0 || used < 0 || used > total) return null;
  return Math.round((used / total) * 1000) / 10;
}

export interface HardwareSample {
  cpu: Record<string, number>;
  ramPercent: number | null;
  diskPercent: number | null;
  diskTotalBytes: number | null;
  diskUsedBytes: number | null;
}

// Only retain the few node-exporter metrics needed by the HUD, never raw labels/payloads.
export function parseSupabaseHardware(text: string): HardwareSample {
  const cpu: Record<string, number> = {};
  const gauges: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const match = /^(node_[a-zA-Z_]+)(\{[^}]*\})?\s+([\d.eE+-]+)(?:\s|$)/.exec(line);
    if (!match) continue;
    const [, name, labels = '', raw] = match;
    if (!name) continue;
    const value = hardwareNumber(Number(raw));
    if (value === null || !/service_type="db"/.test(labels)) continue;
    if (name === 'node_cpu_seconds_total') {
      const core = /\bcpu="(\d+)"/.exec(labels)?.[1];
      const mode = /\bmode="([a-z]+)"/.exec(labels)?.[1];
      // guest counters are already included in user/nice.
      if (core && mode && !mode.startsWith('guest')) cpu[`${core}:${mode}`] = value;
    } else if (name.startsWith('node_memory_') || /mountpoint="\/data"/.test(labels)) {
      gauges[name] = value;
    }
  }
  const total = gauges.node_memory_MemTotal_bytes ?? null;
  const available = gauges.node_memory_MemAvailable_bytes ?? null;
  const diskTotal = gauges.node_filesystem_size_bytes ?? null;
  const diskAvailable = gauges.node_filesystem_avail_bytes ?? null;
  const diskUsed = diskTotal !== null && diskAvailable !== null ? diskTotal - diskAvailable : null;
  return {
    cpu,
    ramPercent: hardwarePercent(
      total !== null && available !== null ? total - available : null,
      total,
    ),
    diskPercent: hardwarePercent(diskUsed, diskTotal),
    diskTotalBytes: diskTotal,
    diskUsedBytes: hardwareNumber(diskUsed),
  };
}

export function hardwareCpuPercent(
  previous: HardwareSample | null,
  current: HardwareSample,
): number | null {
  if (!previous) return null;
  const keys = Object.keys(current.cpu);
  if (!keys.length || keys.length !== Object.keys(previous.cpu).length) return null;
  if (keys.some((key) => current.cpu[`${key.split(':')[0]}:idle`] === undefined)) return null;
  let total = 0,
    idle = 0;
  for (const key of keys) {
    const before = previous.cpu[key];
    const after = current.cpu[key];
    if (before === undefined || after === undefined) return null;
    const delta = after - before;
    if (delta < 0) return null;
    total += delta;
    if (key.endsWith(':idle')) idle += delta;
  }
  return hardwarePercent(total - idle, total);
}
