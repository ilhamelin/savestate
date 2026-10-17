'use client';
import { isAnimatedBannerBytes } from '../domain/banner-media.ts';
export function vaultImageDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Dimensiones inválidas.');
  const scale = Math.min(1, 2560 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
function staticPngHeader(bytes: Uint8Array) {
  if (bytes.length < 8) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 8 <= bytes.length;) {
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'acTL') return false;
    if (type === 'IDAT') return true;
    const next = offset + 12 + view.getUint32(offset);
    if (next > bytes.length) return false;
    offset = next;
  }
  return false;
}
export async function optimizeVaultImage(file: File): Promise<File> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return file;
  let url: string | undefined;
  try {
    const bytes = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
    if (isAnimatedBannerBytes(bytes, file.type)) return file;
    // An incomplete PNG header is not proof that a large ancillary chunk hides no animation.
    if (file.type === 'image/png' && !staticPngHeader(bytes)) return file;
    url = URL.createObjectURL(file);
    const image = new globalThis.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = url!;
    });
    if (!image.naturalWidth || !image.naturalHeight) return file;
    const size = vaultImageDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    );
    if (!blob || blob.type !== 'image/webp' || blob.size === 0 || blob.size >= file.size)
      return file;
    return new File([blob], `${file.name.replace(/\.[^.]*$/, '')}.webp`, {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
