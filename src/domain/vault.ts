import { ValidationError } from './validation.ts';

export const VAULT_QUOTA_BYTES = 100 * 1024 * 1024;
// Public media origin; no credentials. Keep CSP aligned with this origin.
export const VAULT_PUBLIC_ORIGIN = 'https://pub-83372560eadf4eadac2d1835674c6840.r2.dev';
export function safeVaultMediaUrl(value: unknown, base = VAULT_PUBLIC_ORIGIN): string | null {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const url = new URL(value);
    if (
      url.origin !== new URL(base).origin ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    return vaultPublicUrl(base, url.pathname.slice(1)) === value ? value : null;
  } catch {
    return null;
  }
}
export const VAULT_MIMES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;
export type VaultMedia = {
  id: string;
  user_id: string;
  r2_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: 'pending' | 'ready';
  created_at: string;
};
export type VaultItem = VaultMedia & { publicUrl: string };
export type VaultStorage = { used_bytes: number; reserved_bytes: number; quota_bytes: number };
export type VaultSnapshot = { items: VaultItem[]; pending: VaultItem[]; storage: VaultStorage };

export function validateVaultFile(fileName: unknown, fileSize: unknown, mimeType: unknown) {
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 200)
    throw new ValidationError('Nombre de archivo inválido (máximo 200 caracteres).');
  if (typeof mimeType !== 'string' || !Object.hasOwn(VAULT_MIMES, mimeType))
    throw new ValidationError('Solo PNG, JPG, WebP, GIF, MP4 o WebM.');
  if (
    typeof fileSize !== 'number' ||
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > VAULT_QUOTA_BYTES
  )
    throw new ValidationError('El archivo debe pesar entre 1 byte y 100 MB.');
  const stem =
    fileName
      .replace(/\.[^.]*$/, '')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'archivo';
  return {
    fileName: `${stem}.${VAULT_MIMES[mimeType as keyof typeof VAULT_MIMES]}`,
    fileSize,
    mimeType,
  };
}
export function vaultHasSpace(storage: VaultStorage, fileSize: number) {
  return (
    Number.isSafeInteger(fileSize) &&
    fileSize > 0 &&
    fileSize <= storage.quota_bytes - storage.used_bytes - storage.reserved_bytes
  );
}
export function vaultCapacity(storage: VaultStorage) {
  const percent = Math.min(
    100,
    Math.max(0, ((storage.used_bytes + storage.reserved_bytes) / storage.quota_bytes) * 100),
  );
  return {
    percent,
    state:
      percent >= 100 ? 'full' : percent >= 90 ? 'critical' : percent >= 70 ? 'warning' : 'nominal',
  } as const;
}
export function vaultPublicUrl(base: string, key: string) {
  const url = new URL(base);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('R2_PUBLIC_URL debe ser un origen HTTPS.');
  if (!/^[a-f\d-]{36}\/[a-f\d-]{36}-[a-zA-Z0-9_-]+\.(png|jpg|webp|gif|mp4|webm)$/.test(key))
    throw new Error('Clave de bóveda inválida.');
  return `${url.origin}/${key}`;
}
export function vaultMegabytes(bytes: number) {
  return (bytes / 1024 / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 });
}
