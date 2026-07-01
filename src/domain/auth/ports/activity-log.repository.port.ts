export interface ActivityLogEntry {
  readonly id: string;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string | null;
  readonly details: unknown;
  readonly createdAt: Date;
}

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
  listForUser(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: readonly ActivityLogEntry[]; total: number }>;
}

export const ACTIVITY_LOG_REPOSITORY = Symbol('ACTIVITY_LOG_REPOSITORY');
