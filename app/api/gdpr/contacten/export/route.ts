import type { NextRequest } from "next/server";
import { exportContactData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
    const data = await exportContactData(identifier, requestedBy);
    return Response.json({ data });
  } catch (error) {
    console.error("Fout bij exporteren contactgegevens:", error);
    return Response.json({ error: "Kan contactgegevens niet exporteren" }, { status: 500 });
  }
}
