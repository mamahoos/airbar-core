/** Machine-readable error codes for consistent API responses. */
export enum ErrorCode {
  VALIDATION = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE = 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(ErrorCode.NOT_FOUND, id ? `${resource} not found: ${id}` : `${resource} not found`);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.CONFLICT, message, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION, message, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(ErrorCode.FORBIDDEN, message, details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message);
  }
}
