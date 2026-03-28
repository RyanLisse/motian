import { buildScalarHtml, OPENAPI_ROUTE } from "@/src/lib/api-docs";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(buildScalarHtml(OPENAPI_ROUTE), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
