export function normalizeRemoteImageUrl(value?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  const absolute = candidate.startsWith("//") ? `https:${candidate}` : candidate;

  try {
    const url = new URL(absolute);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isSvgImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}
