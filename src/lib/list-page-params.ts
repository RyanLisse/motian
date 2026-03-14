import { parsePagination } from "@/src/lib/pagination";

export const DEFAULT_LIST_PAGE_SIZE = 20;
export const MAX_LIST_PAGE_SIZE = 50;

type ResolvedSearchParams = Record<string, string | string[] | undefined>;

/**
 * Build URLSearchParams from Next.js resolved searchParams (drops empty/undefined).
 * Shared by list pages (interviews, messages) for consistent URL handling.
 */
export function searchParamsToURLSearchParams(params: ResolvedSearchParams): URLSearchParams {
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) urlParams.set(key, v);
  }
  return urlParams;
}

export type ListPagePaginationOptions = {
  limit?: number;
  maxLimit?: number;
};

export type ListPagePaginationResult = ReturnType<typeof parsePagination> & {
  urlParams: URLSearchParams;
};

/**
 * Parse pagination and URLSearchParams from resolved searchParams.
 * Shared by list pages (interviews, messages) for consistent URL + pagination handling.
 */
export function parseListPagePagination(
  params: ResolvedSearchParams,
  options: ListPagePaginationOptions = {},
): ListPagePaginationResult {
  const urlParams = searchParamsToURLSearchParams(params);
  const pagination = parsePagination(urlParams, {
    limit: options.limit ?? DEFAULT_LIST_PAGE_SIZE,
    maxLimit: options.maxLimit ?? MAX_LIST_PAGE_SIZE,
  });
  return { ...pagination, urlParams };
}
