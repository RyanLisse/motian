type HeaderLike = Pick<Headers, "get">;

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

function toOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getConfiguredOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return toOrigin(env.PUBLIC_API_BASE_URL ?? env.NEXT_URL);
}

function getHeaderValue(headers: HeaderLike, name: string): string | null {
  return headers.get(name)?.split(",")[0].trim() ?? null;
}

export function getRequestOrigin(headers: HeaderLike): string | null {
  const requestOrigin = toOrigin(getHeaderValue(headers, "origin"));

  if (requestOrigin) {
    return requestOrigin;
  }

  const host = getHeaderValue(headers, "x-forwarded-host") ?? getHeaderValue(headers, "host");

  if (!host) {
    return null;
  }

  const protocol =
    getHeaderValue(headers, "x-forwarded-proto") ?? (LOCAL_HOST_RE.test(host) ? "http" : "https");

  return toOrigin(`${protocol}://${host}`);
}

export function getStableChatOrigin(
  requestOriginOrEnv?: string | null | NodeJS.ProcessEnv,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (typeof requestOriginOrEnv === "object" && requestOriginOrEnv !== null) {
    return getConfiguredOrigin(requestOriginOrEnv);
  }

  return toOrigin(requestOriginOrEnv) ?? getConfiguredOrigin(env);
}
