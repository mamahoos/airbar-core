import { describe, it, expect } from '@jest/globals';

import {
  buildPaginationMeta,
  normalizePagination,
  paginateArray,
  toSkipTake,
  MAX_LIMIT,
} from './pagination.js';

describe('pagination', () => {
  it('normalizes page and limit with defaults and caps', () => {
    expect(normalizePagination({})).toEqual({ page: 1, limit: 20 });
    expect(normalizePagination({ page: 0, limit: 999 })).toEqual({ page: 1, limit: MAX_LIMIT });
    expect(normalizePagination({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10 });
  });

  it('computes skip/take for Prisma', () => {
    expect(toSkipTake({ page: 2, limit: 10 })).toEqual({ skip: 10, take: 10, page: 2, limit: 10 });
  });

  it('builds meta with correct totalPages', () => {
    expect(buildPaginationMeta(45, 2, 20)).toEqual({
      page: 2,
      limit: 20,
      totalItems: 45,
      totalPages: 3,
    });
  });

  it('paginates in-memory arrays', () => {
    const items = [1, 2, 3, 4, 5];
    const page1 = paginateArray(items, { page: 1, limit: 2 });
    expect(page1.data).toEqual([1, 2]);
    expect(page1.pagination.totalPages).toBe(3);

    const page3 = paginateArray(items, { page: 3, limit: 2 });
    expect(page3.data).toEqual([5]);
  });
});
