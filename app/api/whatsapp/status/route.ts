import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
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
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
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
