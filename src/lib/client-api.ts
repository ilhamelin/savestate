'use client';
import { readJsonResponse } from './api-response.ts';
export async function api<T = unknown>(
  resource: string,
  data: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/${resource}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  const result = await readJsonResponse<{ data?: T }>(response);
  if (!result || !('data' in result))
    throw new Error('El servidor devolvió una respuesta incompleta. Inténtalo de nuevo.');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('savestate:progress-changed'));
  return result.data as T;
}
