export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationParams {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly pagination: PaginationMeta;
}

export function normalizePagination(params: PaginationParams): { page: number; limit: number } {
  const page = Math.max(1, Math.floor(params.page ?? DEFAULT_PAGE));
  const rawLimit = Math.floor(params.limit ?? DEFAULT_LIMIT);
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit };
}

export function toSkipTake(params: PaginationParams): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const { page, limit } = normalizePagination(params);
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildPaginationMeta(
  totalItems: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return { page, limit, totalItems, totalPages };
}

export function paginateArray<T>(
  items: readonly T[],
  params: PaginationParams,
): PaginatedResult<T> {
  const { skip, take, page, limit } = toSkipTake(params);
  const data = items.slice(skip, skip + take);
  return { data, pagination: buildPaginationMeta(items.length, page, limit) };
}
