import type { NextRequest } from "next/server";
import { type SupportedCvMimeType, validateCvUploadFile } from "@/src/lib/cv-upload";
import { rateLimit } from "@/src/lib/rate-limit";

const CV_ROUTE_RATE_LIMIT = { interval: 60_000, limit: 10 };
const limiter = rateLimit(CV_ROUTE_RATE_LIMIT);

/** Returns 503 response if blob storage is not configured; otherwise null. */
export function getBlobUnavailableResponse(): Response | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error: "Bestandsopslag is niet geconfigureerd. Stel BLOB_READ_WRITE_TOKEN in.",
      },
      { status: 503 },
    );
  }
  return null;
}

/** Returns 429 response if rate limit exceeded; otherwise null. Shared by cv-analyse and cv-upload. */
export function getCvRateLimitResponse(request: NextRequest): Response | null {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous";
  const { success, reset } = limiter.check(ip);
  if (success) return null;
  return Response.json(
    { error: "Te veel verzoeken. Probeer het later opnieuw." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
      },
    },
  );
}

export type CvFileFromRequestResult =
  | { ok: true; file: File; buffer: Buffer; mimeType: SupportedCvMimeType }
  | { ok: false; response: Response };

/**
 * Parse formData, get "cv" file, validate type/size. Shared by cv-analyse and cv-upload POST.
 */
export async function getCvFileFromRequest(request: NextRequest): Promise<CvFileFromRequestResult> {
  const formData = await request.formData();
  const file = formData.get("cv") as File | null;
  if (!file) {
    return {
      ok: false,
      response: Response.json({ error: "Geen bestand ontvangen" }, { status: 400 }),
    };
  }
  const validation = validateCvUploadFile(file);
  if (!validation.ok) {
    return {
      ok: false,
      response: Response.json({ error: validation.message }, { status: 400 }),
    };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { ok: true, file, buffer, mimeType: validation.mimeType };
}
