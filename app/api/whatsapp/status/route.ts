import { NextResponse } from "next/server";
import { requirePrincipal } from "@/src/lib/api-auth";

// Auth-dependent response — must not be statically cached across callers.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

  const start = Date.now();
  console.log(
    JSON.stringify({
      level: "info",
      msg: "start",
      route: "/api/whatsapp/status",
    }),
  );

  const response = NextResponse.json(
    {
      enabled: false,
      status: "disabled",
      message: "WhatsApp integratie is uitgeschakeld",
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );

  console.log(
    JSON.stringify({
      level: "info",
      msg: "done",
      route: "/api/whatsapp/status",
      ms: Date.now() - start,
    }),
  );

  return response;
}
