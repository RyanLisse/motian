import { buildScalarHtml, OPENAPI_ROUTE } from "@/src/lib/api-docs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const specUrl = new URL(OPENAPI_ROUTE, request.url).toString();

  return new Response(buildScalarHtml(specUrl), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
