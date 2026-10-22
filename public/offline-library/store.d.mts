export interface OfflineLibraryRow {
  gameId: string;
  title: string;
  slug: string;
  status: 'playing' | 'backlog' | 'cleared' | 'platinum' | 'dropped' | 'wishlist';
  rating: number | null;
  hours: number;
  sessions: number;
  platforms: string[];
}
export interface OfflineLibrarySnapshot {
  version: 1;
  ownerId: string;
  savedAt: string;
  expiresAt: string;
  totalCount: number;
  rows: OfflineLibraryRow[];
}
export interface OfflineLibraryLease { ownerId: string; epoch: string }
export const OFFLINE_DATABASE: string;
export const OFFLINE_ACCESS_KEY: string;
export const OFFLINE_EVENT: string;
export const OFFLINE_MAX_AGE_MS: number;
export const OFFLINE_STATUSES: OfflineLibraryRow['status'][];
export function parseOfflineSnapshot(raw: unknown, ownerId: string, now?: number): OfflineLibrarySnapshot | null;
export function synchronizeOfflineLibraryAccount(ownerId: string | null): Promise<OfflineLibraryLease | void>;
export function offlineLibraryLease(ownerId: string): OfflineLibraryLease;
export function revokeOfflineLibrary(): Promise<void>;
export function saveOfflineLibrary(lease: OfflineLibraryLease, raw: OfflineLibrarySnapshot): Promise<void>;
export function readOfflineLibrary(expectedOwner?: string): Promise<OfflineLibrarySnapshot | null>;
export function deleteOfflineLibrarySnapshot(lease: OfflineLibraryLease): Promise<void>;
export function subscribeOfflineLibrary(listener: () => void): () => void;
