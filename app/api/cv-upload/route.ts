import { Buffer } from "node:buffer";
import type { NextRequest } from "next/server";
import { requirePrincipal } from "@/src/lib/api-auth";
import type { CvUploadValidationResult } from "@/src/lib/cv-upload";
import { validateCvUploadBuffer, validateCvUploadFile } from "@/src/lib/cv-upload";
import { uploadFile } from "@/src/lib/file-storage";
import { rateLimit } from "@/src/lib/rate-limit";
import { findDuplicateCandidate } from "@/src/services/candidates";
import { parseCV } from "@/src/services/cv-parser";
import {
  CV_PROCESSING_FAILED_MESSAGE,
  extractClientIp,
  requireBlobToken,
} from "../_shared/cv-helpers";

export const dynamic = "force-dynamic";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

function checkRateLimit(ip: string): Response | null {
  const { success, reset } = limiter.check(ip);
  if (success) return null;

  return Response.json(
    { error: "Te veel verzoeken. Probeer het later opnieuw." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
  );
}

type ParsedCvUploadRequest =
  | {
      ok: true;
      buffer: Buffer;
      file: File;
      validation: Extract<CvUploadValidationResult, { ok: true }>;
    }
  | { ok: false; response: Response };

async function readAndValidateCvUpload(request: NextRequest): Promise<ParsedCvUploadRequest> {
  const formData = await request.formData();
  const file = formData.get("cv") as File | null;
  if (!file) {
    return {
      ok: false,
      response: Response.json({ error: "Geen bestand ontvangen" }, { status: 400 }),
    };
  }

  // Check size/type metadata before reading the file into memory so an
  // oversized or unsupported upload is rejected without materializing its bytes.
  const metadataValidation = validateCvUploadFile(file);
  if (!metadataValidation.ok) {
    return {
      ok: false,
      response: Response.json({ error: metadataValidation.message }, { status: 400 }),
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateCvUploadBuffer(file, buffer);
  if (!validation.ok) {
    return { ok: false, response: Response.json({ error: validation.message }, { status: 400 }) };
  }

  return { ok: true, buffer, file, validation };
}

async function processCvUpload(request: NextRequest): Promise<Response> {
  const blobError = requireBlobToken();
  if (blobError) {
    console.error("[CV Upload] BLOB_READ_WRITE_TOKEN is not configured");
    return blobError;
  }

  const parsedRequest = await readAndValidateCvUpload(request);
  if (!parsedRequest.ok) return parsedRequest.response;
  const { buffer, file, validation } = parsedRequest;

  // Upload to blob storage only after metadata and content validation.
  const { url: fileUrl } = await uploadFile(
    buffer,
    `cv/${Date.now()}-${file.name}`,
    validation.mimeType,
  );

  // Parse CV with Gemini
  const parsed = await parseCV(buffer, validation.mimeType);

  // Check for duplicates
  const duplicates = await findDuplicateCandidate(parsed);

  return Response.json(
    {
      parsed,
      fileUrl,
      duplicates: {
        exact: duplicates.exact,
        similar: duplicates.similar,
      },
    },
    {
      headers: { "Cache-Control": "private, no-cache, no-store" },
    },
  );
}

export async function POST(request: NextRequest) {
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

  const rateLimited = checkRateLimit(extractClientIp(request));
  if (rateLimited) return rateLimited;

  try {
    return await processCvUpload(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("[CV Upload] Error:", message, err);
    return Response.json({ error: CV_PROCESSING_FAILED_MESSAGE }, { status: 500 });
  }
}
