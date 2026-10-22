import 'server-only';
import QRCode from 'qrcode';
import type { CardQrCode } from '@/domain/memory-card';

/** Encode on the server: no QR library or third-party QR service in the browser. */
export function createMemoryCardQr(username: string, baseUrl: string): CardQrCode {
  const url = new URL('/players/' + encodeURIComponent(username), baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('URL de perfil no válida.');
  const { modules } = QRCode.create(url.href, { errorCorrectionLevel: 'M' });
  const paths: string[] = [];
  // Four white modules around every edge are the scanner's quiet zone.
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      const start = x;
      while (x + 1 < modules.size && modules.get(y, x + 1)) x++;
      paths.push('M' + (start + 4) + ',' + (y + 4.5) + 'h' + (x - start + 1));
    }
  }
  return { url: url.href, size: modules.size + 8, path: paths.join('') };
}
