import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Original pixel controller, aligned with the cyan SaveState wordmark.
const pixels = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '...........CCCCCCCCCC...........',
  '........CCCC........CCCC........',
  '.......CC..............CC.......',
  '......CC................CC......',
  '.....CC..................CC.....',
  '.....CC..................CC.....',
  '....CC....WW..............CC....',
  '....CC....WW........PP....CC....',
  '....CC..WWWWWW......PP....CC....',
  '....CC..WWWWWW...........CC....',
  '....CC....WW......GG.....CC....',
  '....CC....WW......GG.....CC....',
  '....CC...................CC....',
  '....CC.......CCCCCC......CC....',
  '....CC......CC....CC.....CC....',
  '....CC.....CC......CC....CC....',
  '.....CC...CC........CC..CC.....',
  '......CCCCC..........CCCC......',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
].map((row) => row.padEnd(32, '.'));
const colors = {
  '.': [8, 8, 12, 255],
  C: [0, 240, 255, 255],
  W: [242, 244, 248, 255],
  P: [255, 0, 85, 255],
  G: [0, 255, 102, 255],
};
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, checksum]);
}
function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const pixel = pixels[Math.floor((y * 32) / size)][Math.floor((x * 32) / size)];
      const color = colors[pixel] ?? colors['.'];
      for (let channel = 0; channel < 4; channel++)
        scanlines[y * (size * 4 + 1) + 1 + x * 4 + channel] = color[channel];
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const directory = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(directory, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
])
  writeFileSync(`${directory}/${name}`, png(size));
console.log('Iconos PNG generados: 192, 512 y Apple 180 px.');
