export interface ActivityLogRepositoryPort {
  log(input: {
    readonly userId: string;
    readonly action: string;
    readonly resource: string;
    readonly resourceId?: string | undefined;
    readonly details?: unknown;
    readonly ipAddress?: string | undefined;
    readonly userAgent?: string | undefined;
  }): Promise<void>;
}

export const ACTIVITY_LOG_REPOSITORY = Symbol('ACTIVITY_LOG_REPOSITORY');
