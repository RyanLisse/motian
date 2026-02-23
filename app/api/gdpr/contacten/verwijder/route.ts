import type { NextRequest } from "next/server";
import { scrubContactData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("Fout bij verwijderen contactgegevens:", error);
    return Response.json({ error: "Kan contactgegevens niet verwijderen" }, { status: 500 });
  }
}
