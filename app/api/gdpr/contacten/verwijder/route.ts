import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { scrubContactData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export const DELETE = withApiHandler(
  async (request: NextRequest) => {
    const identifier =
      request.nextUrl.searchParams.get("identifier") ?? request.nextUrl.searchParams.get("q");

    if (!identifier) {
      return Response.json(
        { error: "identifier of q queryparameter is verplicht" },
        { status: 400 },
      );
    }

    const requestedBy = request.headers.get("x-requested-by") ?? "system";
    const data = await scrubContactData(identifier, requestedBy);
    return Response.json({ data });
  },
  {
    logPrefix: "Fout bij verwijderen contactgegevens",
    errorMessage: "Kan contactgegevens niet verwijderen",
  },
);
