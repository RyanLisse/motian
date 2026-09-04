import type { NextRequest } from "next/server";
import { assertCanReadCandidate, requirePrincipal } from "@/src/lib/api-auth";
import { findCandidateByResumeUrl, getCandidateById } from "@/src/services/candidates";
import { requireBlobToken } from "../_shared/cv-helpers";

export const dynamic = "force-dynamic";

const FORBIDDEN_FILE_MESSAGE = "Geen toegang tot dit bestand";
const NOT_FOUND_MESSAGE = "Bestand niet gevonden";
const MISSING_ID_MESSAGE = "Ontbrekende kandidaat-identificatie";

function isAllowedBlobHostname(hostname: string): boolean {
  return hostname.endsWith(".vercel-storage.com") || hostname.endsWith(".blob.vercel-storage.com");
}

function denyForbidden(): Response {
  return new Response(FORBIDDEN_FILE_MESSAGE, { status: 403 });
}

function denyNotFound(): Response {
  return new Response(NOT_FOUND_MESSAGE, { status: 404 });
}

/**
 * Proxy for private Vercel Blob CV files.
 *
 * Authorization is record-bound: resolve a persisted, non-soft-deleted
 * candidate (via `kandidaatId`, or a temporary `url=` compatibility match),
 * run `assertCanReadCandidate`, then fetch with `BLOB_READ_WRITE_TOKEN`.
 * Caller-supplied blob URLs that do not map to a record are rejected with
 * zero upstream fetch.
 *
 * Preferred: GET /api/cv-file?kandidaatId=<uuid>
 * Temporary: GET /api/cv-file?url=<encoded-blob-url> (must match a resumeUrl)
 */
export async function GET(request: NextRequest) {
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }
  const principal = principalOrResponse;

  const kandidaatId = request.nextUrl.searchParams.get("kandidaatId")?.trim() || null;
  const blobUrlParam = request.nextUrl.searchParams.get("url")?.trim() || null;

  if (!kandidaatId && !blobUrlParam) {
    return new Response(MISSING_ID_MESSAGE, { status: 400 });
  }

  let candidateId: string;
  let storedUrl: string;

  if (kandidaatId) {
    const candidate = await getCandidateById(kandidaatId);
    if (!candidate?.resumeUrl) {
      return denyNotFound();
    }
    candidateId = candidate.id;
    storedUrl = candidate.resumeUrl;
  } else {
    // Compatibility path: ?url= only when it maps to a persisted resumeUrl.
    const candidate = await findCandidateByResumeUrl(blobUrlParam as string);
    if (!candidate?.resumeUrl) {
      return denyForbidden();
    }
    candidateId = candidate.id;
    storedUrl = candidate.resumeUrl;
  }

  const access = await assertCanReadCandidate(principal, candidateId);
  if (access === "deny") {
    return denyForbidden();
  }

  // Defense in depth — hostname allowlist is not the authorization decision.
  try {
    const parsed = new URL(storedUrl);
    if (!isAllowedBlobHostname(parsed.hostname)) {
      return denyForbidden();
    }
  } catch {
    return new Response("Ongeldige bestands-URL", { status: 400 });
  }

  const blobError = requireBlobToken();
  if (blobError) return blobError;
  const token = process.env.BLOB_READ_WRITE_TOKEN as string;

  const upstream = await fetch(storedUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    return new Response(NOT_FOUND_MESSAGE, { status: upstream.status === 404 ? 404 : 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
