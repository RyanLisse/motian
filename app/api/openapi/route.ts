import { buildOpenApiDocument } from "@/src/lib/api-docs";

export async function GET(request: Request) {
  return Response.json(buildOpenApiDocument(request), {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
