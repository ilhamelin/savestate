'use client';
import { bannerExtension, isAnimatedBannerBytes } from '@/domain/banner-media';
export async function profileImage(
  file: File,
  kind: 'avatar' | 'banner' | 'wallpaper',
): Promise<Blob> {
  if (kind === 'banner') {
    bannerExtension(file.type, file.size);
    const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    // PNG ancillary chunks may place acTL beyond the first 4 KB; never flatten such APNGs.
    const animated =
      isAnimatedBannerBytes(header, file.type) ||
      (file.type === 'image/png' &&
        isAnimatedBannerBytes(new Uint8Array(await file.arrayBuffer()), file.type));
    if (animated || file.type === 'image/avif')
      return new Blob([file], {
        type: file.type === 'image/png' && animated ? 'image/apng' : file.type,
      });
  }
  if (
    kind !== 'banner' &&
    (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
  )
    throw new Error('Selecciona PNG, JPG o WebP de hasta 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('La imagen es demasiado grande.');
    const max = kind === 'avatar' ? 512 : 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no puede convertir imágenes.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.65, 0.45, 0.25]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob?.type === 'image/webp' && blob.size <= 512000) return blob;
    }
    throw new Error('La imagen no puede comprimirse a 500 KB. Prueba una más pequeña.');
  } finally {
    bitmap.close();
  }
}
