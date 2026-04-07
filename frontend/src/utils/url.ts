export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function isValidUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.hostname.includes('.');
  } catch {
    return false;
  }
}
