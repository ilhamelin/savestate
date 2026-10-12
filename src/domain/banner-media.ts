export const MAX_BANNER_BYTES = 8 * 1024 * 1024;
export const BANNER_ACCEPT =
  'image/webp,image/gif,image/png,image/apng,image/avif,image/jpeg,video/webm,video/mp4';
export const BANNER_MIME_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/png': 'png',
  'image/apng': 'apng',
  'image/avif': 'avif',
  'image/jpeg': 'jpg',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};
export const BANNER_MEDIA_ERROR =
  'Selecciona WebP, GIF, APNG, PNG, JPG, AVIF, WebM o MP4 de hasta 8 MB.';
export function bannerExtension(mimeType: string, size: number) {
  if (
    !Object.hasOwn(BANNER_MIME_EXTENSIONS, mimeType) ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_BANNER_BYTES
  )
    throw new Error(BANNER_MEDIA_ERROR);
  return BANNER_MIME_EXTENSIONS[mimeType]!;
}
function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}
export function isAnimatedBannerBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (['image/gif', 'image/apng', 'video/webm', 'video/mp4'].includes(mimeType)) return true;
  if (mimeType === 'image/webp') {
    if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP')
      return false;
    if (ascii(bytes, 12, 4) === 'VP8X' && bytes.length > 20 && (bytes[20]! & 0x02) !== 0)
      return true;
    return /ANIM|ANMF/.test(ascii(bytes, 12, Math.min(bytes.length - 12, 4096)));
  }
  if (mimeType === 'image/png') {
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value))
      return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset + 8 <= bytes.length;) {
      const length = view.getUint32(offset),
        type = ascii(bytes, offset + 4, 4);
      if (type === 'IDAT' || type === 'IEND') return false;
      if (type === 'acTL') return true;
      const next = offset + 12 + length;
      if (next > bytes.length) return false;
      offset = next;
    }
  }
  if (mimeType === 'image/avif' && bytes.length >= 16 && ascii(bytes, 4, 4) === 'ftyp') {
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const end = Math.min(length || bytes.length, bytes.length, 64);
    for (let offset = 8; offset + 4 <= end; offset += 4)
      if (offset !== 12 && ascii(bytes, offset, 4) === 'avis') return true;
  }
  return false;
}
export function isValidBannerStoragePath(pathname: string, userId: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) return false;
  const prefix = `/storage/v1/object/public/profiles/${userId}/`;
  return (
    pathname.startsWith(prefix) &&
    /^banner\.(?:webp|gif|png|apng|avif|jpg|webm|mp4)$/.test(pathname.slice(prefix.length))
  );
}
export function isVideoBannerSource(
  src: string | null | undefined,
  mimeType?: string | null,
): boolean {
  return Boolean(
    mimeType?.startsWith('video/') ||
    (src && /\.(?:webm|mp4)$/i.test(src.split(/[?#]/, 1)[0] ?? '')),
  );
}
