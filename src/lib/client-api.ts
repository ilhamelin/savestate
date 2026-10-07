'use client';
export async function api<T = unknown>(
  resource: string,
  data: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/${resource}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = (await response.json()) as { data?: T; error?: string };
  if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar.');
  return result.data as T;
}
