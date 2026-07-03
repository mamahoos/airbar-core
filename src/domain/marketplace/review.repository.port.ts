export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface CreateReviewInput {
  readonly shipmentId: string;
  readonly authorId: string;
  readonly targetId: string;
  readonly rating: number;
  readonly comment?: string | null;
  readonly communication?: number | null;
  readonly punctuality?: number | null;
  readonly packaging?: number | null;
  readonly overall?: number | null;
}

export interface ReviewRecord {
  readonly id: string;
  readonly shipmentId: string;
  readonly authorId: string;
  readonly targetId: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly communication: number | null;
  readonly punctuality: number | null;
  readonly packaging: number | null;
  readonly overall: number | null;
  readonly isVisible: boolean;
  readonly createdAt: Date;
}

export interface TargetRatingAggregate {
  readonly average: number;
  readonly count: number;
}

export interface ReviewRepositoryPort {
  findByShipmentAndAuthor(shipmentId: string, authorId: string): Promise<ReviewRecord | null>;
  createAndRecomputeRating(
    input: CreateReviewInput,
  ): Promise<{ review: ReviewRecord; aggregate: TargetRatingAggregate }>;
  listByTarget(
    targetId: string,
    page: number,
    limit: number,
  ): Promise<{ data: readonly ReviewRecord[]; total: number; aggregate: TargetRatingAggregate }>;
  listByShipment(shipmentId: string): Promise<readonly ReviewRecord[]>;
}
