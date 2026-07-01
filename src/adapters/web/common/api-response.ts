/** Standard success envelope for public REST responses. */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  if (meta !== undefined) {
    return { success: true, data, meta };
  }
  return { success: true, data };
}
