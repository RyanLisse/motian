export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Parse pagination parameters from URL search params.
 * Supports Dutch aliases: `pagina` for page, `perPage` for limit.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults?: { limit?: number; maxLimit?: number },
): PaginationParams {
  const maxLimit = defaults?.maxLimit ?? 100;
  const defaultLimit = defaults?.limit ?? 50;
  const page = Math.max(
    1,
    parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
  );
  const limit = Math.min(
    maxLimit,
    Math.max(
      1,
      parseInt(
        searchParams.get("limit") ?? searchParams.get("perPage") ?? String(defaultLimit),
        10,
      ),
    ),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Build a standard paginated JSON response object.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page: params.page,
    perPage: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}
