import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  buildSalesforceFeedXml,
  getSalesforceFeed,
  parseSalesforceFeedEntity,
  parseUpdatedSinceParam,
  SALESFORCE_FEED_ENTITIES,
} from "../../services/salesforce-feed.js";

const salesforceFeedSchema = z.object({
  entity: z
    .enum(SALESFORCE_FEED_ENTITIES)
    .optional()
    .describe("Salesforce entity: jobs, candidates of applications"),
  id: z.string().optional().describe("Optioneel record-id filter"),
  status: z.string().optional().describe("Optionele statusfilter"),
  updatedSince: z
    .string()
    .optional()
    .describe("Alleen records bijgewerkt sinds deze ISO 8601 datum"),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum aantal records"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
  page: z.number().int().min(1).optional().describe("Paginanummer als alternatief voor offset"),
});

function resolveOffset(limit: number, offset?: number, page?: number): number {
  if (offset !== undefined) return offset;
  return page && page > 1 ? (page - 1) * limit : 0;
}

export const tools = [
  {
    name: "salesforce_feed",
    description: "Haal de Salesforce XML-feed op voor jobs, candidates of applications.",
    inputSchema: zodToJsonSchema(salesforceFeedSchema, { $refStrategy: "none" }),
  },
];

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  salesforce_feed: async (raw) => {
    const parsed = salesforceFeedSchema.parse(raw);
    const entity = parseSalesforceFeedEntity(parsed.entity) ?? "applications";
    const updatedSince = parseUpdatedSinceParam(parsed.updatedSince);

    if (parsed.updatedSince && updatedSince === null) {
      throw new Error("Ongeldige updatedSince. Gebruik een geldige ISO 8601 datum.");
    }

    const limit = parsed.limit ?? 50;
    const records = await getSalesforceFeed({
      entity,
      id: parsed.id?.trim() || undefined,
      updatedSince: updatedSince ?? undefined,
      status: parsed.status?.trim() || undefined,
      limit,
      offset: resolveOffset(limit, parsed.offset, parsed.page),
    });

    return {
      entity,
      count: records.length,
      xml: buildSalesforceFeedXml(records),
    };
  },
};
