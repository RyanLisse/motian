import { buildOpenApiDocument } from "@/src/lib/api-docs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json(buildOpenApiDocument(request));
}
