import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy for private Vercel Blob files.
 * Fetches the file server-side (with BLOB_READ_WRITE_TOKEN) and streams it to the browser.
 * Usage: GET /api/cv-file?url=<encoded-blob-url>
 */
export async function GET(request: NextRequest) {
  const blobUrl = request.nextUrl.searchParams.get("url");

  if (!blobUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Only allow Vercel Blob URLs
  try {
    const parsed = new URL(blobUrl);
    if (
      !parsed.hostname.endsWith(".vercel-storage.com") &&
      !parsed.hostname.endsWith(".blob.vercel-storage.com")
    ) {
      return new Response("Invalid URL domain", { status: 403 });
    }
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new Response("Blob storage not configured", { status: 503 });
  }

  const upstream = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    return new Response("File not found", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
