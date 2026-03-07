import { withApiHandler } from "@/src/lib/api-handler";
import { parsePagination } from "@/src/lib/pagination";
import {
  buildSalesforceFeedXml,
  getSalesforceFeed,
  parseSalesforceFeedEntity,
  parseUpdatedSinceParam,
} from "@/src/services/salesforce-feed";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request: Request) => {
    const params = new URL(request.url).searchParams;
    const entityParam = params.get("entity");
    const parsedEntity = parseSalesforceFeedEntity(entityParam);
    const entity = parsedEntity ?? "applications";

    if (entityParam && !parsedEntity) {
      return Response.json(
        {
          error: "Ongeldige entity. Gebruik jobs, candidates of applications.",
        },
        { status: 400 },
      );
    }

    const updatedSince = parseUpdatedSinceParam(params.get("updatedSince"));
    if (params.get("updatedSince") && updatedSince === null) {
      return Response.json(
        {
          error: "Ongeldige updatedSince. Gebruik een geldige ISO 8601 datum.",
        },
        { status: 400 },
      );
    }

    const { limit, offset } = parsePagination(params);
    const records = await getSalesforceFeed({
      entity,
      id: params.get("id")?.trim() || undefined,
      updatedSince: updatedSince ?? undefined,
      status: params.get("status")?.trim() || undefined,
      limit,
      offset,
    });

    return new Response(buildSalesforceFeedXml(records), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  },
  {
    errorMessage: "Kan Salesforce feed niet ophalen",
    logPrefix: "GET /api/salesforce-feed error",
  },
);
