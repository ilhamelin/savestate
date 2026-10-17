import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatVercelRegion,
  hardwareNumber,
  hardwarePercent,
  parseSupabaseHardware,
  hardwareCpuPercent,
} from '../../src/domain/guardian-hardware.ts';

test('Guardian hardware validates gauges and maps actual Vercel regions without fake defaults', () => {
  assert.equal(formatVercelRegion('SCL1').flag, '🇨🇱');
  assert.match(formatVercelRegion('iad1').label, /Virginia/);
  assert.equal(formatVercelRegion().label, 'Local Dev Node');
  assert.equal(formatVercelRegion('abc').label, 'Edge (abc)');
  for (const value of [undefined, null, '4', NaN, Infinity, -1])
    assert.equal(hardwareNumber(value), null);
  assert.equal(hardwareNumber(0), 0);
  assert.equal(hardwarePercent(63, 100), 63);
  for (const [used, total] of [
    [null, 100],
    [1, 0],
    [200, 100],
    [-1, 100],
  ] as const)
    assert.equal(hardwarePercent(used, total), null);
});

const sample = (idle: number, user: number) =>
  parseSupabaseHardware(`
node_cpu_seconds_total{service_type="db",cpu="0",mode="idle"} ${idle}
node_cpu_seconds_total{service_type="db",cpu="0",mode="user"} ${user}
node_cpu_seconds_total{service_type="db",cpu="0",mode="guest"} 9999
node_memory_MemTotal_bytes{service_type="db"} 1000
node_memory_MemAvailable_bytes{service_type="db"} 370
node_filesystem_size_bytes{service_type="db",mountpoint="/data"} 2000
node_filesystem_avail_bytes{service_type="db",mountpoint="/data"} 1500
node_filesystem_size_bytes{service_type="db",mountpoint="/"} 999999
node_memory_MemTotal_bytes{service_type="other"} 999999
`);

test('Guardian parses database-only RAM/data filesystem and CPU rates across samples', () => {
  const first = sample(100, 10),
    second = sample(190, 20);
  assert.equal(first.ramPercent, 63);
  assert.equal(first.diskPercent, 25);
  assert.equal(first.diskTotalBytes, 2000);
  assert.equal(first.diskUsedBytes, 500);
  assert.equal(hardwareCpuPercent(null, first), null);
  assert.equal(hardwareCpuPercent(first, second), 10);
  assert.equal(hardwareCpuPercent(first, first), null);
  assert.equal(hardwareCpuPercent(second, first), null);
  assert.equal(parseSupabaseHardware('unavailable').ramPercent, null);
  assert.equal(hardwareCpuPercent(first, parseSupabaseHardware('')), null);
});
