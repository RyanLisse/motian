import type { PaginationParams } from "@/src/lib/pagination";
import { parsePagination } from "@/src/lib/pagination";

export type ParseListParamsResult = PaginationParams & {
  searchParams: URLSearchParams;
};

/**
 * Parse pagination (page, limit, offset) and expose searchParams from a Request.
 * Shared by list-style API routes (e.g. berichten, matches) to avoid duplicating URL + parsePagination.
 */
export function parseListParams(req: Request): ParseListParamsResult {
  const searchParams = new URL(req.url).searchParams;
  const { page, limit, offset } = parsePagination(searchParams);
  return { page, limit, offset, searchParams };
}
