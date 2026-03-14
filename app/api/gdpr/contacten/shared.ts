import type { NextRequest } from "next/server";

export type ParseContactRequestResult =
  | { ok: true; identifier: string; requestedBy: string }
  | { ok: false; response: Response };

/**
 * Shared parsing for contact export/verwijder: identifier (q or identifier param) and requestedBy header.
 */
export function parseContactRequest(request: NextRequest): ParseContactRequestResult {
  const identifier =
    request.nextUrl.searchParams.get("identifier") ?? request.nextUrl.searchParams.get("q");

  if (!identifier) {
    return {
      ok: false,
      response: Response.json(
        { error: "identifier of q queryparameter is verplicht" },
        { status: 400 },
      ),
    };
  }

  const requestedBy = request.headers.get("x-requested-by") ?? "system";
  return { ok: true, identifier, requestedBy };
}
