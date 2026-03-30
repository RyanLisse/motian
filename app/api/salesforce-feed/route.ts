import { createHash } from "node:crypto";
import { withApiHandler } from "@/src/lib/api-handler";
import { parsePagination } from "@/src/lib/pagination";
import type { SalesforceFeedRecord } from "@/src/services/salesforce-feed";
import {
  buildSalesforceFeedXml,
  getSalesforceFeed,
  parseSalesforceFeedEntity,
  parseUpdatedSinceParam,
} from "@/src/services/salesforce-feed";

export const dynamic = "force-dynamic";

function buildFeedEtag(xml: string): string {
  return `"${createHash("sha1").update(xml).digest("base64url")}"`;
}

function matchesIfNoneMatch(headerValue: string | null, etag: string): boolean {
  if (!headerValue) return false;

  return headerValue.split(",").some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, "");
    return normalized === "*" || normalized === etag;
  });
}

function getLastModifiedDate(records: SalesforceFeedRecord[]): Date | undefined {
  const timestamps = records
    .map((record) => record.fields.LastModifiedDate)
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return undefined;

  return new Date(Math.max(...timestamps));
}

function toHttpTimestamp(value: Date): number {
  return new Date(value.toUTCString()).getTime();
}

function matchesIfModifiedSince(headerValue: string | null, lastModifiedAt?: Date): boolean {
  if (!headerValue || !lastModifiedAt) return false;

  const parsed = new Date(headerValue);
  if (Number.isNaN(parsed.getTime())) return false;

  return toHttpTimestamp(lastModifiedAt) <= parsed.getTime();
}

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
    const xml = buildSalesforceFeedXml(records);
    const etag = buildFeedEtag(xml);
    const lastModifiedAt = getLastModifiedDate(records);
    const cacheHeaders = {
      "Cache-Control": "private, no-cache",
      ETag: etag,
      ...(lastModifiedAt ? { "Last-Modified": lastModifiedAt.toUTCString() } : {}),
      Vary: "Authorization",
    };

    const ifNoneMatch = request.headers.get("if-none-match");
    const isNotModified = ifNoneMatch
      ? matchesIfNoneMatch(ifNoneMatch, etag)
      : matchesIfModifiedSince(request.headers.get("if-modified-since"), lastModifiedAt);

    if (isNotModified) {
      return new Response(null, {
        status: 304,
        headers: cacheHeaders,
      });
    }

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        ...cacheHeaders,
      },
    });
  },
  {
    errorMessage: "Kan Salesforce feed niet ophalen",
    logPrefix: "GET /api/salesforce-feed error",
  },
);
