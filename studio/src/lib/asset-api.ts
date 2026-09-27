import type { ImageStudy } from '../../lib/image-studio-contract';
export async function assetApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'The asset library is unavailable.');
  return value as T;
}
export const getStudy = (id: string, signal?: AbortSignal) => assetApi<ImageStudy>(`/api/images/jobs/${encodeURIComponent(id)}`, { signal });
export const repeatStudy = (sourceId: string) => assetApi<ImageStudy>('/api/images/repeat', { method: 'POST', body: JSON.stringify({ sourceId }) });
export const libraryUrl = (id?: string) => `/studio/library${id ? `?asset=${encodeURIComponent(id)}` : ''}`;
