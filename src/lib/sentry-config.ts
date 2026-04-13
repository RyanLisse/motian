const SENTRY_SAAS_HOST_RE = /^o\d+\.ingest\.sentry\.io$/;

function hasNumericProjectId(pathname: string): boolean {
  const projectId = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  return /^\d+$/.test(projectId);
}

export function isValidSentryDsn(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;

  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return false;
    if (!url.username) return false;
    if (!hasNumericProjectId(url.pathname)) return false;

    if (url.hostname.endsWith(".sentry.io")) {
      return SENTRY_SAAS_HOST_RE.test(url.hostname);
    }

    return true;
  } catch {
    return false;
  }
}

export function getSafeSentryDsn(value: string | null | undefined): string | undefined {
  return isValidSentryDsn(value) ? value : undefined;
}
