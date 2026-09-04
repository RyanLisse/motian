/**
 * Server-side BFF helpers for first-party browser → `/api/**` traffic.
 *
 * The browser calls `/bff/<api-path>` (outside the proxy matcher). This module
 * checks same-origin isolation, attaches `Authorization: Bearer ${API_SECRET}`,
 * and forwards to `/api/<api-path>`. The secret never enters client bundles.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

/** True when the request looks like a same-origin first-party browser call. */
export function isFirstPartyBrowserRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (!origin && secFetchSite === "same-origin") {
    return true;
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (origin === url.origin) {
    return true;
  }

  const host = request.headers.get("host");
  if (host && origin === `${url.protocol}//${host}`) {
    return true;
  }

  return false;
}

/**
 * Maps `/bff/cv-upload` path segments to `/api/cv-upload`. Rejects traversal
 * and nested bff loops.
 */
export function resolveBffApiPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  if (segments.some((s) => s === ".." || s === "." || s.includes("\\") || s === "")) {
    return null;
  }
  if (segments[0] === "bff") return null;

  return `/api/${segments.join("/")}`;
}

/** Builds upstream headers: copy safe inbound headers, attach API_SECRET bearer. */
export function buildBffUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "authorization") return;
    headers.set(key, value);
  });

  const secret = process.env.API_SECRET?.trim();
  if (secret) {
    headers.set("Authorization", `Bearer ${secret}`);
  }

  return headers;
}

/**
 * Base URL the BFF should forward to.
 *
 * On Vercel the inbound origin is also the server's own origin, so forwarding
 * there is a local hop and `INTERNAL_SERVER_URL` stays unset.
 *
 * Behind a reverse proxy it is not. `request.url` carries the public hostname,
 * so forwarding to it sends the request back out of the container, through the
 * proxy and in again — a round trip that costs latency, and that fails outright
 * when the container cannot resolve or reach its own public name, which is the
 * common case on a Docker network. `INTERNAL_SERVER_URL` (for example
 * `http://127.0.0.1:3000`) keeps the hop on the loopback.
 *
 * An unparseable value is ignored rather than thrown on: a malformed
 * deployment variable should not take the whole BFF down when the inbound
 * origin still works.
 */
export function resolveBffUpstreamOrigin(requestOrigin: string): string {
  const configured = process.env.INTERNAL_SERVER_URL?.trim();
  if (!configured) {
    return requestOrigin;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return requestOrigin;
  }
}

/**
 * Forwards a first-party BFF request to the matching `/api/**` route with a
 * server-attached bearer. Caller must already have verified same-origin.
 */
export async function forwardBffToApi(request: Request, apiPath: string): Promise<Response> {
  const url = new URL(request.url);
  const upstreamUrl = new URL(apiPath, resolveBffUpstreamOrigin(url.origin));
  upstreamUrl.search = url.search;

  const method = request.method.toUpperCase();
  const headers = buildBffUpstreamHeaders(request);
  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    // Required when streaming a request body in Node/Undici.
    (init as RequestInit & { duplex?: "half" }).duplex = "half";
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Cache-Control", "private, no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
